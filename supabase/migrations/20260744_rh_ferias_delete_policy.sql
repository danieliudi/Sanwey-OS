-- rh_ferias nunca teve policy de DELETE (só SELECT/INSERT/UPDATE) — sem ela,
-- um DELETE do RH/gerente é aceito pelo Supabase mas o RLS filtra a linha
-- (0 rows affected, sem erro), então "excluir card" no Kanban de férias
-- silenciosamente não fazia nada. Mesmo predicado de rh_ferias_update.
DROP POLICY IF EXISTS rh_ferias_delete ON public.rh_ferias;
CREATE POLICY rh_ferias_delete ON public.rh_ferias
  FOR DELETE USING (
    current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh')
  );
