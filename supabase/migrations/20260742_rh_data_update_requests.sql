-- Painel do colaborador: "solicitar atualização de dados" — mirror do
-- padrão já usado em rh_movimentacoes (proposto pelo colaborador, só entra
-- em rh_colaboradores depois que o RH aprova). Campos permitidos ficam
-- restritos a contato/endereço — nome/CPF/RG/cargo/departamento/admissão
-- exigem documento e já têm seus próprios fluxos (edição direta por RH,
-- ou rh_movimentacoes pra cargo/salário/departamento).
CREATE TABLE IF NOT EXISTS public.rh_data_update_requests (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid        NOT NULL REFERENCES public.rh_colaboradores(id) ON DELETE CASCADE,
  requested_by   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  field          text        NOT NULL CHECK (field IN (
                   'phone','email','address_street','address_number','address_complement',
                   'address_neighborhood','address_city','address_state','address_zip'
                 )),
  current_value  text,
  new_value      text        NOT NULL,
  motivo         text,
  status         text        NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','recusado')),
  reviewed_by    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at    timestamptz,
  motivo_recusa  text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rh_data_update_requests_colaborador_idx ON public.rh_data_update_requests (colaborador_id);

ALTER TABLE public.rh_data_update_requests ENABLE ROW LEVEL SECURITY;

-- Colaborador só propõe update na PRÓPRIA linha (is_own_colaborador), já
-- pendente e sem reviewer preenchido — mesma trava usada em rh_ferias_insert
-- pra impedir auto-aprovação disfarçada de insert.
CREATE POLICY rh_data_update_requests_self_insert ON public.rh_data_update_requests
  FOR INSERT WITH CHECK (
    requested_by = auth.uid()
    AND is_own_colaborador(colaborador_id)
    AND status = 'pendente'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );

CREATE POLICY rh_data_update_requests_self_read ON public.rh_data_update_requests
  FOR SELECT USING (requested_by = auth.uid());

CREATE POLICY rh_data_update_requests_rh_access ON public.rh_data_update_requests
  FOR ALL USING (
    current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh')
  )
  WITH CHECK (
    current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh')
  );

-- Aprovar: só RH/admin, trava a linha, aplica o novo valor no campo
-- correspondente de rh_colaboradores via CASE explícito (sem SQL dinâmico —
-- não há como injetar nome de coluna arbitrário aqui).
CREATE OR REPLACE FUNCTION public.approve_rh_data_update_request(p_id uuid)
RETURNS public.rh_data_update_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.rh_data_update_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF NOT (current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh')) THEN
    RAISE EXCEPTION 'Apenas RH pode aprovar solicitações de atualização';
  END IF;

  SELECT * INTO v_row FROM public.rh_data_update_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;
  IF v_row.status <> 'pendente' THEN
    RAISE EXCEPTION 'Solicitação já foi decidida';
  END IF;

  UPDATE public.rh_data_update_requests
  SET status = 'aprovado', reviewed_by = v_uid, reviewed_at = now()
  WHERE id = p_id
  RETURNING * INTO v_row;

  UPDATE public.rh_colaboradores SET
    phone                = CASE WHEN v_row.field = 'phone'                THEN v_row.new_value ELSE phone END,
    email                = CASE WHEN v_row.field = 'email'                THEN v_row.new_value ELSE email END,
    address_street       = CASE WHEN v_row.field = 'address_street'       THEN v_row.new_value ELSE address_street END,
    address_number       = CASE WHEN v_row.field = 'address_number'       THEN v_row.new_value ELSE address_number END,
    address_complement   = CASE WHEN v_row.field = 'address_complement'   THEN v_row.new_value ELSE address_complement END,
    address_neighborhood = CASE WHEN v_row.field = 'address_neighborhood' THEN v_row.new_value ELSE address_neighborhood END,
    address_city         = CASE WHEN v_row.field = 'address_city'         THEN v_row.new_value ELSE address_city END,
    address_state        = CASE WHEN v_row.field = 'address_state'        THEN v_row.new_value ELSE address_state END,
    address_zip          = CASE WHEN v_row.field = 'address_zip'          THEN v_row.new_value ELSE address_zip END,
    updated_at            = now()
  WHERE id = v_row.colaborador_id;

  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_rh_data_update_request(p_id uuid, p_motivo text DEFAULT NULL::text)
RETURNS public.rh_data_update_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.rh_data_update_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF NOT (current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh')) THEN
    RAISE EXCEPTION 'Apenas RH pode recusar solicitações de atualização';
  END IF;

  SELECT * INTO v_row FROM public.rh_data_update_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;
  IF v_row.status <> 'pendente' THEN
    RAISE EXCEPTION 'Solicitação já foi decidida';
  END IF;

  UPDATE public.rh_data_update_requests
  SET status = 'recusado', reviewed_by = v_uid, reviewed_at = now(), motivo_recusa = p_motivo
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.approve_rh_data_update_request(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_rh_data_update_request(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_rh_data_update_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_rh_data_update_request(uuid, text) TO authenticated;
