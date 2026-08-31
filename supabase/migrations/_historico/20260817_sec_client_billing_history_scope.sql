-- SEC-A1 (ALTO): client_billing_history só exigia auth.uid() IS NOT NULL —
-- qualquer autenticado (RH, marketing, agencia, vendedor de outra empresa)
-- lia/gravava faturamento de TODOS os clientes. Espelha exatamente o padrão
-- já usado em `clients` (clients_read/insert/update).

DROP POLICY IF EXISTS client_billing_history_read ON public.client_billing_history;
CREATE POLICY client_billing_history_read ON public.client_billing_history
FOR SELECT
USING (
  current_user_is_admin()
  OR current_user_has_role('diretoria')
  OR (
    (current_user_roles() && ARRAY['gerente','vendedor','consultor'])
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_billing_history.client_id
        AND c.company_ids && current_user_companies()
    )
  )
);

DROP POLICY IF EXISTS client_billing_history_insert ON public.client_billing_history;
CREATE POLICY client_billing_history_insert ON public.client_billing_history
FOR INSERT
WITH CHECK (
  current_user_is_admin()
  OR (
    (current_user_roles() && ARRAY['gerente','vendedor','consultor'])
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_billing_history.client_id
        AND c.company_ids && current_user_companies()
    )
  )
);

DROP POLICY IF EXISTS client_billing_history_update ON public.client_billing_history;
CREATE POLICY client_billing_history_update ON public.client_billing_history
FOR UPDATE
USING (
  current_user_is_admin()
  OR (
    (current_user_roles() && ARRAY['gerente','vendedor','consultor'])
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_billing_history.client_id
        AND c.company_ids && current_user_companies()
    )
  )
)
WITH CHECK (
  current_user_is_admin()
  OR (
    (current_user_roles() && ARRAY['gerente','vendedor','consultor'])
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_billing_history.client_id
        AND c.company_ids && current_user_companies()
    )
  )
);
