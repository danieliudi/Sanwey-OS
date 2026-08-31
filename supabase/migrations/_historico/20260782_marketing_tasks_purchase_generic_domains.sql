-- Padronização do modal de card (docs/design-spec-padronizacao-modal-card.md,
-- Seção 6) — aprovado pelo Daniel em 27/07/2026 ("Pode incluir para Tarefas e
-- Compras e no modelo genérico para sempre"): dá Anexos/Checklist a Tarefas e
-- Compras de Marketing, e Atividades a Compras, reaproveitando as tabelas
-- genéricas por domínio que o RH já usa (rh_attachments/rh_checklists,
-- domain+record_id) em vez de criar uma 3ª variante de tabela de anexo —
-- mesmo racional documentado na spec: rh_attachments já foi ampliado 2x
-- (20260709_widen_rh_attachments_domain.sql, 20260716_rh_fornecedores_beneficios.sql).

-- 1. Atividades em Compras — mesmo molde de marketing_tasks.activities
--    (20260764_marketing_tasks.sql:29). marketing_purchase_requests nunca
--    teve essa coluna (motor de aprovação é RPC-based, não genérico).
ALTER TABLE public.marketing_purchase_requests
  ADD COLUMN IF NOT EXISTS activities jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Popular activities nas 2 transições guardadas por RPC (aprovar/rejeitar).
--    As demais transições (solicitado->cotacao, aprovado->pedido_fornecedor,
--    etc.) são client-side .update() — o append de activity nesses casos é
--    responsabilidade do frontend, mesmo padrão já usado em
--    MarketingTaskDetailDrawer.jsx (handleFieldChange/handleMoveStage).
CREATE OR REPLACE FUNCTION public.approve_purchase_request(p_id uuid, p_responsible_id uuid DEFAULT NULL::uuid, p_supplier_id uuid DEFAULT NULL::uuid)
 RETURNS marketing_purchase_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.marketing_purchase_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF NOT (current_user_is_admin() OR current_user_has_role('marketing') OR current_user_has_role('gerente_marketing')) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar solicitações de compra';
  END IF;

  SELECT * INTO v_row FROM public.marketing_purchase_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;
  IF v_row.stage NOT IN ('solicitado', 'cotacao') THEN
    RAISE EXCEPTION 'Solicitação já foi decidida';
  END IF;

  UPDATE public.marketing_purchase_requests
  SET stage = 'aprovado', approved_by = v_uid, approved_at = now(),
      responsible_id = coalesce(p_responsible_id, responsible_id, v_uid),
      supplier_id = coalesce(p_supplier_id, supplier_id),
      total_value = coalesce(
        (SELECT (elem->>'value')::numeric
           FROM jsonb_array_elements(v_row.quote_options) elem
          WHERE p_supplier_id IS NOT NULL AND elem->>'supplierId' = p_supplier_id::text),
        total_value
      ),
      activities = coalesce(v_row.activities, '[]'::jsonb) || jsonb_build_object(
        'type', 'stage_change', 'description', 'Aprovado', 'at', now()
      )
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF v_row.requested_by IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, link, created_by)
    SELECT v_row.requested_by, 'purchase_request_approved',
           'Sua solicitação de compra foi aprovada',
           v_row.item_name || ' (' || v_row.request_number || ')',
           jsonb_build_object('module', 'purchase_requests', 'id', v_row.id),
           v_uid
    WHERE EXISTS (SELECT 1 FROM public.profiles WHERE id = v_row.requested_by AND mention_notifications_enabled = true);
  END IF;

  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_purchase_request(p_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS marketing_purchase_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.marketing_purchase_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF NOT (current_user_is_admin() OR current_user_has_role('marketing') OR current_user_has_role('gerente_marketing')) THEN
    RAISE EXCEPTION 'Sem permissão para rejeitar solicitações de compra';
  END IF;

  SELECT * INTO v_row FROM public.marketing_purchase_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;
  IF v_row.stage NOT IN ('solicitado', 'cotacao') THEN
    RAISE EXCEPTION 'Solicitação já foi decidida';
  END IF;

  UPDATE public.marketing_purchase_requests
  SET stage = 'rejeitado', approved_by = v_uid, approved_at = now(), rejected_reason = p_reason,
      activities = coalesce(v_row.activities, '[]'::jsonb) || jsonb_build_object(
        'type', 'stage_change',
        'description', CASE WHEN p_reason IS NOT NULL THEN 'Rejeitado: ' || p_reason ELSE 'Rejeitado' END,
        'at', now()
      )
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF v_row.requested_by IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, link, created_by)
    SELECT v_row.requested_by, 'purchase_request_rejected',
           'Sua solicitação de compra foi rejeitada',
           v_row.item_name || ' (' || v_row.request_number || ')',
           jsonb_build_object('module', 'purchase_requests', 'id', v_row.id),
           v_uid
    WHERE EXISTS (SELECT 1 FROM public.profiles WHERE id = v_row.requested_by AND mention_notifications_enabled = true);
  END IF;

  RETURN v_row;
