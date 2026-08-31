-- Vínculo muitos-para-muitos entre Despesas de Marketing e Entregas/Tarefas
-- (pedido do Daniel: uma despesa pode se relacionar a mais de uma Entrega e
-- mais de uma Tarefa — Campanha continua single-FK, `campaign_id`, inalterada,
-- não mexer nela).
--
-- Duas tabelas de junção puras (sem coluna própria além das FKs + created_at):
-- marketing_expense_deliverables e marketing_expense_tasks. PK composta
-- (expense_id, <entidade>_id) — ON DELETE CASCADE dos dois lados (colunas de
-- PK são NOT NULL por definição, então SET NULL não é opção válida aqui).
-- Mesmo padrão já em produção em chat_channel_members (PK composta + CASCADE
-- nos 2 FKs).
--
-- RLS espelha exatamente o predicado hoje vigente em marketing_expenses /
-- marketing_expense_items:
--   SELECT: current_user_is_marketing() OR current_user_has_role('diretoria')
--   INSERT/DELETE: current_user_is_marketing()
-- Sem policy de UPDATE: tabela de junção pura, trocar vínculo é sempre
-- delete+insert (mesmo raciocínio de chat_channel_members).

CREATE TABLE public.marketing_expense_deliverables (
  expense_id     uuid NOT NULL REFERENCES public.marketing_expenses(id) ON DELETE CASCADE,
  deliverable_id uuid NOT NULL REFERENCES public.marketing_deliverables(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (expense_id, deliverable_id)
);

CREATE INDEX marketing_expense_deliverables_deliverable_idx
  ON public.marketing_expense_deliverables (deliverable_id);

ALTER TABLE public.marketing_expense_deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY marketing_expense_deliverables_select
  ON public.marketing_expense_deliverables FOR SELECT
  USING (current_user_is_marketing() OR current_user_has_role('diretoria'));

CREATE POLICY marketing_expense_deliverables_insert
  ON public.marketing_expense_deliverables FOR INSERT
  WITH CHECK (current_user_is_marketing());

CREATE POLICY marketing_expense_deliverables_delete
  ON public.marketing_expense_deliverables FOR DELETE
  USING (current_user_is_marketing());


CREATE TABLE public.marketing_expense_tasks (
  expense_id uuid NOT NULL REFERENCES public.marketing_expenses(id) ON DELETE CASCADE,
  task_id    uuid NOT NULL REFERENCES public.marketing_tasks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (expense_id, task_id)
);

CREATE INDEX marketing_expense_tasks_task_idx
  ON public.marketing_expense_tasks (task_id);

ALTER TABLE public.marketing_expense_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY marketing_expense_tasks_select
  ON public.marketing_expense_tasks FOR SELECT
  USING (current_user_is_marketing() OR current_user_has_role('diretoria'));

CREATE POLICY marketing_expense_tasks_insert
  ON public.marketing_expense_tasks FOR INSERT
  WITH CHECK (current_user_is_marketing());

CREATE POLICY marketing_expense_tasks_delete
  ON public.marketing_expense_tasks FOR DELETE
  USING (current_user_is_marketing());
