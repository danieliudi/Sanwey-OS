-- FASE 5 (parte 2): leads.owner fica de fora do migration genérico
-- (20260714_multi_responsible_foundation.sql) por dois motivos reais: é
-- `text` (não uuid, comparado sempre via auth.uid()::text) e é a ÚNICA
-- coluna de responsável em toda a plataforma onde a RLS de visibilidade
-- depende diretamente do valor — vendedor só vê o que é dele (ou de
-- subordinado), consultor só vê o que é dele. Qualquer migração aqui
-- precisa reescrever essas policies, não só adicionar a coluna.
--
-- Aproveitando que as policies de leads estão sendo reescritas mesmo,
-- corrige também current_user_role() = '...' (checagem de cargo ESCALAR,
-- nunca migrada pro array `roles` desde a FASE 1) para
-- current_user_has_role(...)/current_user_is_admin() — mesma classe de
-- inconsistência já corrigida em compras/cotações/solicitações de
-- marketing.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS owner_ids text[] NOT NULL DEFAULT '{}';

UPDATE public.leads
SET owner_ids = ARRAY[owner]
WHERE owner IS NOT NULL AND (owner_ids IS NULL OR owner_ids = '{}'::text[]);

CREATE OR REPLACE FUNCTION public.leads_sync_owner_ids()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.owner_ids IS NULL THEN
    NEW.owner_ids := '{}'::text[];
  END IF;
  IF NEW.owner IS NOT NULL AND NOT (NEW.owner = ANY(NEW.owner_ids)) THEN
    NEW.owner_ids := array_append(NEW.owner_ids, NEW.owner);
  END IF;
  IF array_length(NEW.owner_ids, 1) IS NULL AND NEW.owner IS NOT NULL THEN
    NEW.owner_ids := ARRAY[NEW.owner];
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_sync_owner_ids_trg ON public.leads;
CREATE TRIGGER leads_sync_owner_ids_trg
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_sync_owner_ids();

-- Reescreve as 4 policies pra checar owner_ids (com overlap de array pra
-- subordinados) em vez do escalar owner, e current_user_has_role/
-- current_user_is_admin() em vez de current_user_role() = '...'.

DROP POLICY IF EXISTS leads_select ON public.leads;
CREATE POLICY leads_select ON public.leads FOR SELECT USING (
  current_user_is_admin()
  OR (current_user_has_role('gerente') AND company_id = ANY (current_user_companies()))
  OR (
    current_user_has_role('vendedor')
    AND company_id = ANY (current_user_companies())
    AND (
      owner_ids = '{}'::text[]
      OR (auth.uid())::text = ANY (owner_ids)
      OR owner_ids && current_user_subordinate_ids()
    )
  )
  OR (
    current_user_has_role('consultor')
    AND company_id = ANY (current_user_companies())
    AND (auth.uid())::text = ANY (owner_ids)
  )
);

DROP POLICY IF EXISTS leads_update ON public.leads;
CREATE POLICY leads_update ON public.leads FOR UPDATE USING (
  current_user_is_admin()
  OR (current_user_has_role('gerente') AND company_id = ANY (current_user_companies()))
  OR (
    current_user_has_role('vendedor')
    AND company_id = ANY (current_user_companies())
    AND (
      owner_ids = '{}'::text[]
      OR (auth.uid())::text = ANY (owner_ids)
      OR owner_ids && current_user_subordinate_ids()
    )
  )
  OR (
    current_user_has_role('consultor')
    AND company_id = ANY (current_user_companies())
    AND (auth.uid())::text = ANY (owner_ids)
  )
) WITH CHECK (
  current_user_is_admin()
  OR (current_user_has_role('gerente') AND company_id = ANY (current_user_companies()))
  OR (
    current_user_has_role('vendedor')
    AND company_id = ANY (current_user_companies())
    AND (
      owner_ids = '{}'::text[]
      OR (auth.uid())::text = ANY (owner_ids)
      OR owner_ids && current_user_subordinate_ids()
    )
  )
  OR (
    current_user_has_role('consultor')
    AND company_id = ANY (current_user_companies())
    AND (auth.uid())::text = ANY (owner_ids)
  )
);

DROP POLICY IF EXISTS leads_insert ON public.leads;
CREATE POLICY leads_insert ON public.leads FOR INSERT WITH CHECK (
  (current_user_has_role('admin') OR current_user_has_role('gerente') OR current_user_has_role('vendedor') OR current_user_has_role('consultor'))
  AND (current_user_is_admin() OR company_id = ANY (current_user_companies()))
);

DROP POLICY IF EXISTS leads_delete ON public.leads;
CREATE POLICY leads_delete ON public.leads FOR DELETE USING (
  current_user_is_admin()
  OR (current_user_has_role('gerente') AND is_demo = true)
);