END;
$function$;

-- 3. Anexos em Tarefas e Compras — amplia o CHECK de rh_attachments.domain
--    (3ª ampliação do mesmo constraint, mesmo padrão das 2 anteriores).
ALTER TABLE public.rh_attachments
  DROP CONSTRAINT rh_attachments_domain_check,
  ADD CONSTRAINT rh_attachments_domain_check
    CHECK (domain = ANY (ARRAY[
      'vagas','candidatos','onboarding','feedback','ferias','treinamentos',
      'fornecedor_contratos','marketing_tasks','marketing_purchase_requests'
    ]));

-- 4. Checklist em Tarefas e Compras — mesma ampliação em rh_checklists.domain
--    (nunca tinha sido ampliado antes; era hardcoded a vagas/candidatos).
ALTER TABLE public.rh_checklists
  DROP CONSTRAINT rh_checklists_domain_check,
  ADD CONSTRAINT rh_checklists_domain_check
    CHECK (domain = ANY (ARRAY[
      'vagas','candidatos','marketing_tasks','marketing_purchase_requests'
    ]));

-- 5. RLS: usuários de marketing (marketing/gerente_marketing/admin — mesmo
--    critério de marketing_tasks_select/marketing_purchase_requests_read,
--    current_user_is_marketing(), sem carve-out de agência) precisam
--    conseguir ler/escrever linhas de rh_attachments/rh_checklists nos 2
--    domínios novos. As policies rh_attachments_rh_access/
--    rh_checklists_rh_access continuam intocadas (só RH) — esta é uma
--    policy ADICIONAL, escopada por domain, então nenhum acesso existente
--    muda (Postgres RLS combina policies permissivas com OR).
CREATE POLICY rh_attachments_marketing_access ON public.rh_attachments FOR ALL
  USING (
    domain = ANY (ARRAY['marketing_tasks','marketing_purchase_requests']) AND current_user_is_marketing()
  )
  WITH CHECK (
    domain = ANY (ARRAY['marketing_tasks','marketing_purchase_requests']) AND current_user_is_marketing()
  );

CREATE POLICY rh_checklists_marketing_access ON public.rh_checklists FOR ALL
  USING (
    domain = ANY (ARRAY['marketing_tasks','marketing_purchase_requests']) AND current_user_is_marketing()
  )
  WITH CHECK (
    domain = ANY (ARRAY['marketing_tasks','marketing_purchase_requests']) AND current_user_is_marketing()
  );

-- 6. Achado adjacente corrigido de passagem: rh_checklists_rh_access ainda
--    checava profiles.role (cargo ESCALAR) em vez de profiles.roles (array)
--    — a mesma classe de bug já corrigida em rh_attachments_rh_access
--    (20260739_rh_attachments_holerite_ponto_self_read.sql:18-31: alguém com
--    'rh'/'gerente_rh' como cargo SECUNDÁRIO não conseguia gerenciar
--    checklist nenhum). Alinha ao mesmo padrão current_user_is_admin()/
--    current_user_has_role() usado em toda a plataforma.
DROP POLICY IF EXISTS rh_checklists_rh_access ON public.rh_checklists;
CREATE POLICY rh_checklists_rh_access ON public.rh_checklists FOR ALL
  USING (
    current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh')
  )
  WITH CHECK (
    current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh')
  );
