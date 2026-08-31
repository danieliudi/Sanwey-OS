-- MD-03 da auditoria de segurança (19/08/2026), sub-achados (a) e (c) —
-- (b) (token opaco de upload de uso único) fica pra decisão separada com o
-- Daniel, é uma mudança maior (nova tabela + 2 formulários + 3 telas de
-- leitura em RHRecrutamentoView) — não misturar com este fix mais contido.
--
-- (a) FLOOD DE STORAGE: rh_curriculos_public_insert só exigia que o UUID da
-- pasta fosse de um candidato existente — nada limitava QUANTOS objetos iam
-- pra dentro dela. Um candidato real nunca passa de 1 arquivo por pasta
-- (upload usa upsert:true em nome fixo curriculo.<ext>); teto de 3 dá folga
-- pra reenvio com extensão diferente sem abrir a porta pra flood.
DROP POLICY IF EXISTS rh_curriculos_public_insert ON storage.objects;
CREATE POLICY rh_curriculos_public_insert ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'rh-curriculos'
    AND rh_candidato_exists((storage.foldername(name))[1]::uuid)
    AND (
      SELECT count(*) FROM storage.objects o
      WHERE o.bucket_id = 'rh-curriculos'
        AND (storage.foldername(o.name))[1] = (storage.foldername(name))[1]
    ) < 3
  );

-- (c) rh_curriculos_rh_read comparava profiles.role (cargo principal
-- escalar) — mesmo desalinhamento do achado AL-06, já corrigido em outras
-- policies com profiles.roles && (multi-cargo). Quem tem 'rh' como cargo
-- ADICIONAL (não principal) não conseguia abrir currículo nenhum.
DROP POLICY IF EXISTS rh_curriculos_rh_read ON storage.objects;
CREATE POLICY rh_curriculos_rh_read ON storage.objects FOR SELECT
  USING (
    bucket_id = 'rh-curriculos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.roles && ARRAY['admin','gerente_rh','rh']::text[]
    )
  );
