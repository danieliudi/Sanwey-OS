-- Time-to-Fill (estudo "Modernização e Aceleração do R&S", regra 3 do
-- CLAUDE.md — mockup aprovado com o Daniel): mede desde a aprovação da vaga
-- até o aceite do candidato, distinto do Time-to-Hire (que já existe como
-- "tempo de contratação" em rh-report-metrics.js, candidatura → contratação).
--
-- rh_vagas não tinha nenhuma data de "aprovação" separada de created_at.
-- Como o pipeline de vagas já modela "Rascunho → Publicada" como etapas
-- reais (rh_pipeline_stages, domain='vagas'), aprovação = primeira vez que
-- a vaga sai do rascunho — não precisa de ação manual nova do RH, só
-- carimbar isso automaticamente na mesma transição que já acontece hoje.

ALTER TABLE public.rh_vagas ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_vaga_approved_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.approved_at IS NULL AND NEW.stage IS DISTINCT FROM 'rascunho' THEN
    NEW.approved_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_set_vaga_approved_at
  BEFORE INSERT OR UPDATE ON public.rh_vagas
  FOR EACH ROW EXECUTE FUNCTION public.set_vaga_approved_at();

-- Backfill best-effort: rh_stage_history (20260715) já loga toda transição
-- de etapa de vaga desde que foi criada — recupera a data real de aprovação
-- pra qualquer vaga que já saiu do rascunho depois disso, sem precisar
-- adivinhar. Vagas mais antigas que isso ficam com approved_at NULL (mesmo
-- efeito de "sem dado suficiente ainda" que qualquer métrica nova tem).
UPDATE public.rh_vagas v
SET approved_at = h.first_approved
FROM (
  SELECT DISTINCT ON (record_id) record_id, changed_at AS first_approved
  FROM public.rh_stage_history
  WHERE domain = 'vagas' AND to_stage IS DISTINCT FROM 'rascunho'
  ORDER BY record_id, changed_at ASC
) h
WHERE v.id = h.record_id AND v.approved_at IS NULL;
