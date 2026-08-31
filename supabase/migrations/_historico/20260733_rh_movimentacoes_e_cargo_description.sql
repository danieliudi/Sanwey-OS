-- Onda 3 (itens 8+9) — Cargos & Salários + Movimentação com aprovação.
--
-- (8) Descrição de cargo no catálogo (base pra geração por IA).
--
-- Já aplicada ao projeto vivo via MCP (apply_migration); este arquivo existe
-- para que um `supabase db reset` reproduza o mesmo schema.
ALTER TABLE public.rh_cargo_templates
  ADD COLUMN IF NOT EXISTS description text;
COMMENT ON COLUMN public.rh_cargo_templates.description IS 'Descrição do cargo (responsabilidades/requisitos) — pode ser gerada por IA';

-- (8+9) Movimentações de cargo/salário: fonte de verdade única do histórico
-- E do fluxo de aprovação. Modelada em rh_ferias/cotações (status
-- pendente/aprovado/recusado + approved_by/at + activities). A mutação de fato
-- em rh_colaboradores só acontece DENTRO da RPC de aprovação — a diretoria
-- (=admin, principal reaproveitado) é a única que decide.
CREATE TABLE IF NOT EXISTS public.rh_movimentacoes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id     uuid NOT NULL REFERENCES public.rh_colaboradores(id) ON DELETE CASCADE,
  tipo               text NOT NULL DEFAULT 'promocao'
                       CHECK (tipo = ANY (ARRAY['promocao','merito','transferencia','rebaixamento','ajuste'])),
  cargo_anterior     text,
  cargo_novo         text,
  department_anterior text,
  department_novo    text,
  salario_anterior   numeric,
  salario_novo       numeric,
  effective_date     date,
  motivo             text,
  status             text NOT NULL DEFAULT 'pendente'
                       CHECK (status = ANY (ARRAY['pendente','aprovado','recusado'])),
  avaliacao_id       uuid REFERENCES public.rh_avaliacoes(id) ON DELETE SET NULL,
  requested_by       uuid,
  approved_by        uuid,
  approved_at        timestamptz,
  motivo_recusa      text,
  activities         jsonb NOT NULL DEFAULT '[]'::jsonb,
  status_changed_at  timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rh_movimentacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rh_movimentacoes_select ON public.rh_movimentacoes;
CREATE POLICY rh_movimentacoes_select ON public.rh_movimentacoes
  FOR SELECT USING (
    current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh')
  );

DROP POLICY IF EXISTS rh_movimentacoes_insert ON public.rh_movimentacoes;
CREATE POLICY rh_movimentacoes_insert ON public.rh_movimentacoes
  FOR INSERT WITH CHECK (
    (current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh'))
    AND status = 'pendente' AND approved_by IS NULL AND approved_at IS NULL
  );

DROP POLICY IF EXISTS rh_movimentacoes_update ON public.rh_movimentacoes;
CREATE POLICY rh_movimentacoes_update ON public.rh_movimentacoes
  FOR UPDATE USING (
    current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh')
  );

CREATE OR REPLACE FUNCTION public.rh_movimentacoes_guard_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF OLD.status = 'pendente' AND NEW.status IN ('aprovado','recusado')
     AND NOT current_user_is_admin() THEN
    NEW.status := OLD.status;
    NEW.approved_by := OLD.approved_by;
    NEW.approved_at := OLD.approved_at;
    NEW.motivo_recusa := OLD.motivo_recusa;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS rh_movimentacoes_guard ON public.rh_movimentacoes;
CREATE TRIGGER rh_movimentacoes_guard
  BEFORE UPDATE ON public.rh_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.rh_movimentacoes_guard_approval();
