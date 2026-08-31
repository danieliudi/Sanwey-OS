-- Achado crítico da auditoria de plataforma: profiles_select liberava
-- current_user_is_manager() sem NENHUM filtro por empresa — um "gerente"
-- (role/roles) de UMA empresa lia salário, calendar_token, admission_date,
-- contract_type e employee_status de colaboradores de QUALQUER outra
-- empresa do grupo (industria/resibag/montemor). O mesmo padrão de escopo
-- por empresa já existe pra clients/leads (company_ids && current_user_companies())
-- — aqui replicamos o equivalente pra profiles, usando a coluna `companies`.
--
-- De quebra, a cláusula de subordinados ainda checava current_user_role()
-- (cargo principal escalar) em vez de current_user_roles() (array) —
-- um vendedor/consultor com esse cargo como ADICIONAL, não principal,
-- não enxergava os próprios subordinados.
-- Admin fica de fora do escopo por empresa (precisa ver a plataforma
-- inteira); só "gerente" (dept Comercial) é restrito à própria empresa —
-- current_user_is_manager() misturava os dois, por isso não dava pra só
-- adicionar "AND companies && current_user_companies()" nela direto (um
-- admin cujo profile.companies não cobrisse todas as empresas perderia
-- visibilidade global).
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (
  id = auth.uid()
  OR 'admin' = ANY (current_user_roles())
  OR ('gerente' = ANY (current_user_roles()) AND companies && current_user_companies())
  OR 'admin' = ANY (roles)
  OR (
    current_user_roles() && ARRAY['marketing','gerente_marketing']::text[]
    AND roles && ARRAY['marketing','gerente_marketing']::text[]
  )
  OR (
    current_user_roles() && ARRAY['rh','gerente_rh']::text[]
    AND roles && ARRAY['rh','gerente_rh']::text[]
  )
  OR (current_user_roles() && ARRAY['vendedor','consultor']::text[] AND (id)::text = ANY (current_user_subordinate_ids()))
);
