-- Escopo de leitura de etapas e de campos-por-etapa para o cargo externo
-- `agencia`.
--
-- Contexto (auditoria de 02/09/2026): `rh_pipeline_stages_read` e
-- `rh_pipeline_stage_fields_read` são as duas `FOR SELECT TO authenticated
-- USING (true)` — literalmente qualquer pessoa logada lê TODAS as etapas e
-- TODOS os campos de etapa de TODOS os domínios. Pra quem é de dentro do
-- Grupo isso é irrelevante e é o que faz os componentes compartilhados de
-- Kanban funcionarem sem cada board precisar de policy própria. Mas
-- `agencia` é o único cargo EXTERNO da plataforma — parceiro de fora que
-- entra só pra tocar Campanhas e Entregas.
--
-- Pela interface a agência já só alcança esses dois quadros (App.jsx monta um
-- menu com exatamente "Campanhas" e "Entregas", e `agenciaBlocked`
-- redireciona as outras rotas). O buraco é por baixo: uma chamada PostgREST
-- direta com o token dela devolve o desenho dos processos internos do Grupo
-- inteiro.
--
-- Medido na revisão de segurança, simulando com o JWT da conta agência real
-- (único perfil com o cargo) em transação revertida: hoje ela lê **34 linhas**
-- de `rh_pipeline_stage_fields` de domínios alheios — candidatos (18), vagas
-- (11), treinamentos (3), onboarding (2) — com rótulos do tipo "Salário
-- proposto", "Motivo da reprovação", "Parecer", "Gestor entrevistador".
-- Por isso a migration cobre as duas tabelas juntas: fechar só o nome da
-- etapa e deixar o campo da etapa aberto entregaria metade do objetivo. Uma
-- terceira, `pipeline_stage_fields`, entrou por decisão do Daniel — está
-- explicada no bloco dela, mais abaixo.
--
-- Por que agora é a hora barata: das 79 etapas cadastradas, ZERO têm o campo
-- `description` preenchido (a feature de descrição por etapa saiu na 4.91.1 e
-- ninguém escreveu nada ainda). Não existe fluxo em produção que dependa da
-- agência enxergar isso — risco de regressão nulo hoje, e só cresce depois.
--
-- POR QUE RESTRICTIVE, e não reescrever a policy de leitura:
-- a primeira versão desta migration reescrevia `rh_pipeline_stages_read` com
-- o predicado dentro dela, e o comentário afirmava que "agencia domina sobre
-- outros cargos, igual à interface". A revisão de segurança mostrou que isso
-- era falso no banco: `rh_pipeline_stages_write` é `FOR ALL TO public`, e
-- policy PERMISSIVA de ALL também concede SELECT — então quem acumulasse
-- agencia+gerente voltaria a ler `comercial` por OR, e o comentário viraria
-- uma garantia que o banco não dá. Policy RESTRICTIVE é avaliada em AND com
-- todas as permissivas, então domina de fato. Como o predicado é `true` pra
-- quem não é agência, nada muda pra mais ninguém — e as policies de leitura
-- existentes ficam intactas, o que mantém o diff pequeno e reversível
-- (basta dropar as três policies novas).

-- Etapas ---------------------------------------------------------------
DROP POLICY IF EXISTS rh_pipeline_stages_agencia_scope ON public.rh_pipeline_stages;
CREATE POLICY rh_pipeline_stages_agencia_scope
  ON public.rh_pipeline_stages
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  -- `(SELECT ...)` e não a chamada direta: força o planejador a resolver a
  -- função uma vez (InitPlan) em vez de reavaliar linha a linha. Mesma
  -- convenção do `(select auth.uid())` já adotada no repo, e esta tabela é
  -- lida em todo carregamento de board.
  USING (
    NOT (SELECT current_user_has_role('agencia'))
    OR domain IN ('marketing', 'marketing_deliverables')
  );

-- Campos por etapa -----------------------------------------------------
DROP POLICY IF EXISTS rh_pipeline_stage_fields_agencia_scope ON public.rh_pipeline_stage_fields;
CREATE POLICY rh_pipeline_stage_fields_agencia_scope
  ON public.rh_pipeline_stage_fields
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    NOT (SELECT current_user_has_role('agencia'))
    OR domain IN ('marketing', 'marketing_deliverables')
  );

-- Campos customizados do Funil de Vendas ------------------------------
-- Terceira tabela, e a de natureza diferente: `pipeline_stage_fields` NÃO é
-- `USING (true)` — ela escopa por empresa
-- (`company_id = ANY (current_user_companies()) OR current_user_is_admin()`),
-- e o modelo por empresa está sendo respeitado. O que a torna legível pela
-- agência (86 linhas medidas) é o perfil dela carregar industria+resibag por
-- causa de Campanhas e Entregas: o cargo externo entra pelo Marketing e leva
-- as empresas junto, e com elas os campos do Comercial.
--
-- Ou seja: aqui não havia falha a corrigir, havia uma decisão a tomar —
-- fechar também ou aceitar e registrar. Decidido com o Daniel em 02/09/2026:
-- fechar, pela mesma razão das outras duas (parceiro de fora não precisa do
-- desenho do funil comercial pra tocar campanha). Esta tabela é 100%
-- comercial, então o carve-out é total, não por domínio.
DROP POLICY IF EXISTS pipeline_stage_fields_agencia_scope ON public.pipeline_stage_fields;
CREATE POLICY pipeline_stage_fields_agencia_scope
  ON public.pipeline_stage_fields
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (NOT (SELECT current_user_has_role('agencia')));

-- Fora do escopo desta migration, registrado pra não ser redescoberto:
-- `pipeline_stage_transitions_read` tem a mesma forma (`USING (true)`), mas
-- a tabela está vazia hoje, então não vaza nada.
