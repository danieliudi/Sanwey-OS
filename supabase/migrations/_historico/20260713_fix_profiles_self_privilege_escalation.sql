-- Achado crítico da auditoria: a policy profiles_update permite que
-- qualquer usuário autenticado edite a PRÓPRIA linha (ramo `id = auth.uid()`)
-- sem nenhuma restrição de coluna — ou seja, um vendedor comum conseguia
-- rodar `update profiles set role='admin' where id=auth.uid()` direto via
-- API e a policy deixava passar. RLS puro não dá pra checar "valor antigo
-- vs novo" de forma confiável nesse ramo (a subquery WITH CHECK enxergaria
-- o próprio UPDATE em andamento), então a correção é via trigger: reverte
-- role/companies/sectors pro valor anterior sempre que quem está editando
-- é a própria pessoa e não é admin/gerente. Edições legítimas de nome,
-- avatar, etc. continuam funcionando normalmente.
CREATE OR REPLACE FUNCTION public.profiles_prevent_self_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() = NEW.id AND NOT current_user_is_admin() AND NOT current_user_is_manager() THEN
    NEW.role := OLD.role;
    NEW.companies := OLD.companies;
    NEW.sectors := OLD.sectors;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.profiles_prevent_self_role_escalation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_prevent_self_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_self_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_prevent_self_role_escalation();
