-- Achado MEDIUM da 2ª auditoria: as 4 policies de `clients` checavam permissão
-- via current_user_role() (cargo PRINCIPAL escalar), não migradas junto com a
-- fundação multi-cargo (20260714). Quem tem gerente/vendedor/consultor como
-- cargo ADICIONAL era indevidamente bloqueado. Como o escalar é sempre mais
-- restritivo que o array, isso só NEGA acesso legítimo (não vaza dados) —
-- mas alinha clients com leads/marketing/compras/viagens. Escopo por empresa
-- (company_ids && current_user_companies()) mantido.
DROP POLICY IF EXISTS clients_read ON public.clients;
CREATE POLICY clients_read ON public.clients FOR SELECT USING (
  current_user_is_admin()
  OR (current_user_roles() && ARRAY['gerente','vendedor','consultor']::text[] AND company_ids && current_user_companies())
);

DROP POLICY IF EXISTS clients_insert ON public.clients;
CREATE POLICY clients_insert ON public.clients FOR INSERT WITH CHECK (
  current_user_is_admin()
  OR (current_user_roles() && ARRAY['gerente','vendedor','consultor']::text[] AND company_ids && current_user_companies())
);

DROP POLICY IF EXISTS clients_update ON public.clients;
CREATE POLICY clients_update ON public.clients FOR UPDATE USING (
  current_user_is_admin()
  OR (current_user_roles() && ARRAY['gerente','vendedor','consultor']::text[] AND company_ids && current_user_companies())
) WITH CHECK (
  current_user_is_admin()
  OR (current_user_roles() && ARRAY['gerente','vendedor','consultor']::text[] AND company_ids && current_user_companies())
);

-- Só admin/gerente apaga (mantém a regra original, mas via array).
DROP POLICY IF EXISTS clients_delete ON public.clients;
CREATE POLICY clients_delete ON public.clients FOR DELETE USING (
  current_user_is_admin()
  OR ('gerente' = ANY (current_user_roles()) AND company_ids && current_user_companies())
);
