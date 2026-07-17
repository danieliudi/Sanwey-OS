-- Onda 3 (item 9) — aprovar/recusar movimentação. Clonadas de
-- approve/reject_marketing_quote: SECURITY DEFINER, checa diretoria(admin),
-- trava a linha (FOR UPDATE), rejeita se já decidida. NO approve, aplica de
-- fato o novo salário/cargo/departamento em rh_colaboradores — a ÚNICA via
-- que muda o dado do colaborador é passar pela aprovação.
--
-- Já aplicada ao projeto vivo via MCP (apply_migration); este arquivo existe
-- para que um `supabase db reset` reproduza o mesmo schema.
CREATE OR REPLACE FUNCTION public.approve_rh_movimentacao(p_id uuid)
RETURNS public.rh_movimentacoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.rh_movimentacoes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF NOT current_user_is_admin() THEN
    RAISE EXCEPTION 'Apenas a diretoria pode aprovar movimentações';
  END IF;

  SELECT * INTO v_row FROM public.rh_movimentacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimentação não encontrada';
  END IF;
  IF v_row.status <> 'pendente' THEN
    RAISE EXCEPTION 'Movimentação já foi decidida';
  END IF;

  UPDATE public.rh_movimentacoes
  SET status = 'aprovado', approved_by = v_uid, approved_at = now(), status_changed_at = now()
  WHERE id = p_id
  RETURNING * INTO v_row;

  UPDATE public.rh_colaboradores
  SET salary     = COALESCE(v_row.salario_novo, salary),
      job_title  = COALESCE(v_row.cargo_novo, job_title),
      department = COALESCE(v_row.department_novo, department),
      updated_at = now()
  WHERE id = v_row.colaborador_id;

  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_rh_movimentacao(p_id uuid, p_motivo text DEFAULT NULL::text)
RETURNS public.rh_movimentacoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.rh_movimentacoes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF NOT current_user_is_admin() THEN
    RAISE EXCEPTION 'Apenas a diretoria pode recusar movimentações';
  END IF;

  SELECT * INTO v_row FROM public.rh_movimentacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimentação não encontrada';
  END IF;
  IF v_row.status <> 'pendente' THEN
    RAISE EXCEPTION 'Movimentação já foi decidida';
  END IF;

  UPDATE public.rh_movimentacoes
  SET status = 'recusado', approved_by = v_uid, approved_at = now(), status_changed_at = now(), motivo_recusa = p_motivo
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.approve_rh_movimentacao(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_rh_movimentacao(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_rh_movimentacao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_rh_movimentacao(uuid, text) TO authenticated;
