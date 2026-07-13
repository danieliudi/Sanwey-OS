-- Achados importantes da auditoria: duas telas de Marketing bloqueiam
-- "agencia" na UI, mas a RLS liberava os dados via API direta mesmo assim.
--
-- marketing_expenses.me_select liberava explicitamente `role = 'agencia'`
-- (dado financeiro: valores e status de pagamento).
DROP POLICY IF EXISTS me_select ON public.marketing_expenses;
CREATE POLICY me_select
  ON public.marketing_expenses
  FOR SELECT
  USING (current_user_is_marketing());

-- marketing_requests_read liberava qualquer usuário com perfil (ou seja,
-- todo mundo autenticado, incluindo agencia) — Solicitações é área interna
-- de marketing (App.jsx já bloqueia agencia na rota). Restringe leitura ao
-- mesmo conjunto de papéis que já tem escrita (marketing_requests_write).
DROP POLICY IF EXISTS marketing_requests_read ON public.marketing_requests;
CREATE POLICY marketing_requests_read
  ON public.marketing_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['admin', 'marketing', 'gerente_marketing'])
    )
  );
