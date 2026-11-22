begin;
alter table public.escalas add column if not exists termino timestamptz;
alter table public.repertorio add column if not exists trecho text not null default '';
alter table public.repertorio add column if not exists audio text not null default '';
alter table public.repertorio add constraint repertorio_audio_url check(audio = '' or audio ~* '^https?://');
create table if not exists public.mensagens_culto (
 id uuid primary key default gen_random_uuid(),
 escala_id uuid not null references public.escalas(id) on delete cascade,
 autor_id uuid not null default auth.uid() references auth.users(id),
 mensagem text not null check(length(trim(mensagem)) between 1 and 1000),
 criado_em timestamptz not null default now()
);
create index if not exists mensagens_culto_escala_data on public.mensagens_culto(escala_id,criado_em);
alter table public.mensagens_culto enable row level security;
revoke all on public.mensagens_culto from public,anon,authenticated;
grant select on public.mensagens_culto to authenticated;
grant insert(escala_id, mensagem) on public.mensagens_culto to authenticated;
create policy mensagens_culto_leitura on public.mensagens_culto for select to authenticated using (
 exists(select 1 from public.lideres where usuario_id = auth.uid())
 or exists(select 1 from public.escalas e where e.id = escala_id and auth.uid() = any(e.integrantes)
    and now() >= e.inicio and now() < e.termino)
);
create policy mensagens_culto_envio on public.mensagens_culto for insert to authenticated with check (
 autor_id = auth.uid() and exists(select 1 from public.escalas e where e.id = escala_id
 and now() >= e.inicio and now() < e.termino
 and (auth.uid() = any(e.integrantes) or exists(select 1 from public.lideres where usuario_id = auth.uid())))
);
commit;
