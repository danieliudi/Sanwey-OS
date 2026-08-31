-- Anexo de mensagem do Chat interno (não figurinha) — bucket privado, mesmo
-- padrão de anexos de Lead/RH. Path: `${channelId}/${timestamp}-${rand}.ext`
-- (mesmo padrão de lead-attachments, migration
-- 20260713_fix_lead_attachments_storage_scope.sql). Escopo: só membro do
-- canal lê/envia/apaga — chat_is_member já existe (20260812).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments', 'chat-attachments', false, 10485760,
  ARRAY['application/pdf','application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv','text/plain',
        'image/jpeg','image/png','image/gif','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS chat_attachments_storage_read ON storage.objects;
CREATE POLICY chat_attachments_storage_read ON storage.objects FOR SELECT
  USING (
    bucket_id = 'chat-attachments'
    AND public.chat_is_member((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS chat_attachments_storage_insert ON storage.objects;
CREATE POLICY chat_attachments_storage_insert ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND public.chat_is_member((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS chat_attachments_storage_delete ON storage.objects;
CREATE POLICY chat_attachments_storage_delete ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chat-attachments'
    AND public.chat_is_member((storage.foldername(name))[1]::uuid)
  );
