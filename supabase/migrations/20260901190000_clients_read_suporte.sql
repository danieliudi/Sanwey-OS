-- clients_read: incluir o cargo 'suporte'
-- ---------------------------------------------------------------------------
-- NÃO APLICADA AINDA — aguarda confirmação explícita do Daniel (CLAUDE.md,
-- regra 5). Escrita a partir da decisão dele em 01/09/2026, na pergunta sobre
-- a divergência encontrada no checkup da plataforma.
--
-- O PROBLEMA (achado do checkup, 01/09/2026)
-- Quem tem SÓ o cargo 'suporte' recebe a página "Clientes" no menu — está na
-- lista de `isPureSuporte` em src/utils/module-access.js E no ramo
-- `v_is_pure_suporte` de current_user_has_module() no banco, ou seja, os dois
-- lados concordam em liberar a TELA. Mas a policy `clients_read` (baseline)
-- só admite admin/gerente/vendedor:
--
--   USING (current_user_is_admin() OR ((current_user_roles() && ARRAY['gerente','vendedor'])
--          AND (company_ids && current_user_companies())))
--
-- Resultado: a pessoa abre Clientes e a lista vem VAZIA, sem erro nenhum —
-- o pior formato de bug, porque parece "não tem cliente cadastrado".
--
-- A DECISÃO (Daniel, 01/09/2026): liberar a leitura. Suporte comercial opera
-- pedido e mantém catálogo; consultar o cadastro do cliente faz parte disso.
--
-- ESCOPO DELIBERADAMENTE ESTREITO — 3 pontos:
--   1. Só SELECT. `clients_update` NÃO muda: suporte lê, não edita cadastro.
--   2. MESMO filtro por empresa dos outros cargos
--      (`company_ids && current_user_companies()`). Isolamento por frente
--      comercial é a classe de bug que já mordeu esta tabela uma vez
--      (20260713_fix_clients_company_isolation.sql) — não afrouxar aqui.
--   3. `current_user_roles()` (roles[]), nunca `profiles.role` escalar —
--      CLAUDE.md, achado MD-11. A policy existente já é assim; esta só
--      acrescenta um valor ao array que ela já compara.
--
-- POR QUE RECRIAR EM VEZ DE ALTERAR: Postgres não tem "ALTER POLICY ... ADD
-- role ao array". DROP + CREATE dentro da mesma transação: a janela sem
-- policy não existe pra sessão nenhuma, porque a transação só fica visível no
-- commit. O begin/commit é EXPLÍCITO aqui de propósito — `supabase db push`,
-- o apply_migration do MCP e o SQL Editor já envolvem em transação, mas a
-- garantia estava escrita neste arquivo sem se sustentar sozinha (achado da
-- revisão de Segurança, 01/09/2026). Se falhasse no meio, falharia FECHADO
-- (tabela sem clients_read nega pra gerente/vendedor, não abre nada) — ainda
-- assim, a afirmação e o código agora batem.

BEGIN;

DROP POLICY IF EXISTS clients_read ON public.clients;

CREATE POLICY clients_read ON public.clients AS PERMISSIVE FOR SELECT TO public
  USING (
    current_user_is_admin()
    OR (
      (current_user_roles() && ARRAY['gerente'::text, 'vendedor'::text, 'suporte'::text])
      AND (company_ids && current_user_companies())
    )
  );

COMMENT ON POLICY clients_read ON public.clients IS
  'Leitura do cadastro de clientes: admin sem filtro; gerente/vendedor/suporte restritos às próprias frentes comerciais. suporte entrou em 01/09/2026 — a página Clientes já estava liberada no menu pra esse cargo e a lista vinha vazia. Só SELECT: clients_update continua sem suporte.';

COMMIT;
