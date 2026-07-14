-- Deixa o solicitante externo (anon) ver o protocolo (P00001...) atribuído
-- à própria solicitação recém-criada, sem abrir SELECT geral na tabela —
-- marketing_requests_read exige profiles.role (admin/marketing/
-- gerente_marketing), então um simples `.select()` após o insert do
-- formulário público sempre falharia (RETURNING também é filtrado pela
-- policy de SELECT). RPC estreita: só devolve o número de um id específico.
CREATE OR REPLACE FUNCTION public.get_marketing_request_number(p_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT request_number FROM public.marketing_requests WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION public.get_marketing_request_number(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_marketing_request_number(uuid) TO anon, authenticated;
