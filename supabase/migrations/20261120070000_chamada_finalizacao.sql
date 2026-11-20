begin;

create table public.cultos_finalizados (
  escala_id uuid primary key references public.escalas(id) on delete cascade,
  finalizado_em timestamptz not null default now()
);

create table public.chamada_culto (
  escala_id uuid not null references public.escalas(id) on delete cascade,
  integrante_id uuid not null references public.musicos(id) on delete cascade,
  presente boolean not null,
  primary key (escala_id, integrante_id)
);

alter table public.cultos_finalizados enable row level security;
alter table public.chamada_culto enable row level security;
revoke all on public.cultos_finalizados, public.chamada_culto from public, anon, authenticated;
grant select on public.cultos_finalizados, public.chamada_culto to authenticated;

create policy finalizacao_leitura on public.cultos_finalizados for select to authenticated
  using (exists (select 1 from public.escalas e where e.id = escala_id));
create policy chamada_leitura_lider on public.chamada_culto for select to authenticated
  using (exists (select 1 from public.lideres where usuario_id = auth.uid()));

create function public.registrar_chamada_culto(escala uuid, integrante uuid, compareceu boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.lideres where usuario_id = auth.uid()) then
    raise exception 'Somente o líder pode fazer a chamada.' using errcode = '42501';
  end if;
  perform 1 from public.escalas e where e.id = escala and e.inicio <= now()
    and integrante = any(e.integrantes) for update;
  if not found or exists (select 1 from public.cultos_finalizados where escala_id = escala) then
    raise exception 'A chamada está fechada para esta escala ou integrante.';
  end if;
  insert into public.chamada_culto(escala_id, integrante_id, presente)
    values (escala, integrante, compareceu)
    on conflict (escala_id, integrante_id) do update set presente = excluded.presente;
end;
$$;

create function public.finalizar_culto(escala uuid)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare encerrado timestamptz;
begin
  if not exists (select 1 from public.lideres where usuario_id = auth.uid()) then
    raise exception 'Somente o líder pode finalizar o culto.' using errcode = '42501';
  end if;
  perform 1 from public.escalas e where e.id = escala and e.inicio <= now() for update;
  if not found then
    raise exception 'O culto precisa ter começado.';
  end if;
  insert into public.cultos_finalizados(escala_id) values (escala)
    on conflict (escala_id) do nothing;
  select finalizado_em into encerrado from public.cultos_finalizados where escala_id = escala;
  return encerrado;
end;
$$;

revoke all on function public.registrar_chamada_culto(uuid, uuid, boolean), public.finalizar_culto(uuid)
  from public, anon, authenticated;
grant execute on function public.registrar_chamada_culto(uuid, uuid, boolean), public.finalizar_culto(uuid)
  to authenticated;

alter policy mensagens_culto_leitura on public.mensagens_culto using (
  exists (select 1 from public.lideres where usuario_id = auth.uid())
  or (not exists (select 1 from public.cultos_finalizados f where f.escala_id = mensagens_culto.escala_id)
    and exists (select 1 from public.escalas e where e.id = escala_id
      and auth.uid() = any(e.integrantes) and now() >= e.inicio and now() < e.termino))
);

alter policy mensagens_culto_envio on public.mensagens_culto with check (
  autor_id = auth.uid()
  and not exists (select 1 from public.cultos_finalizados f where f.escala_id = mensagens_culto.escala_id)
  and exists (select 1 from public.escalas e where e.id = escala_id and now() >= e.inicio
    and now() < e.termino and (auth.uid() = any(e.integrantes)
      or exists (select 1 from public.lideres where usuario_id = auth.uid())))
);

commit;
