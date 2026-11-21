begin;
create table public.notificacoes_escala (
 id uuid primary key default gen_random_uuid(),
 destinatario_id uuid not null references auth.users(id) on delete cascade,
 escala_id uuid not null references public.escalas(id) on delete cascade,
 tipo text not null check(tipo in ('escala_criada','adicionado_escala')),
 titulo text not null,
 escala_inicio timestamptz not null,
 criado_em timestamptz not null default now(),
 lida_em timestamptz
);
create index notificacoes_escala_usuario_data on public.notificacoes_escala(destinatario_id,criado_em desc);
alter table public.notificacoes_escala enable row level security;
revoke all on public.notificacoes_escala from public,anon,authenticated;
grant select on public.notificacoes_escala to authenticated;
grant update(lida_em) on public.notificacoes_escala to authenticated;
create policy notificacoes_escala_proprio_select on public.notificacoes_escala
 for select to authenticated using (destinatario_id = auth.uid());
create policy notificacoes_escala_proprio_update on public.notificacoes_escala
 for update to authenticated using (destinatario_id = auth.uid())
 with check(destinatario_id = auth.uid());
create function public.avisar_integrantes_escala()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Em criação, avisar todos os incluídos; na edição, apenas novos integrantes.
  if tg_op = 'INSERT' then
    insert into public.notificacoes_escala(destinatario_id,escala_id,tipo,titulo,escala_inicio)
    select distinct pessoa, new.id, 'escala_criada', new.titulo,new.inicio
    from unnest(new.integrantes) as pessoa;
  else
    insert into public.notificacoes_escala(destinatario_id,escala_id,tipo,titulo,escala_inicio)
    select distinct pessoa, new.id, 'adicionado_escala', new.titulo,new.inicio
    from unnest(new.integrantes) as pessoa
    where not (pessoa = any(old.integrantes));
  end if;
  return new;
end; $$;
revoke all on function public.avisar_integrantes_escala() from public,anon,authenticated;
create trigger avisar_integrantes_escala
after insert or update of integrantes on public.escalas
for each row execute function public.avisar_integrantes_escala();
commit;
