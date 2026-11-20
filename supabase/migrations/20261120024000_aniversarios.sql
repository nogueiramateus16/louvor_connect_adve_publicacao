begin;
create function public.avisos_de_aniversario()
returns table (id text, dia date, mensagem text)
language sql stable security definer set search_path = '' as $$
  with dias as (
    select (current_timestamp at time zone 'America/Sao_Paulo')::date - n as dia
    from generate_series(0, 6) as n
  )
  select m.id::text || ':' || d.dia::text, d.dia,
         '🎉 Parabéns, ' || m.nome_completo || '! Que Deus abençoe seu novo ciclo. Um abraço de toda a equipe do Louvor Connect ADVE!'
  from public.musicos m
  join dias d on (
    extract(month from d.dia) = extract(month from m.data_nascimento)
    and (
      extract(day from d.dia) = extract(day from m.data_nascimento)
      or (extract(month from d.dia) = 2 and extract(day from d.dia) = 28
          and extract(day from m.data_nascimento) = 29 and extract(month from d.dia + 1) = 3)
    )
  )
  where auth.uid() is not null and (
    exists (select 1 from public.lideres where usuario_id = auth.uid())
    or exists (select 1 from public.musicos where id = auth.uid())
  )
  order by d.dia desc, m.nome_completo, m.id;
$$;
revoke all on function public.avisos_de_aniversario() from public, anon, authenticated;
grant execute on function public.avisos_de_aniversario() to authenticated;
commit;
