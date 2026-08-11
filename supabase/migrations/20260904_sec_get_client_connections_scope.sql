-- SEGURANÇA — get_client_connections (criada em 20260788_connections_panel_rpcs.sql)
-- lê leads e crm_viagem_registros como SECURITY DEFINER e o portão era APENAS
-- de papel: current_user_is_admin() OR has_role('gerente'|'vendedor'|
-- 'consultor'|'diretoria'). Nenhuma checagem de empresa — nem no cliente, nem
-- nos negócios, nem nas viagens. Como continua com GRANT EXECUTE TO
-- authenticated, está exposta via PostgREST (POST /rest/v1/rpc/...).
--
-- Reproduzido em produção (transação com rollback) com Clayton Yokoi
-- (role 'vendedor', companies = {}): `select count(*) from clients` e
-- `from leads` devolvem 0 pela RLS, e a RPC devolvia mesmo assim
-- {"negocios":[{... "value":1000, "stage":"qualificacao", "owner":"0770daf2-…"}]}
-- de um cliente que ele não pode nem listar — bastava iterar uuids de clients
-- pra varrer o Grupo inteiro.
--
-- Correção: colar nela o MESMO portão de get_client_timeline (regra 3.1 do
-- CLAUDE.md — policy nova espelha o predicado que já roda em produção na
-- tabela-irmã, não inventa modelo) e escopar os dois SELECTs:
--   * leads      → l.company_id = ANY(current_user_companies())
--   * viagens    → crm_viagem_registros não tem company_id; a empresa vem do
--                  vendedor (profiles.companies), igual ao que
--                  current_user_manages_viagem_of já faz.
--
-- NOTA (não aplicada aqui, precisa de decisão do Daniel — regra 5): esta
-- função ficou SEM CONSUMIDOR quando a aba "Conexões" virou "Histórico"
-- (src/hooks/use-client-connections.js não é importado por ninguém). O
-- conserto mais barato a longo prazo é DROP FUNCTION + apagar o hook. Este
-- arquivo só fecha o vazamento sem destruir nada.

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
  IF p_client_id IS NULL THEN
    RETURN jsonb_build_object('negocios', '[]'::jsonb, 'viagens', '[]'::jsonb);
  END IF;

  IF NOT (
    current_user_is_admin()
    OR current_user_has_role('diretoria')
    OR (
      (current_user_roles() && ARRAY['gerente','vendedor','consultor'])
      AND EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = p_client_id
          AND c.company_ids && current_user_companies()
      )
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão pra ver conexões deste cliente';
  END IF;

  SELECT jsonb_build_object(
    'negocios', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id, 'company', l.company, 'stage', l.stage, 'value', l.value,
        'owner', l.owner, 'created_at', l.created_at
      ) ORDER BY l.created_at DESC)
      FROM public.leads l
      WHERE l.client_id = p_client_id
        AND (
          current_user_is_admin()
          OR current_user_has_role('diretoria')
          OR l.company_id = ANY (current_user_companies())
        )
    ), '[]'::jsonb),
    'viagens', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', v.id, 'destino_planejado', v.destino_planejado, 'status', v.status,
        'data_planejada', v.data_planejada, 'vendedor_id', v.vendedor_id, 'created_at', v.created_at
      ) ORDER BY v.created_at DESC)
      FROM public.crm_viagem_registros v
      WHERE v.client_id = p_client_id
        AND (
          current_user_is_admin()
          OR current_user_has_role('diretoria')
          OR EXISTS (
            SELECT 1 FROM public.profiles vp
            WHERE vp.id = v.vendedor_id
              AND vp.companies && current_user_companies()
          )
        )
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_client_connections(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_client_connections(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_client_connections(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_client_connections(uuid) IS
  'Painel "Conexões" do cliente. Portão espelha get_client_timeline/client_billing_history_read '
  '(admin OR diretoria OR (gerente|vendedor|consultor com clients.company_ids && '
  'current_user_companies())); negócios recortados por company_id e viagens pela empresa do '
  'vendedor. SEM CONSUMIDOR desde que a aba virou "Histórico" — candidata a DROP.';
