-- Histórico de etapa genérico multi-domínio pro RH — generaliza o padrão já
-- em produção de lead_stage_history (trigger AFTER INSERT/UPDATE, imutável,
-- append-only) pra vagas/candidatos/onboarding/feedback/ferias/treinamentos,
-- que hoje não têm nenhum rastro de "quem moveu o quê, quando" além do que
-- se pode inferir do timestamp de última mudança de etapa. Alimenta a nova
-- aba "Histórico" do RHDetailDrawerShell (compartilhada pelos 6 domínios).

CREATE TABLE public.rh_stage_history (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  domain      text        NOT NULL CHECK (domain = ANY (ARRAY['vagas','candidatos','onboarding','feedback','ferias','treinamentos'])),
  record_id   uuid        NOT NULL,
  from_stage  text,
  to_stage    text        NOT NULL,
  changed_at  timestamptz NOT NULL DEFAULT now(),
  changed_by  uuid        REFERENCES public.profiles(id)
);

CREATE INDEX rh_stage_history_domain_record_idx
  ON public.rh_stage_history (domain, record_id, changed_at DESC);

ALTER TABLE public.rh_stage_history ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de rh_attachments: RH pleno acesso; colaborador só lê o
-- próprio histórico de onboarding (nada de feedback/ferias — dado mais
-- sensível de avaliação/aprovação, sem precedente de self-read hoje).
CREATE POLICY rh_stage_history_rh_access ON public.rh_stage_history
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = ANY (ARRAY['admin','gerente_rh','rh'])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = ANY (ARRAY['admin','gerente_rh','rh'])));

CREATE POLICY rh_stage_history_self_read ON public.rh_stage_history
  FOR SELECT
  USING (domain = 'onboarding' AND public.is_own_colaborador(record_id));

-- Trigger genérico: TG_ARGV[0] = domain, TG_ARGV[1] = nome da coluna de
-- etapa/status na tabela de origem (varia: rh_vagas/rh_candidatos usam
-- "stage"; rh_avaliacoes/rh_ferias/rh_treinamento_atribuicoes usam "status";
-- rh_colaboradores usa "onboarding_stage"). to_jsonb(NEW)/(OLD) evita precisar
-- de uma função por tabela só por causa do nome da coluna divergir.
CREATE OR REPLACE FUNCTION public.log_rh_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  domain_name text := TG_ARGV[0];
  stage_col   text := TG_ARGV[1];
  old_stage   text;
  new_stage   text;
BEGIN
  new_stage := to_jsonb(NEW) ->> stage_col;

  IF (TG_OP = 'INSERT') THEN
    IF new_stage IS NOT NULL THEN
      INSERT INTO public.rh_stage_history (domain, record_id, from_stage, to_stage, changed_at, changed_by)
      VALUES (domain_name, NEW.id, NULL, new_stage, now(), auth.uid());
    END IF;
    RETURN NEW;
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    old_stage := to_jsonb(OLD) ->> stage_col;
    IF old_stage IS DISTINCT FROM new_stage THEN
      INSERT INTO public.rh_stage_history (domain, record_id, from_stage, to_stage, changed_at, changed_by)
      VALUES (domain_name, NEW.id, old_stage, new_stage, now(), auth.uid());
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_log_vaga_stage_change
  AFTER INSERT OR UPDATE ON public.rh_vagas
  FOR EACH ROW EXECUTE FUNCTION public.log_rh_stage_change('vagas', 'stage');

CREATE TRIGGER trg_log_candidato_stage_change
  AFTER INSERT OR UPDATE ON public.rh_candidatos
  FOR EACH ROW EXECUTE FUNCTION public.log_rh_stage_change('candidatos', 'stage');

CREATE TRIGGER trg_log_colaborador_onboarding_change
  AFTER INSERT OR UPDATE ON public.rh_colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.log_rh_stage_change('onboarding', 'onboarding_stage');

CREATE TRIGGER trg_log_avaliacao_status_change
  AFTER INSERT OR UPDATE ON public.rh_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.log_rh_stage_change('feedback', 'status');

CREATE TRIGGER trg_log_ferias_status_change
  AFTER INSERT OR UPDATE ON public.rh_ferias
  FOR EACH ROW EXECUTE FUNCTION public.log_rh_stage_change('ferias', 'status');

CREATE TRIGGER trg_log_treinamento_atrib_status_change
  AFTER INSERT OR UPDATE ON public.rh_treinamento_atribuicoes
  FOR EACH ROW EXECUTE FUNCTION public.log_rh_stage_change('treinamentos', 'status');
