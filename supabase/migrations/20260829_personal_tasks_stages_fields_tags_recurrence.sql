-- Lista Pessoal, rodada 2 (07/08/2026, mockup "Lista Pessoal — ajustes
-- pedidos" aprovado): etapas configuráveis, campos por etapa (mesmo motor
-- do Editor de campos genérico já aprovado pra Fornecedores/Despesas —
-- Lista Pessoal vira mais uma fonte de dado dele), etiquetas em catálogo
-- fixo, recorrência rica.
--
-- Mesma filosofia de isolamento das migrations anteriores desta feature:
-- cada tabela nova é escopada por user_id com RLS `user_id = auth.uid()`,
-- sem exceção de papel — dado 100% privado. Diferente de rh_pipeline_stages/
-- rh_pipeline_stage_fields (que são POR DOMÍNIO/EMPRESA, compartilhadas
-- entre usuários): aqui não faz sentido reaproveitar aquelas tabelas
-- diretamente, porque elas pressupõem "todo mundo da empresa vê a mesma
-- configuração" — exatamente o oposto do que a Lista Pessoal precisa.

-- ── Etapas (colunas do Kanban) configuráveis por usuário ────────────────────

CREATE TABLE public.personal_task_stages (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stage_key  text        NOT NULL,
  name       text        NOT NULL,
  color      text        NOT NULL DEFAULT '#64748B',
  order_idx  integer     NOT NULL DEFAULT 0,
  terminal   boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, stage_key)
);

CREATE INDEX personal_task_stages_user_id_idx ON public.personal_task_stages (user_id, order_idx);

ALTER TABLE public.personal_task_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personal_task_stages_owner_all"
  ON public.personal_task_stages
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.personal_task_stages_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER personal_task_stages_updated_at
  BEFORE UPDATE ON public.personal_task_stages
  FOR EACH ROW EXECUTE FUNCTION public.personal_task_stages_set_updated_at();

-- personal_tasks.status hoje é validado só no client (STATUS_COLUMNS fixo).
-- Quem nunca customizar continua usando 'a_fazer'/'fazendo'/'feito' — não dá
-- pra travar com CHECK fixo (quebraria a customização), então sem trigger de
-- validação aqui, igual ao motivo dos CHECK hardcoded terem sido removidos de
-- rh_pipeline_stages/rh_vagas.

-- ── Campos customizados por etapa (mesmo motor do Editor de campos
--    genérico — StageFieldsPanel/StageFieldInput/field-conditions.js/
--    field-validation.js já existentes, só uma fonte de dado nova) ──────────

CREATE TABLE public.personal_task_stage_fields (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stage_key        text        NOT NULL,
  field_key        text        NOT NULL,
  field_type       text        NOT NULL CHECK (field_type IN ('text','textarea','number','currency','date','datetime','time','email','phone','url','checkbox','select','radio','multicheck','user')),
  label            text        NOT NULL,
  required         boolean     NOT NULL DEFAULT false,
  options          jsonb       NOT NULL DEFAULT '[]',
  order_idx        integer     NOT NULL DEFAULT 0,
  placeholder      text,
  help_text        text,
  visible_if       jsonb,
  required_if      jsonb,
  validation_rule  jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, stage_key, field_key)
);

CREATE INDEX personal_task_stage_fields_lookup_idx
  ON public.personal_task_stage_fields (user_id, stage_key, order_idx);

ALTER TABLE public.personal_task_stage_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personal_task_stage_fields_owner_all"
  ON public.personal_task_stage_fields
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER personal_task_stage_fields_updated_at
  BEFORE UPDATE ON public.personal_task_stage_fields
  FOR EACH ROW EXECUTE FUNCTION public.personal_task_stages_set_updated_at();

-- Valores dos campos customizados por tarefa — mesmo molde de
-- leads.custom_fields / rh_vagas.custom_fields.
ALTER TABLE public.personal_tasks
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ── Etiquetas: catálogo fixo por usuário (decisão B do mockup — dropdown
--    de múltipla escolha, não texto livre) ──────────────────────────────────

CREATE TABLE public.personal_task_tags (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label      text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, label)
);

CREATE INDEX personal_task_tags_user_id_idx ON public.personal_task_tags (user_id);

ALTER TABLE public.personal_task_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personal_task_tags_owner_all"
  ON public.personal_task_tags
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Recorrência rica: dia(s) da semana, dia do mês ──────────────────────────
-- Horário continua em due_time (já existe) — a recorrência herda o mesmo
-- horário da tarefa, só o PADRÃO de repetição ganha estrutura própria.
-- Formato: { "daysOfWeek": [1,4] } (weekly, 0=domingo..6=sábado) ou
-- { "dayOfMonth": 5 } (monthly). Ausente/vazio = comportamento antigo
-- (soma +7 dias / +1 mês a partir do prazo atual), pra não quebrar tarefa
-- recorrente já criada antes desta migration.
ALTER TABLE public.personal_tasks
  ADD COLUMN IF NOT EXISTS recurrence_config jsonb NOT NULL DEFAULT '{}'::jsonb;
