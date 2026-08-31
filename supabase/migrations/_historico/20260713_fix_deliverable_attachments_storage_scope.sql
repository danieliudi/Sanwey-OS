-- Importante da auditoria: as 3 policies do bucket de Storage
-- deliverable-attachments só exigiam auth.role()='authenticated' — mesmo
-- furo do bucket lead-attachments, mas pro módulo de Marketing. Qualquer
-- papel da plataforma lia (createSignedUrl), inseria e apagava os arquivos
-- de entregáveis de marketing de ambas as empresas. Alinha ao mesmo escopo
-- agora aplicado à tabela de metadados (marketing + agencia).
DROP POLICY IF EXISTS "Deliverable attachments read" ON storage.objects;
CREATE POLICY "Deliverable attachments read"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'deliverable-attachments'
    AND (current_user_is_marketing() OR current_user_role() = 'agencia')
  );

DROP POLICY IF EXISTS "Deliverable attachments insert" ON storage.objects;
CREATE POLICY "Deliverable attachments insert"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'deliverable-attachments'
    AND (current_user_is_marketing() OR current_user_role() = 'agencia')
  );

DROP POLICY IF EXISTS "Deliverable attachments delete" ON storage.objects;
CREATE POLICY "Deliverable attachments delete"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'deliverable-attachments'
    AND (current_user_is_marketing() OR current_user_role() = 'agencia')
  );
