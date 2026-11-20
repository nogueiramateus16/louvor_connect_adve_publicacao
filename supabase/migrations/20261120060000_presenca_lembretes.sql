begin;
create table public.confirmacoes_escala (
 escala_id uuid not null references public.escalas(id) on delete cascade,
 integrante_id uuid not null references auth.users(id) on delete cascade,
 status text not null check(status in ('confirmado','ausente')),
 atualizado_em timestamptz not null default now(),
 primary key(escala_id,integrante_id)
);
alter table public.confirmacoes_escala enable row level security;
revoke all on public.confirmacoes_escala from public,anon,authenticated;
grant select,insert,update on public.confirmacoes_escala to authenticated;
create policy confirmacoes_leitura on public.confirmacoes_escala for select to authenticated
 using (integrante_id=auth.uid() or exists(select 1 from public.lideres where usuario_id=auth.uid()));
create policy confirmacoes_inserir on public.confirmacoes_escala for insert to authenticated
 with check(integrante_id=auth.uid() and exists(select 1 from public.escalas e where e.id=escala_id and integrante_id=any(e.integrantes)));
create policy confirmacoes_atualizar on public.confirmacoes_escala for update to authenticated
 using(integrante_id=auth.uid())
 with check(integrante_id=auth.uid() and exists(select 1 from public.escalas e where e.id=escala_id and integrante_id=any(e.integrantes)));
create function public.confirmacoes_timestamp() returns trigger language plpgsql set search_path='' as $$
begin new.atualizado_em=now(); return new; end $$;
create trigger confirmacoes_timestamp before update on public.confirmacoes_escala
for each row execute function public.confirmacoes_timestamp();
alter table public.notificacoes_escala alter column escala_id drop not null;
-- Um único lembrete por escala e integrante, mesmo que a rotina rode mais de uma vez.
alter table public.notificacoes_escala drop constraint if exists notificacoes_escala_tipo_check;
alter table public.notificacoes_escala add constraint notificacoes_escala_tipo_check
 check(tipo in ('escala_criada','adicionado_escala','lembrete_escala','aniversario'));
create unique index notificacoes_lembrete_unico
 on public.notificacoes_escala(escala_id,destinatario_id,tipo) where tipo='lembrete_escala';
create function public.gerar_lembretes_escalas()
returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.notificacoes_escala(destinatario_id,escala_id,tipo,titulo,escala_inicio)
 select distinct m.id,e.id,'lembrete_escala',e.titulo,e.inicio
 from public.escalas e cross join lateral unnest(e.integrantes) as integrante(id)
 join public.musicos m on m.id=integrante.id
 where e.inicio > now() and e.inicio <= now()+interval '24 hours'
 on conflict do nothing;
end $$;
revoke all on function public.gerar_lembretes_escalas() from public,anon,authenticated;
-- Aniversários: avisos para a equipe apenas com o primeiro nome, sem expor a data completa.
create table public.aniversarios_avisados (
 integrante_id uuid not null references public.musicos(id) on delete cascade,
 ano integer not null,
 primary key(integrante_id,ano)
);
alter table public.aniversarios_avisados enable row level security;
revoke all on public.aniversarios_avisados from public,anon,authenticated;
create unique index notificacoes_aniversario_unico
 on public.notificacoes_escala(destinatario_id,tipo,titulo,escala_inicio)
 where tipo='aniversario';
create function public.gerar_avisos_aniversario()
returns void language plpgsql security definer set search_path='' as $$
declare dia date := (now() at time zone 'America/Sao_Paulo')::date;
begin
 with aniversariantes as (
   insert into public.aniversarios_avisados(integrante_id,ano)
   select id,extract(year from dia)::integer from public.musicos
   where data_nascimento is not null
     and extract(month from data_nascimento)=extract(month from dia)
     and extract(day from data_nascimento)=extract(day from dia)
   on conflict do nothing returning integrante_id
 )
 insert into public.notificacoes_escala(destinatario_id,escala_id,tipo,titulo,escala_inicio)
 select distinct equipe.id,null::uuid,'aniversario','Aniversário de ' || split_part(trim(m.nome_completo),' ',1),now()
 from aniversariantes a
 join public.musicos m on m.id=a.integrante_id
 cross join public.musicos equipe;
end $$;
revoke all on function public.gerar_avisos_aniversario() from public,anon,authenticated;
commit;
