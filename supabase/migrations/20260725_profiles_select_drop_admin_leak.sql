-- Achado HIGH da 2ª auditoria (Fable 5): a cláusula `OR 'admin' = ANY (roles)`
-- em profiles_select usa o `roles` da LINHA candidata (o profile sendo lido),
-- sem gate no usuário atual — ou seja, QUALQUER autenticado (inclusive uma
-- conta "agencia" externa) conseguia SELECT na linha completa de qualquer
-- admin, vazando ai_config (chave de IA em texto plano), calendar_token
-- (credencial única do feed calendar-ics, sem login), salary, admission_date,
-- contract_type e employee_status. Era um defeito que sobrou do próprio fix
-- anterior (20260723) — a migration inteira existe pra restringir esses dados
-- por empresa, e essa cláusula derrubava justamente essa confidencialidade.
--
-- Removida. Admin continua visível pra si mesmo (id = auth.uid()), pra outros
-- admins e pra gestores/colegas da própria empresa/departamento via as
-- cláusulas escopadas. Se no futuro admins precisarem ser "descobríveis" em
-- @menção/seletor de responsável por qualquer usuário, isso deve vir por uma
-- view/RPC que projeta só colunas não sensíveis (id, name, avatar, roles) —
-- nunca a linha inteira de profiles.
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (
  id = auth.uid()
  OR 'admin' = ANY (current_user_roles())
  OR ('gerente' = ANY (current_user_roles()) AND companies && current_user_companies())
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
