-- Complemento do SEC-A1: DELETE também não tinha escopo de empresa
-- (checava só role IN admin/gerente, sem cruzar company_ids do cliente).
DROP POLICY IF EXISTS client_billing_history_delete ON public.client_billing_history;
CREATE POLICY client_billing_history_delete ON public.client_billing_history
FOR DELETE
USING (
  current_user_is_admin()
  OR (
    ('gerente' = ANY (current_user_roles()))
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_billing_history.client_id
        AND c.company_ids && current_user_companies()
    )
  )
);
