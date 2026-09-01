-- Descrição editável de ETAPA e de PÁGINA
-- ---------------------------------------------------------------------------
-- Mockup aprovado com o Daniel (01/09/2026), a partir do pedido "ao invés de
-- eliminar o subtítulo, eu deixaria ao lado, mas editável, como um pequeno
-- campo de descrição daquela página".
--
-- Hoje esse texto é hardcoded na view ("Kanban de entregas de campanha"). O
-- efeito prático de virar dado é que quem desenha o processo consegue
-- escrever o que aquela etapa/tela significa, sem depender de deploy — que é
-- o mesmo princípio já usado pra etapas, campos por etapa e transições
-- (CLAUDE.md, regra 5: se cabe em configuração, não é código novo).
--
-- DUAS RESPOSTAS DO DANIEL que moldaram esta migration (01/09/2026):
--   1. Quem edita: só gerente e admin.
--   2. Descrição de PÁGINA é uma só pro Grupo, não uma por frente comercial.
--      Por isso NÃO há company_id aqui — `module_states` continua com a
--      chave primária que já tem (`module_id`), sem migração de linha
--      nenhuma. Se um dia precisar variar por frente, é outra conversa e
--      outra migration.
--
-- NENHUMA POLICY NOVA. As duas tabelas já restringem escrita exatamente ao
-- que a decisão pede, e as duas já usam `roles[]` via current_user_has_role
-- (nada de `profiles.role` escalar — CLAUDE.md, achado MD-11):
--
--   * rh_pipeline_stages_write → admin, ou gerente no domínio 'comercial', ou
--     RH/marketing/comex nos domínios de cada um. É a mesma régua de quem já
--     renomeia e reordena etapa hoje — descrever a etapa é o mesmo ato.
--   * module_states_write → SOMENTE admin.
--
-- ATENÇÃO, DIVERGÊNCIA A CONFIRMAR: a decisão foi "gerente e admin", mas
-- `module_states` é admin-only hoje. Eu NÃO afrouxei essa policy de
-- propósito: `module_states` é o registro que liga e desliga página na
-- plataforma inteira (`state` = off/test/live) — dar escrita a gerente pra
-- ele poder editar uma descrição daria junto o poder de desligar telas do
-- Grupo. Descrição de página fica admin-only; descrição de etapa fica
-- admin+gerente. Se o Daniel quiser gerente editando descrição de página, o
-- caminho certo é uma coluna com policy própria ou uma RPC SECURITY DEFINER
-- que só toque `description` — não relaxar `module_states_write`.
--
-- Limite de caracteres via CHECK, não só no front: o campo é renderizado
-- inline ao lado do título (PageTitle.jsx) e truncado com reticências. Sem
-- teto no banco, alguém cola um parágrafo, ele nunca aparece inteiro, e a
-- pessoa conclui que a plataforma "comeu" o texto.
--   * etapa  = 140 (cabe na largura de uma coluna de Kanban)
--   * página = 120 (divide a linha do título com filtros e botões de ação)

ALTER TABLE public.rh_pipeline_stages
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.module_states
  ADD COLUMN IF NOT EXISTS description text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rh_pipeline_stages_description_len'
  ) THEN
    ALTER TABLE public.rh_pipeline_stages
      ADD CONSTRAINT rh_pipeline_stages_description_len
      CHECK (description IS NULL OR char_length(description) <= 140);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'module_states_description_len'
  ) THEN
    ALTER TABLE public.module_states
      ADD CONSTRAINT module_states_description_len
      CHECK (description IS NULL OR char_length(description) <= 120);
  END IF;
END $$;

COMMENT ON COLUMN public.rh_pipeline_stages.description IS
  'Descrição curta da etapa (o que precisa acontecer nela), editável por admin/gerente do domínio. NULL = sem descrição, a UI não mostra nada.';

COMMENT ON COLUMN public.module_states.description IS
  'Descrição curta da página, mostrada ao lado do título. Uma só pro Grupo — decisão do Daniel 01/09/2026, por isso sem company_id. Editável só por admin (ver nota no cabeçalho da migration).';
