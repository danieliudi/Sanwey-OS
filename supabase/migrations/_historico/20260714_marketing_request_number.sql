-- Número sequencial obrigatório de solicitação de marketing, formato
-- P00001, P00002, ... — pedido do usuário pra rastrear solicitações
-- (internas e do formulário público) com um protocolo padronizado.
--
-- Sequence (não max(id)+1) porque marketing_requests aceita INSERT direto
-- de anon (formulário público, ver marketing_requests_public_insert) —
-- nextval() é seguro sob inserts concorrentes, um trigger comparando o
-- maior número existente não seria.
CREATE SEQUENCE IF NOT EXISTS public.marketing_requests_number_seq START 1;

ALTER TABLE public.marketing_requests
  ADD COLUMN IF NOT EXISTS request_number text;

-- Backfill das solicitações já existentes, em ordem de criação.
WITH numbered AS (
  SELECT id, 'P' || lpad(nextval('public.marketing_requests_number_seq')::text, 5, '0') AS num
  FROM public.marketing_requests
  WHERE request_number IS NULL
  ORDER BY created_at
)
UPDATE public.marketing_requests r
SET request_number = numbered.num
FROM numbered
WHERE r.id = numbered.id;

ALTER TABLE public.marketing_requests
  ALTER COLUMN request_number SET DEFAULT ('P' || lpad(nextval('public.marketing_requests_number_seq')::text, 5, '0'));

ALTER TABLE public.marketing_requests
  ALTER COLUMN request_number SET NOT NULL;

ALTER TABLE public.marketing_requests
  DROP CONSTRAINT IF EXISTS marketing_requests_request_number_key;
ALTER TABLE public.marketing_requests
  ADD CONSTRAINT marketing_requests_request_number_key UNIQUE (request_number);

-- Carrega o número junto quando a solicitação vira entrega, pra manter
-- rastreabilidade na etapa "Solicitação" do Kanban de Entregas.
ALTER TABLE public.marketing_deliverables
  ADD COLUMN IF NOT EXISTS request_number text;

-- Mesma função de 20260713_atomic_approve_marketing_request.sql, só
-- acrescentando request_number na cópia pra marketing_deliverables.
CREATE OR REPLACE FUNCTION public.approve_marketing_request(p_request_id uuid, p_notes text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_req  public.marketing_requests%ROWTYPE;
  v_id   uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_uid AND role = ANY (ARRAY['admin', 'marketing', 'gerente_marketing'])
  ) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar solicitações de marketing';
  END IF;

  SELECT * INTO v_req FROM public.marketing_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;
  IF v_req.status <> 'pendente' THEN
    RAISE EXCEPTION 'Solicitação já foi decidida';
  END IF;

  INSERT INTO public.marketing_deliverables (
    title, requester_name, department, description, priority, deadline,
    company_ids, stage, notes, created_by, request_number
  )
  VALUES (
    v_req.title,
    v_req.requester_name,
    v_req.department,
    NULLIF(concat_ws(E'\n\n---\n', v_req.description, p_notes), ''),
    v_req.priority,
    v_req.deadline,
    coalesce(v_req.company_ids, '{}'),
    'solicitacao',
    CASE WHEN p_notes IS NOT NULL THEN jsonb_build_array(jsonb_build_object('text', p_notes, 'at', now())) ELSE '[]'::jsonb END,
    v_uid,
    v_req.request_number
  )
  RETURNING id INTO v_id;

  UPDATE public.marketing_requests
  SET status = 'aprovado', approved_at = now(), approved_by = v_uid, deliverable_id = v_id
  WHERE id = p_request_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_marketing_request(uuid, text) FROM PUBLIC, anon;
