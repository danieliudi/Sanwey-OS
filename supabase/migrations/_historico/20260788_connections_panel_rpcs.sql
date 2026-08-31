-- Painel "Conexões" (estilo Pipefy) — 2 RPCs SECURITY DEFINER que devolvem,
-- de uma vez só, os registros de outras tabelas vinculados a um colaborador
-- ou a um cliente, agrupados por domínio. Evita 5-6 queries client-side
-- separadas (cada uma sob a RLS própria da tabela) — igual ao padrão já
-- usado em get_my_colaborador() (20260740_colaborador_portal_role.sql).
-- Presentação (labels/cores de etapa) fica por conta do frontend, que já
-- tem essa lógica por domínio — a RPC só devolve os dados crus.

CREATE OR REPLACE FUNCTION public.get_colaborador_connections(p_colaborador_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT (
    current_user_is_admin()
    OR current_user_has_role('gerente_rh')
    OR current_user_has_role('rh')
    OR current_user_has_role('diretoria')
    OR EXISTS (SELECT 1 FROM public.rh_colaboradores WHERE id = p_colaborador_id AND profile_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Sem permissão pra ver conexões deste colaborador';
  END IF;

  SELECT jsonb_build_object(
    'avaliacoes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'tipo', a.tipo, 'cycle', a.cycle, 'status', a.status,
        'period_start', a.period_start, 'period_end', a.period_end,
        'final_rating', a.final_rating, 'created_at', a.created_at
      ) ORDER BY a.created_at DESC)
      FROM public.rh_avaliacoes a WHERE a.user_id = p_colaborador_id
    ), '[]'::jsonb),
    'movimentacoes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'tipo', m.tipo, 'cargo_novo', m.cargo_novo, 'status', m.status,
        'effective_date', m.effective_date, 'created_at', m.created_at
      ) ORDER BY m.created_at DESC)
      FROM public.rh_movimentacoes m WHERE m.colaborador_id = p_colaborador_id
    ), '[]'::jsonb),
    'treinamentos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ta.id, 'titulo', t.titulo, 'status', ta.status,
        'data_conclusao', ta.data_conclusao, 'created_at', ta.created_at
      ) ORDER BY ta.created_at DESC)
      FROM public.rh_treinamento_atribuicoes ta
      JOIN public.rh_treinamentos t ON t.id = ta.treinamento_id
      WHERE ta.colaborador_id = p_colaborador_id
    ), '[]'::jsonb),
    'beneficios', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', b.id, 'nome', bc.nome_exibicao, 'status', b.status, 'valor', b.valor,
        'created_at', b.solicitado_em
      ) ORDER BY b.solicitado_em DESC)
      FROM public.rh_colaborador_beneficios b
      JOIN public.rh_beneficios_catalogo bc ON bc.id = b.beneficio_catalogo_id
      WHERE b.colaborador_id = p_colaborador_id
    ), '[]'::jsonb),
    'solicitacoes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'field', s.field, 'status', s.status, 'created_at', s.created_at
      ) ORDER BY s.created_at DESC)
      FROM public.rh_data_update_requests s WHERE s.colaborador_id = p_colaborador_id
    ), '[]'::jsonb),
    'ferias', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', f.id, 'type', f.type, 'status', f.status,
        'start_date', f.start_date, 'end_date', f.end_date, 'created_at', f.created_at
      ) ORDER BY f.created_at DESC)
      FROM public.rh_ferias f WHERE f.user_id = p_colaborador_id
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_colaborador_connections(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_colaborador_connections(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_colaborador_connections(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_client_connections(p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT (
    current_user_is_admin()
    OR current_user_has_role('gerente')
    OR current_user_has_role('vendedor')
    OR current_user_has_role('consultor')
    OR current_user_has_role('diretoria')
  ) THEN
    RAISE EXCEPTION 'Sem permissão pra ver conexões deste cliente';
  END IF;

  SELECT jsonb_build_object(
    'negocios', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id, 'company', l.company, 'stage', l.stage, 'value', l.value,
        'owner', l.owner, 'created_at', l.created_at
      ) ORDER BY l.created_at DESC)
      FROM public.leads l WHERE l.client_id = p_client_id
    ), '[]'::jsonb),
    'viagens', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', v.id, 'destino_planejado', v.destino_planejado, 'status', v.status,
        'data_planejada', v.data_planejada, 'vendedor_id', v.vendedor_id, 'created_at', v.created_at
      ) ORDER BY v.created_at DESC)
      FROM public.crm_viagem_registros v WHERE v.client_id = p_client_id
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_client_connections(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_client_connections(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_client_connections(uuid) TO authenticated;
