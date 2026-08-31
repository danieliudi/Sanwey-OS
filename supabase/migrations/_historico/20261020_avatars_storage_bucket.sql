-- F-05 da auditoria funcional (19/08/2026): avatar_url guardava a foto
-- inteira como base64 dentro de profiles (524KB de 534KB da tabela, pra só
-- 3 fotos cadastradas, sem teto de crescimento — reenviado por completo em
-- toda navegação do roster e em todo evento Realtime de profiles). Bucket
-- novo pra guardar só a foto; profiles.avatar_url passa a guardar a URL.
--
-- Leitura pública (mesmo raciocínio de chat-stickers, migration
-- 20260814_chat_stickers.sql: avatar aparece em toda a plataforma —
-- Sidebar, AvatarStack, CommentsPanel — carregar via getPublicUrl evita
-- round-trip de signed URL a cada render). Escrita restrita ao próprio
-- dono (path começa com o uuid do usuário) — hoje não existe upload de
-- avatar de terceiros em nenhuma tela administrativa (UserManagementView só
-- exibe, não edita foto de outro usuário).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS avatars_storage_read ON storage.objects;
CREATE POLICY avatars_storage_read ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS avatars_storage_write ON storage.objects;
CREATE POLICY avatars_storage_write ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS avatars_storage_update ON storage.objects;
CREATE POLICY avatars_storage_update ON storage.objects FOR UPDATE
  USING      (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS avatars_storage_delete ON storage.objects;
CREATE POLICY avatars_storage_delete ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
