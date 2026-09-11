-- Pesquisa anônima passa a exigir um mínimo de respondentes.
--
-- Aprovado pelo Daniel em 10/09/2026, no mockup das lacunas de RH: mínimo de
-- CINCO respostas.
--
-- O PROBLEMA. `pesquisa_respostas_aggregado` devolvia `jsonb_agg(respostas)` —
-- ou seja, as respostas individuais, uma a uma, sem piso nenhum. A tela então
-- renderiza cada resposta aberta num balão (RHComunicacaoView.jsx:334). Numa
-- empresa de 15 pessoas, duas respostas abertas identificam quem escreveu:
-- pelo assunto, pelo jeito de escrever, por quem reclama do quê.
--
-- Não era falha de permissão — só RH/admin/gerente_rh chegam aqui, e isso
-- continua igual. Era a palavra "anônima" não valendo nada. E o gate tem que
-- estar AQUI, não na tela: a função é chamável direto por quem tem o token.
--
-- O piso vale só pra pesquisa `anonima`. Em pesquisa `identificada` a pessoa
-- sabe que está assinando, então esconder resultado não protege ninguém — só
-- atrapalha o RH.
--
-- Assinatura muda (dois campos novos), então é DROP e CREATE, não REPLACE.

drop function if exists public.pesquisa_respostas_aggregado(uuid);

create function public.pesquisa_respostas_aggregado(p_pesquisa_id uuid)
returns table(total bigint, respostas jsonb, minimo int, liberado boolean)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_min  constant int := 5;
  v_modo text;
  v_total bigint;
begin
  if not (current_user_is_admin() or current_user_has_role('gerente_rh') or current_user_has_role('rh')) then
    raise exception 'Sem permissão';
  end if;

  select p.modo into v_modo from public.rh_pesquisas p where p.id = p_pesquisa_id;

  select count(*) into v_total
  from public.rh_pesquisa_respostas r
  where r.pesquisa_id = p_pesquisa_id;

  -- Abaixo do piso, devolve a CONTAGEM e nada mais. A contagem pode aparecer
  -- porque saber que 3 pessoas responderam não diz quem nem o quê.
  if coalesce(v_modo, 'anonima') = 'anonima' and v_total < v_min then
    return query select v_total, '[]'::jsonb, v_min, false;
    return;
  end if;

  return query
    select v_total,
           coalesce(jsonb_agg(r.respostas), '[]'::jsonb),
           v_min,
           true
    from public.rh_pesquisa_respostas r
    where r.pesquisa_id = p_pesquisa_id;
end;
$$;

revoke all on function public.pesquisa_respostas_aggregado(uuid) from public, anon;
grant execute on function public.pesquisa_respostas_aggregado(uuid) to authenticated;
