begin;

alter table public.escalas add column ministrador_id uuid;
alter table public.escalas add constraint escalas_ministrador_na_equipe
  check (ministrador_id is null or array_position(integrantes, ministrador_id) is not null);

create function public.salvar_musicas_da_escala(
  escala uuid, musicas_anteriores uuid[], novas_musicas uuid[]
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if novas_musicas is null or exists (
    select 1 from unnest(novas_musicas) as musica(id)
    where not exists (select 1 from public.repertorio r where r.id = musica.id)
  ) then
    raise exception 'Selecione músicas do repertório';
  end if;

  update public.escalas e
  set musicas = novas_musicas
  where e.id = escala
    and e.musicas = musicas_anteriores
    and (exists (select 1 from public.lideres l where l.usuario_id = auth.uid())
      or (e.ministrador_id = auth.uid() and auth.uid() = any(e.integrantes)));

  if not found then
    raise exception 'A escala foi alterada ou você não tem autorização';
  end if;
end;
$$;

revoke all on function public.salvar_musicas_da_escala(uuid,uuid[],uuid[]) from public, anon;
grant execute on function public.salvar_musicas_da_escala(uuid,uuid[],uuid[]) to authenticated;

commit;
