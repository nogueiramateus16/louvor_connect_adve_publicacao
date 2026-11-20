begin;
alter table public.repertorio add column trecho text not null default '' check (length(trecho) <= 500);
alter table public.escalas add column termino timestamptz check (
  termino is null or (termino > inicio and termino <= inicio + interval '24 hours')
);
create table public.chat_do_culto (
  id bigint generated always as identity primary key,
  escala_id uuid not null references public.escalas(id) on delete restrict,
  autor_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  mensagem text not null check (length(trim(mensagem)) between 1 and 1500),
  criado_em timestamptz not null default now()
);
create index chat_do_culto_escala on public.chat_do_culto (escala_id, id desc);
alter table public.chat_do_culto enable row level security;
revoke all on public.chat_do_culto from anon,public,authenticated;
grant select, insert(escala_id,mensagem) on public.chat_do_culto to authenticated;

create function public.chat_do_culto_aberto(inicio timestamptz, termino timestamptz)
returns boolean language sql stable set search_path = '' as $$
  select now() >= (date_trunc('day', inicio at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')
     and now() < coalesce(termino, inicio + interval '2 hours');
$$;
revoke all on function public.chat_do_culto_aberto(timestamptz,timestamptz) from public,anon;
grant execute on function public.chat_do_culto_aberto(timestamptz,timestamptz) to authenticated;
create policy chat_leitura on public.chat_do_culto for select to authenticated using (
  exists (select 1 from public.lideres l where l.usuario_id=auth.uid())
  or exists (
    select 1 from public.escalas e where e.id=escala_id and auth.uid()=any(e.integrantes)
    and public.chat_do_culto_aberto(e.inicio,e.termino)
  )
);
create policy chat_escrita on public.chat_do_culto for insert to authenticated with check (
  autor_id=auth.uid() and exists (
    select 1 from public.escalas e where e.id=escala_id and public.chat_do_culto_aberto(e.inicio,e.termino)
    and (auth.uid()=any(e.integrantes) or exists(select 1 from public.lideres l where l.usuario_id=auth.uid()))
  )
);
create function public.ler_chat_do_culto(culto uuid, antes_de bigint default null)
returns table (aberto boolean, mensagens jsonb)
language plpgsql security definer stable set search_path = '' as $$
declare e public.escalas%rowtype; lider boolean; disponivel boolean;
begin
  if auth.uid() is null then return; end if;
  select * into e from public.escalas where id=culto;
  lider := exists(select 1 from public.lideres l where l.usuario_id=auth.uid());
  if not found or e.id is null or (not lider and not (auth.uid()=any(e.integrantes))) then return; end if;
  disponivel := public.chat_do_culto_aberto(e.inicio,e.termino);
  return query select disponivel, case when lider or disponivel then (
    select coalesce(jsonb_agg(to_jsonb(m) order by m.id), '[]'::jsonb) from (
      select c.id, c.mensagem, c.criado_em, coalesce(p.nome_completo,
        case when exists(select 1 from public.lideres l where l.usuario_id=c.autor_id)
        then 'Liderança' else 'Integrante' end) as autor
      from public.chat_do_culto c left join public.musicos p on p.id=c.autor_id
      where c.escala_id=culto and (antes_de is null or c.id < antes_de) order by c.id desc limit 100
    ) m
  ) else '[]'::jsonb end;
end; $$;
revoke all on function public.ler_chat_do_culto(uuid,bigint) from public,anon;
grant execute on function public.ler_chat_do_culto(uuid,bigint) to authenticated;
create function public.proteger_historico_do_culto() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if now() >= coalesce(old.termino, old.inicio + interval '2 hours')
     and exists(select 1 from public.chat_do_culto where escala_id=old.id)
     and (new.inicio is distinct from old.inicio or new.termino is distinct from old.termino)
  then raise exception 'O horário de um chat arquivado não pode ser alterado'; end if;
  return new;
end; $$;
revoke all on function public.proteger_historico_do_culto() from public,anon,authenticated;
create trigger proteger_historico_do_culto before update of inicio,termino on public.escalas
for each row execute function public.proteger_historico_do_culto();
commit;
