-- Pesquisa "Identificada" passa a devolver QUEM respondeu.
--
-- O BURACO, achado na auditoria de 11/09/2026: a coluna `respondente_id`
-- existe em `rh_pesquisa_respostas` e é preenchida, a página pública avisa
-- quem responde ("sua resposta fica associada ao seu perfil"), e o agregado
-- NUNCA devolvia a identidade. Resultado: o modo "Identificada" tinha o custo
-- de privacidade da identificação e nenhum benefício — era funcionalmente
-- igual ao anônimo, só que guardando o vínculo entre pessoa e resposta.
--
-- Decidido com o Daniel em 11/09/2026, sobre mockup: devolver o respondente,
-- e NÃO trocar o rótulo. Trocar o rótulo manteria o pior dos dois mundos; se
-- um dia for esse o caminho, o certo é parar de gravar `respondente_id`.
--
-- O QUE NÃO MUDA, e é o ponto mais importante desta migration: a pesquisa
-- ANÔNIMA continua idêntica. Mesmo piso de 5, mesmas respostas sem vínculo
-- nenhum, e `respondentes` volta VAZIO — não é "vazio porque a tela não pede",
-- é vazio porque o banco não devolve. Quem responde uma anônima foi avisado
-- de como o anonimato é garantido, e isso não se reabre por conveniência.
--
-- POR QUE UMA COLUNA NOVA, e não o nome dentro de cada resposta. Enfiar
-- `{"__respondente": "..."}` dentro do objeto de respostas misturaria
-- identidade com conteúdo no mesmo lugar onde a tela procura por CHAVE DE
-- PERGUNTA — uma pergunta chamada `__respondente` passaria a sobrescrever o
-- nome, e o contrário também. Duas colunas, com `order by` explícito e IGUAL
-- nos dois agregados, mantêm a correspondência por índice sem essa colisão.

drop function if exists public.pesquisa_respostas_aggregado(uuid);

create function public.pesquisa_respostas_aggregado(p_pesquisa_id uuid)
returns table(total bigint, respostas jsonb, respondentes jsonb, minimo int, liberado boolean)
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

  if coalesce(v_modo, 'anonima') = 'anonima' and v_total < v_min then
    return query select v_total, '[]'::jsonb, '[]'::jsonb, v_min, false;
    return;
  end if;

  return query
    select v_total,
           coalesce(jsonb_agg(r.respostas order by r.created_at, r.id), '[]'::jsonb),
           -- Identidade SÓ na identificada. Na anônima nem o join acontece.
           case when coalesce(v_modo, 'anonima') = 'identificada'
             then coalesce(jsonb_agg(coalesce(pr.name, 'Sem nome') order by r.created_at, r.id), '[]'::jsonb)
             else '[]'::jsonb
           end,
           v_min,
           true
    from public.rh_pesquisa_respostas r
    left join public.profiles pr
      on coalesce(v_modo, 'anonima') = 'identificada' and pr.id = r.respondente_id
    where r.pesquisa_id = p_pesquisa_id;
end;
$$;

revoke all on function public.pesquisa_respostas_aggregado(uuid) from public, anon;
grant execute on function public.pesquisa_respostas_aggregado(uuid) to authenticated;
