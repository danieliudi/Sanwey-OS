-- Escopo por frente comercial nas policies *_suporte_read
-- ---------------------------------------------------------------------------
-- NÃO APLICADA — aguarda confirmação explícita do Daniel (CLAUDE.md, regra 5).
--
-- O PROBLEMA (revisão de Segurança, 01/09/2026)
-- Três policies concedem leitura ao cargo `suporte` sem NENHUM filtro por
-- frente comercial:
--
--   client_addresses_suporte_read  SELECT  USING (is_comercial_support())
--   client_contacts_suporte_read   SELECT  USING (is_comercial_support())
--   client_products_suporte_read   SELECT  USING (is_comercial_support())
--
-- e `is_comercial_support()` é só `current_user_roles() && array['suporte']`.
-- Quem tiver o cargo lê endereço, CNPJ de faturamento, contato (nome, e-mail,
-- telefone) e PREÇO NEGOCIADO de cliente de qualquer frente do Grupo.
--
-- É a mesma classe já corrigida nos ramos *_interno por
-- _historico/20260818_sec_client_addr_contacts_marketing_expense_scope.sql, e
-- que voltou pela porta do lado quando _historico/20260921_papel_suporte_
-- comercial.sql criou as três *_suporte_read.
--
-- EXPOSIÇÃO HOJE: LATENTE, não ativa — conferido em 01/09/2026, `profiles`
-- tem ZERO usuário com o cargo `suporte`. Não há vazamento acontecendo; há um
-- buraco esperando o primeiro usuário do cargo. Por isso dá pra fechar sem
-- pressa e sem risco de rollout: não existe ninguém pra quebrar.
--
-- POR QUE UMA FUNÇÃO E NÃO UM `EXISTS` INLINE  ← o ponto não-óbvio
-- As três tabelas não têm coluna de empresa; o escopo tem que sair de
-- `clients.company_ids` via `client_id`. Mas um EXISTS contra `clients`
-- escrito DENTRO da policy também passa pela RLS de `clients` — e o suporte
-- puro enxerga ZERO cliente hoje (`clients_read` só admite admin, gerente e
-- vendedor). Medido em transação revertida, com um suporte puro de verdade:
--
--   variante                      própria frente   outra frente
--   hoje (sem filtro)                    1              1   ← o vazamento
--   EXISTS inline                        0              0   ← quebra tudo
--   helper SECURITY DEFINER              1              0   ← correto
--
-- O EXISTS inline não vaza, mas cega o suporte inteiro — e ainda amarraria
-- esta migration à 20260901190000 (que acrescenta suporte ao `clients_read`),
-- que pode nem ser aplicada. A função SECURITY DEFINER lê `clients` como dona
-- e devolve só o booleano, que é exatamente o que `current_user_can_manage_
-- client()` já faz pros ramos *_interno destas mesmas tabelas. Reaproveitar o
-- padrão da tabela-irmã, como manda a regra 3.1.
--
-- ATENÇÃO — NÃO espelhar as *_suporte_read atuais. Aqui a regra 3.1 ("compare
-- com o predicado da tabela-irmã") aponta pro lado errado: as irmãs são
-- justamente as que estão sem escopo. O predicado a espelhar é o de
-- `clients_read`/`current_user_can_manage_client`, que sempre filtrou por
-- empresa.
--
-- roles[] e nunca `profiles.role` escalar (CLAUDE.md, MD-11): a função nova
-- só compõe `is_comercial_support()` (que já lê roles[]) com
-- `current_user_companies()`.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_comercial_support_for_client(p_client uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  select public.is_comercial_support()
     and exists (
       select 1 from public.clients c
        where c.id = p_client
          and c.company_ids && public.current_user_companies()
     );
$$;

COMMENT ON FUNCTION public.is_comercial_support_for_client(uuid) IS
  'Suporte comercial COM escopo de frente: true só se o usuário tem o cargo suporte E o cliente pertence a alguma das frentes dele. SECURITY DEFINER de propósito — dentro de uma policy, um EXISTS contra clients passaria pela RLS de clients, e o suporte não enxerga clients hoje.';

-- anon fora, igual ao is_comercial_support() (que já é o único da família sem
-- anon no ACL). authenticated precisa executar: a policy roda como o chamador.
REVOKE ALL ON FUNCTION public.is_comercial_support_for_client(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_comercial_support_for_client(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS client_addresses_suporte_read ON public.client_addresses;
CREATE POLICY client_addresses_suporte_read ON public.client_addresses
  AS PERMISSIVE FOR SELECT TO public
  USING (public.is_comercial_support_for_client(client_id));

DROP POLICY IF EXISTS client_contacts_suporte_read ON public.client_contacts;
CREATE POLICY client_contacts_suporte_read ON public.client_contacts
  AS PERMISSIVE FOR SELECT TO public
  USING (public.is_comercial_support_for_client(client_id));

DROP POLICY IF EXISTS client_products_suporte_read ON public.client_products;
CREATE POLICY client_products_suporte_read ON public.client_products
  AS PERMISSIVE FOR SELECT TO public
  USING (public.is_comercial_support_for_client(client_id));

COMMIT;

-- REVERTER, se precisar: recriar as três com USING (is_comercial_support())
-- e dropar a função. Volta ao estado de hoje, que é o vazamento — só faça
-- isso se a negação estiver barrando alguém que deveria enxergar.
