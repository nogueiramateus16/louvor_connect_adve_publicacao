begin;
alter table public.musicos add column if not exists data_nascimento date;
create function public.salvar_meu_cadastro(nome text, contato text, nascimento date, email_informado text)
returns void language plpgsql security definer set search_path='' as $$
declare conta auth.users%rowtype;
begin
  select * into strict conta from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if conta.invited_at is null and not exists(select 1 from public.musicos where id=conta.id)
     and not exists(select 1 from public.lideres where usuario_id=conta.id)
  then raise exception 'Convite necessário'; end if;
  if lower(trim(email_informado)) is distinct from lower(conta.email)
    or coalesce(length(trim(nome)),0) not between 2 and 120
    or coalesce(contato,'') !~ '^[+0-9 ().-]{8,25}$'
    or nascimento is null or nascimento > current_date or nascimento < date '1900-01-01'
  then raise exception 'Confira os dados do cadastro'; end if;
  insert into public.musicos(id,nome_completo,telefone,email,data_nascimento)
    values(conta.id,trim(nome),trim(contato),conta.email,nascimento)
  on conflict(id) do update set nome_completo=excluded.nome_completo, telefone=excluded.telefone,
    email=excluded.email,data_nascimento=excluded.data_nascimento;
end; $$;
revoke all on function public.salvar_meu_cadastro(text,text,date,text) from public,anon;
grant execute on function public.salvar_meu_cadastro(text,text,date,text) to authenticated;
create table public.repertorio (
  id uuid primary key default gen_random_uuid(), titulo text not null check(length(trim(titulo)) between 1 and 180),
  artista text not null default '', tom text not null default '', cifra text not null default '' check(cifra='' or cifra ~* '^https?://'),
  notas text not null default ''
);
create table public.escalas (
  id uuid primary key default gen_random_uuid(), titulo text not null check(length(trim(titulo)) between 1 and 180),
  inicio timestamptz not null, integrantes uuid[] not null default '{}', musicas uuid[] not null default '{}', notas text not null default ''
);
alter table public.repertorio enable row level security;
alter table public.escalas enable row level security;
revoke all on public.repertorio,public.escalas from anon, public, authenticated;
grant select,insert,update on public.repertorio,public.escalas to authenticated;
create policy repertorio_leitura on public.repertorio for select to authenticated using (
  exists(select 1 from public.musicos where id=auth.uid()) or exists(select 1 from public.lideres where usuario_id=auth.uid()));
create policy escalas_leitura on public.escalas for select to authenticated using (
  auth.uid()=any(integrantes) or exists(select 1 from public.lideres where usuario_id=auth.uid()));
create policy repertorio_lider on public.repertorio for all to authenticated using (
  exists(select 1 from public.lideres where usuario_id=auth.uid())) with check (
  exists(select 1 from public.lideres where usuario_id=auth.uid()));
create policy escalas_lider on public.escalas for all to authenticated using (
  exists(select 1 from public.lideres where usuario_id=auth.uid())) with check (
  exists(select 1 from public.lideres where usuario_id=auth.uid()));
commit;
