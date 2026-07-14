-- FASE 5: "possibilidade de mais de 1 responsável/aprovador por card" —
-- mesmo desenho de FASE 1 (profiles.role/roles): cada coluna escalar de
-- responsável continua existindo como "responsável principal" (retrocompat
-- com tudo que já lê/filtra por ela), e ganha uma irmã `_ids uuid[]` como
-- fonte de verdade pra "quem mais também é responsável" — um trigger
-- garante que o escalar está sempre dentro do array.
--
-- Aplicado às colunas onde já existe um responsável escalar e RLS não
-- depende diretamente da coluna (marketing_campaigns.owner,
-- marketing_deliverables.assignee, marketing_purchase_requests.
-- responsible_id, rh_avaliacoes.evaluator_id — só esta última precisa de
-- ajuste de policy). `leads.owner` fica de fora deste migration por ser
-- `text` (não uuid) e ter RLS de visibilidade hierárquica (subordinados)
-- diretamente sobre a coluna — tratado em migration separada, com mais
-- cuidado. rh_vagas/rh_candidatos não tinham responsável nenhum antes,
-- então ganham só a coluna array (nada pra sincronizar).

-- ── marketing_campaigns.owner → owner_ids ──────────────────────────────────
ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS owner_ids uuid[] NOT NULL DEFAULT '{}';

UPDATE public.marketing_campaigns
SET owner_ids = ARRAY[owner]
WHERE owner IS NOT NULL AND (owner_ids IS NULL OR owner_ids = '{}'::uuid[]);

CREATE OR REPLACE FUNCTION public.marketing_campaigns_sync_owner_ids()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.owner_ids IS NULL THEN
    NEW.owner_ids := '{}'::uuid[];
  END IF;
  IF NEW.owner IS NOT NULL AND NOT (NEW.owner = ANY(NEW.owner_ids)) THEN
    NEW.owner_ids := array_append(NEW.owner_ids, NEW.owner);
  END IF;
  IF array_length(NEW.owner_ids, 1) IS NULL AND NEW.owner IS NOT NULL THEN
    NEW.owner_ids := ARRAY[NEW.owner];
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketing_campaigns_sync_owner_ids_trg ON public.marketing_campaigns;
CREATE TRIGGER marketing_campaigns_sync_owner_ids_trg
  BEFORE INSERT OR UPDATE ON public.marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.marketing_campaigns_sync_owner_ids();

-- ── marketing_deliverables.assignee → assignee_ids ─────────────────────────
ALTER TABLE public.marketing_deliverables
  ADD COLUMN IF NOT EXISTS assignee_ids uuid[] NOT NULL DEFAULT '{}';

UPDATE public.marketing_deliverables
SET assignee_ids = ARRAY[assignee]
WHERE assignee IS NOT NULL AND (assignee_ids IS NULL OR assignee_ids = '{}'::uuid[]);

CREATE OR REPLACE FUNCTION public.marketing_deliverables_sync_assignee_ids()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.assignee_ids IS NULL THEN
    NEW.assignee_ids := '{}'::uuid[];
  END IF;
  IF NEW.assignee IS NOT NULL AND NOT (NEW.assignee = ANY(NEW.assignee_ids)) THEN
    NEW.assignee_ids := array_append(NEW.assignee_ids, NEW.assignee);
  END IF;
  IF array_length(NEW.assignee_ids, 1) IS NULL AND NEW.assignee IS NOT NULL THEN
    NEW.assignee_ids := ARRAY[NEW.assignee];
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketing_deliverables_sync_assignee_ids_trg ON public.marketing_deliverables;
CREATE TRIGGER marketing_deliverables_sync_assignee_ids_trg
  BEFORE INSERT OR UPDATE ON public.marketing_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.marketing_deliverables_sync_assignee_ids();

-- ── marketing_purchase_requests.responsible_id → responsible_ids ──────────
ALTER TABLE public.marketing_purchase_requests
  ADD COLUMN IF NOT EXISTS responsible_ids uuid[] NOT NULL DEFAULT '{}';

UPDATE public.marketing_purchase_requests
SET responsible_ids = ARRAY[responsible_id]
WHERE responsible_id IS NOT NULL AND (responsible_ids IS NULL OR responsible_ids = '{}'::uuid[]);

CREATE OR REPLACE FUNCTION public.marketing_purchase_requests_sync_responsible_ids()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.responsible_ids IS NULL THEN
    NEW.responsible_ids := '{}'::uuid[];
  END IF;
  IF NEW.responsible_id IS NOT NULL AND NOT (NEW.responsible_id = ANY(NEW.responsible_ids)) THEN
    NEW.responsible_ids := array_append(NEW.responsible_ids, NEW.responsible_id);
  END IF;
  IF array_length(NEW.responsible_ids, 1) IS NULL AND NEW.responsible_id IS NOT NULL THEN
    NEW.responsible_ids := ARRAY[NEW.responsible_id];
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketing_purchase_requests_sync_responsible_ids_trg ON public.marketing_purchase_requests;
CREATE TRIGGER marketing_purchase_requests_sync_responsible_ids_trg
  BEFORE INSERT OR UPDATE ON public.marketing_purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.marketing_purchase_requests_sync_responsible_ids();

-- ── rh_avaliacoes.evaluator_id → evaluator_ids (+ RLS) ─────────────────────
ALTER TABLE public.rh_avaliacoes
  ADD COLUMN IF NOT EXISTS evaluator_ids uuid[] NOT NULL DEFAULT '{}';

UPDATE public.rh_avaliacoes
SET evaluator_ids = ARRAY[evaluator_id]
WHERE evaluator_id IS NOT NULL AND (evaluator_ids IS NULL OR evaluator_ids = '{}'::uuid[]);

CREATE OR REPLACE FUNCTION public.rh_avaliacoes_sync_evaluator_ids()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.evaluator_ids IS NULL THEN
    NEW.evaluator_ids := '{}'::uuid[];
  END IF;
  IF NEW.evaluator_id IS NOT NULL AND NOT (NEW.evaluator_id = ANY(NEW.evaluator_ids)) THEN
    NEW.evaluator_ids := array_append(NEW.evaluator_ids, NEW.evaluator_id);
  END IF;
  IF array_length(NEW.evaluator_ids, 1) IS NULL AND NEW.evaluator_id IS NOT NULL THEN
    NEW.evaluator_ids := ARRAY[NEW.evaluator_id];
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rh_avaliacoes_sync_evaluator_ids_trg ON public.rh_avaliacoes;
CREATE TRIGGER rh_avaliacoes_sync_evaluator_ids_trg
  BEFORE INSERT OR UPDATE ON public.rh_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.rh_avaliacoes_sync_evaluator_ids();

-- rh_avaliacoes_read só deixava o avaliador ESCALAR ver o ciclo — agora
-- qualquer um dos avaliadores adicionais também precisa ver.
DROP POLICY IF EXISTS rh_avaliacoes_read ON public.rh_avaliacoes;
CREATE POLICY rh_avaliacoes_read ON public.rh_avaliacoes FOR SELECT USING (
  is_own_colaborador(user_id)
  OR auth.uid() = ANY(evaluator_ids)
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = ANY (ARRAY['admin','gerente_rh','rh'])
  )
);

-- ── rh_vagas / rh_candidatos: responsável nunca existiu, só a coluna nova ──
ALTER TABLE public.rh_vagas
  ADD COLUMN IF NOT EXISTS responsible_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.rh_candidatos
  ADD COLUMN IF NOT EXISTS responsible_ids uuid[] NOT NULL DEFAULT '{}';
