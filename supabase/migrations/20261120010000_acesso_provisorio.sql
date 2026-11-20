begin;
create table public.acessos_provisorios (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  emissor uuid references auth.users(id) on delete cascade,
  email text not null,
  resumo bytea not null,
  expira_em timestamptz not null
);
alter table public.acessos_provisorios enable row level security;
revoke all on public.acessos_provisorios from public, anon, authenticated;

create function public.emitir_provisoria(destino text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  emissor_id uuid := auth.uid();
  alvo uuid;
  codigo text;
  administrador boolean := current_setting('role') = 'service_role'
    or (session_user = 'postgres' and current_setting('role') in ('none','postgres'));
begin
  if not administrador and not exists (
    select 1 from public.lideres where usuario_id = emissor_id
  ) then raise exception 'Sem autorização'; end if;
  select id into strict alvo from auth.users where lower(email) = lower(trim(destino))
    and deleted_at is null and email_confirmed_at is not null and not is_sso_user;
  if not administrador and (
    exists (select 1 from public.lideres where usuario_id = alvo)
    or not exists (select 1 from public.musicos where lower(email) = lower(trim(destino)))
  ) then raise exception 'Conta fora do alcance do líder'; end if;
  codigo := 'ADVE-' || encode(extensions.gen_random_bytes(16), 'hex');
  insert into public.acessos_provisorios values
    (alvo, case when not administrador then emissor_id end, lower(trim(destino)),
     pg_catalog.sha256(convert_to(codigo,'UTF8')), now() + interval '30 minutes')
  on conflict (usuario_id) do update set emissor = excluded.emissor, email = excluded.email,
    resumo = excluded.resumo, expira_em = excluded.expira_em;
  return codigo;
end;
$$;
revoke all on function public.emitir_provisoria(text) from public, anon;
grant execute on function public.emitir_provisoria(text) to authenticated, service_role;

create function public.consumir_provisoria(destino text, codigo text) returns uuid
language sql security definer set search_path = '' as $$
  delete from public.acessos_provisorios a using auth.users u
  where a.usuario_id = u.id and lower(u.email) = a.email and a.email = lower(trim(destino))
    and a.expira_em > now() and a.resumo = pg_catalog.sha256(convert_to(codigo,'UTF8'))
    and (a.emissor is null or (
      exists(select 1 from public.lideres where usuario_id = a.emissor)
      and not exists(select 1 from public.lideres where usuario_id = a.usuario_id)
      and exists(select 1 from public.musicos where lower(email) = a.email)))
  returning a.usuario_id;
$$;
revoke all on function public.consumir_provisoria(text,text) from public, anon, authenticated;
grant execute on function public.consumir_provisoria(text,text) to service_role;
commit;
