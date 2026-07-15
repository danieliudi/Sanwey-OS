-- Bucket pra documentos enviados pra assinatura eletrônica via D4Sign
-- (item 12) — separado de rh-documentos-colaborador (RG/CNH, só pra
-- preenchimento automático), já que aqui o documento normalmente é um
-- contrato/termo que o colaborador vai efetivamente assinar.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rh-documentos-assinatura', 'rh-documentos-assinatura', false, 10485760,
  ARRAY['application/pdf','image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'rh_doc_assinatura_rh_access'
  ) THEN
    CREATE POLICY "rh_doc_assinatura_rh_access" ON storage.objects
      FOR ALL
      USING (bucket_id = 'rh-documentos-assinatura' AND public.current_user_is_rh())
      WITH CHECK (bucket_id = 'rh-documentos-assinatura' AND public.current_user_is_rh());
  END IF;
END $$;
