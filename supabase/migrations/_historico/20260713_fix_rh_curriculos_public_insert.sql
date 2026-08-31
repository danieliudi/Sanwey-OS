-- Importante da auditoria: rh_curriculos_public_insert só checava
-- bucket_id — o path ("{candidateId}/curriculo.ext") é 100% definido pelo
-- cliente (JobApplicationForm.jsx) e o anon tem grant de INSERT. Qualquer
-- anônimo grava arquivos em paths arbitrários e ilimitados (flood/DoS de
-- storage), sem nenhum vínculo com um candidato real. O fluxo legítimo
-- sempre chama submit_job_application ANTES do upload e usa o candidateId
-- retornado — exige que o primeiro segmento do path corresponda a um
-- candidato de fato existente.
--
-- rh_candidatos só tem policy RH (ALL, sem SELECT pra anon), então um
-- EXISTS direto sempre resolveria falso pro fluxo público — usa uma função
-- SECURITY DEFINER que só responde um boolean, sem expor nenhuma coluna do
-- candidato ao anônimo.
CREATE OR REPLACE FUNCTION public.rh_candidato_exists(p_candidate_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.rh_candidatos WHERE id = p_candidate_id);
$$;

REVOKE ALL ON FUNCTION public.rh_candidato_exists(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rh_candidato_exists(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS rh_curriculos_public_insert ON storage.objects;
CREATE POLICY rh_curriculos_public_insert
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'rh-curriculos'
    AND public.rh_candidato_exists(((storage.foldername(storage.objects.name))[1])::uuid)
  );
