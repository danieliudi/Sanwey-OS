-- Vínculo agência ↔ fornecedor de marketing. Hoje só existe UMA agência
-- cadastrada, então o comportamento abaixo é retrocompatível por design: sem
-- nenhum profiles.supplier_id preenchido, tudo continua visível pra quem tem
-- role='agencia' (nenhuma trava se ativa sozinha). A trava só passa a valer
-- quando o admin vincula um login de agência a UM fornecedor específico em
-- Configurações → Usuários, e a campanha/entregável também estiver vinculado
-- a esse mesmo fornecedor — deixa o mecanismo pronto pra quando houver mais
-- de uma agência, sem quebrar o acesso da única agência de hoje.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.marketing_suppliers(id) ON DELETE SET NULL;

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.marketing_suppliers(id) ON DELETE SET NULL;

ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.marketing_suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_supplier_id_idx ON public.profiles(supplier_id);
CREATE INDEX IF NOT EXISTS mc_supplier_id_idx        ON public.marketing_campaigns(supplier_id);

-- Encapsula "esse usuário agência enxerga item deste fornecedor?" — true
-- quando o item não tem fornecedor vinculado (nada pra escopar ainda), quando
-- o PRÓPRIO login de agência não tem fornecedor vinculado (não configurado =
-- sem trava, preserva o comportamento de hoje), ou quando os dois batem.
CREATE OR REPLACE FUNCTION public.agencia_sees_supplier(p_supplier_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    current_user_role() = 'agencia'
    AND (
      p_supplier_id IS NULL
      OR (SELECT supplier_id FROM public.profiles WHERE id = auth.uid()) IS NULL
      OR (SELECT supplier_id FROM public.profiles WHERE id = auth.uid()) = p_supplier_id
    );
$function$;

REVOKE EXECUTE ON FUNCTION public.agencia_sees_supplier(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.agencia_sees_supplier(uuid) TO authenticated;

-- marketing_campaigns
DROP POLICY IF EXISTS mc_read ON public.marketing_campaigns;
CREATE POLICY mc_read ON public.marketing_campaigns FOR SELECT USING (
  current_user_is_marketing()
  OR agencia_sees_supplier(supplier_id)
);

-- marketing_campaign_attachments (join até a campanha)
DROP POLICY IF EXISTS mca_read ON public.marketing_campaign_attachments;
CREATE POLICY mca_read ON public.marketing_campaign_attachments FOR SELECT USING (
  current_user_is_marketing()
  OR agencia_sees_supplier((SELECT supplier_id FROM public.marketing_campaigns WHERE id = campaign_id))
);

DROP POLICY IF EXISTS mca_insert ON public.marketing_campaign_attachments;
CREATE POLICY mca_insert ON public.marketing_campaign_attachments FOR INSERT WITH CHECK (
  current_user_is_marketing()
  OR agencia_sees_supplier((SELECT supplier_id FROM public.marketing_campaigns WHERE id = campaign_id))
);

-- marketing_deliverables — md_select (criação original) e deliverables_select
-- (correção de exposição de 13/07) coexistiam com a MESMA condição não
-- escopada; como policies permissivas se combinam por OR, escopar só uma
-- delas não travaria nada. Colapsa as duas numa só, já escopada.
DROP POLICY IF EXISTS md_select ON public.marketing_deliverables;
DROP POLICY IF EXISTS deliverables_select ON public.marketing_deliverables;
CREATE POLICY deliverables_select ON public.marketing_deliverables FOR SELECT USING (
  current_user_is_marketing()
  OR agencia_sees_supplier((SELECT supplier_id FROM public.marketing_campaigns WHERE id = campaign_id))
);

-- marketing_deliverable_attachments (join até a campanha via deliverable_id)
DROP POLICY IF EXISTS "Deliverable attachments table read" ON public.marketing_deliverable_attachments;
CREATE POLICY "Deliverable attachments table read" ON public.marketing_deliverable_attachments FOR SELECT USING (
  current_user_is_marketing()
  OR agencia_sees_supplier((
    SELECT mc.supplier_id FROM public.marketing_deliverables md
    JOIN public.marketing_campaigns mc ON mc.id = md.campaign_id
    WHERE md.id = deliverable_id
  ))
);

DROP POLICY IF EXISTS "Deliverable attachments table insert" ON public.marketing_deliverable_attachments;
CREATE POLICY "Deliverable attachments table insert" ON public.marketing_deliverable_attachments FOR INSERT WITH CHECK (
  current_user_is_marketing()
  OR agencia_sees_supplier((
    SELECT mc.supplier_id FROM public.marketing_deliverables md
    JOIN public.marketing_campaigns mc ON mc.id = md.campaign_id
    WHERE md.id = deliverable_id
  ))
);
