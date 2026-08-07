-- Pedido do Daniel (07/08/2026, referência: histórico de etapa do Pipefy):
-- o histórico de etapa (rh_stage_history) só guardava from_stage/to_stage/
-- changed_at/changed_by — "Mostrar mais" em cada entrada não tinha o que
-- mostrar além disso. Uma primeira proposta (mostrar o valor ATUAL de
-- custom_fields, sem coluna nova) foi rejeitada explicitamente: se o
-- mesmo card passa pela mesma etapa mais de uma vez (ex.: reprovado, refeito,
-- reprovado de novo), o valor atual é só o mais recente — as passagens
-- antigas ficariam com o mesmo valor errado. Daniel pediu histórico real,
-- por passagem.
--
-- Fix: cada linha de rh_stage_history ganha uma cópia congelada de
-- custom_fields no momento exato da transição (capturada dentro do mesmo
-- trigger AFTER INSERT/UPDATE que já grava a linha — log_rh_stage_change(),
-- migration 20260715). NEW.custom_fields nesse ponto já reflete qualquer
-- edição de campo salva ANTES do card mudar de etapa (mesma transação
-- sequencial: editar campo é um UPDATE separado, sempre commitado antes do
-- UPDATE de mudança de etapa), então o snapshot da transição "Reprovado →
-- Em produção" carrega exatamente o que foi preenchido durante a
-- passagem por "Reprovado".
--
-- to_jsonb(NEW) -> 'custom_fields' é seguro pras tabelas que não têm essa
-- coluna (ex.: marketing_purchase_requests/Compras, que usa o motor
-- hardcoded PURCHASE_STAGES, não rh_pipeline_stage_fields — ver CLAUDE.md
-- regra 2): a chave simplesmente não existe no jsonb da linha, e o
-- operador -> retorna NULL em vez de erro.

ALTER TABLE public.rh_stage_history
  ADD COLUMN IF NOT EXISTS custom_fields_snapshot jsonb;

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
      INSERT INTO public.rh_stage_history (domain, record_id, from_stage, to_stage, changed_at, changed_by, custom_fields_snapshot)
      VALUES (domain_name, NEW.id, NULL, new_stage, now(), auth.uid(), to_jsonb(NEW) -> 'custom_fields');
    END IF;
    RETURN NEW;
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    old_stage := to_jsonb(OLD) ->> stage_col;
    IF old_stage IS DISTINCT FROM new_stage THEN
      INSERT INTO public.rh_stage_history (domain, record_id, from_stage, to_stage, changed_at, changed_by, custom_fields_snapshot)
      VALUES (domain_name, NEW.id, old_stage, new_stage, now(), auth.uid(), to_jsonb(NEW) -> 'custom_fields');
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;
