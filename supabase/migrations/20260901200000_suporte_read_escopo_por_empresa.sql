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
-- EXPOSIÇÃO HOJE: LATENTE, não ativa — `profiles` tem ZERO usuário com o
-- cargo `suporte`. Conferido em 01/09/2026 e de novo em 11/09/2026, contra
-- produção. Não há vazamento acontecendo; há um buraco esperando o primeiro
-- usuário do cargo. Por isso dá pra fechar sem pressa e sem risco de rollout:
-- não existe ninguém pra quebrar.
--
-- POR QUE UMA FUNÇÃO E NÃO UM `EXISTS` INLINE
-- As três tabelas não têm coluna de empresa; o escopo tem que sair de
-- `clients.company_ids` via `client_id`, e um EXISTS contra `clients` escrito
-- DENTRO da policy também passa pela RLS de `clients`.
--
-- CORREÇÃO DE 11/09/2026 — a justificativa original desta seção não vale
-- mais, e ficou registrada porque rationale desatualizado engana a próxima
-- sessão. Ela dizia que o EXISTS inline devolveria 0/0 ("cega o suporte
-- inteiro"), porque `clients_read` só admitia admin, gerente e vendedor, e
-- que a 20260901190000 "pode nem ser aplicada". As duas premissas caíram: a
-- 20260901190000 ESTÁ aplicada em produção, e `clients_read` hoje é
--   admin OR (roles && {gerente,vendedor,suporte} AND company_ids && companies)
-- ou seja, já admite suporte com escopo de frente.
--
-- Medido de novo numa branch descartável em 11/09/2026, com um suporte puro
-- de verdade (só o cargo `suporte`, frente `industria`):
--
--   variante                      própria frente   outra frente
--   hoje (sem filtro)                    1              1   ← o vazamento
--   EXISTS inline                        1              0   ← também resolve
--   helper SECURITY DEFINER              1              0   ← o desta migration
--
-- As duas fecham o vazamento. Fico com o helper por dois motivos, nenhum
-- deles "o inline não funciona": ele é o mesmo desenho de
-- `current_user_can_manage_client()`, que os ramos *_interno destas MESMAS
-- três tabelas já usam (regra 3.1 manda espelhar a irmã), e não acopla a
-- correção ao `clients_read` continuar admitindo suporte. Se um dia alguém
-- estreitar o `clients_read`, o inline faria estas três tabelas sumirem em
-- silêncio — falha pro lado seguro, mas ainda assim uma tela vazia sem
-- explicação.
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
  'Suporte comercial COM escopo de frente: true só se o usuário tem o cargo suporte E o cliente pertence a alguma das frentes dele. SECURITY DEFINER de propósito — espelha current_user_can_manage_client(), que os ramos *_interno destas mesmas tabelas já usam, e não acopla o escopo destas três tabelas ao que o clients_read admitir no futuro.';

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
