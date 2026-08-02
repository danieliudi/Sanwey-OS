-- Figurinhas do Chat interno — pacote único/global (sem company_id: decisão
-- explícita do Daniel, ver docs/design-spec-chat-emoji-anexo-figurinhas-filtro.md
-- seção c/e.4 — figurinha de chat interno é sobre humor/cultura de equipe,
-- não identidade visual por frente comercial).

CREATE TABLE IF NOT EXISTS public.chat_stickers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,             -- label/alt text, mostrado no title do botão no picker
  image_path  text NOT NULL,             -- caminho dentro do bucket chat-stickers (não URL completa)
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_stickers_active_idx ON public.chat_stickers (active);

ALTER TABLE public.chat_stickers ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer colaborador autenticado vê as ativas (pro picker do
-- composer); gestor/admin (mesma regra de chat_is_manager usada em
-- chat_create_channel, migration 20260812_chat_interno_fase1.sql) também vê
-- as inativas, pro painel de gestão saber o que já foi desativado sem
-- precisar reativar às cegas.
DROP POLICY IF EXISTS chat_stickers_read ON public.chat_stickers;
CREATE POLICY chat_stickers_read ON public.chat_stickers FOR SELECT
  USING (active OR public.chat_is_manager(auth.uid()));

-- Escrita/remoção: mesma regra de quem cria canal no Chat hoje.
DROP POLICY IF EXISTS chat_stickers_write ON public.chat_stickers;
CREATE POLICY chat_stickers_write ON public.chat_stickers FOR INSERT
  WITH CHECK (public.chat_is_manager(auth.uid()));

DROP POLICY IF EXISTS chat_stickers_update ON public.chat_stickers;
CREATE POLICY chat_stickers_update ON public.chat_stickers FOR UPDATE
  USING      (public.chat_is_manager(auth.uid()))
  WITH CHECK (public.chat_is_manager(auth.uid()));

DROP POLICY IF EXISTS chat_stickers_delete ON public.chat_stickers;
CREATE POLICY chat_stickers_delete ON public.chat_stickers FOR DELETE
  USING (public.chat_is_manager(auth.uid()));

-- Bucket de Storage — público (conteúdo curado e não confidencial, carregado
-- com frequência no composer e nas bolhas de mensagem — getPublicUrl evita
-- round-trip de signed URL por figurinha, ao contrário de chat-attachments).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-stickers', 'chat-stickers', true, 2097152, ARRAY['image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS chat_stickers_storage_read ON storage.objects;
CREATE POLICY chat_stickers_storage_read ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-stickers');

DROP POLICY IF EXISTS chat_stickers_storage_write ON storage.objects;
CREATE POLICY chat_stickers_storage_write ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-stickers' AND public.chat_is_manager(auth.uid()));

DROP POLICY IF EXISTS chat_stickers_storage_delete ON storage.objects;
CREATE POLICY chat_stickers_storage_delete ON storage.objects FOR DELETE
  USING (bucket_id = 'chat-stickers' AND public.chat_is_manager(auth.uid()));
