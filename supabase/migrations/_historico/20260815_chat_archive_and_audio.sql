-- Chat mobile: arquivar conversa (por usuário) + suporte a mensagem de áudio.
-- Spec: docs/design-spec-chat-mobile-whatsapp.md, seções 2 e 4. Mockup
-- aprovado por Daniel conta como a confirmação da regra 5 do CLAUDE.md pra
-- este schema (mesmo padrão já usado pra chat_stickers).

-- Arquivamento é por participante (não some pra ninguém mais, cada membro
-- decide sozinho) — coluna nova em chat_channel_members, não em
-- chat_channels (que já tem seu próprio archived_at, de escopo diferente:
-- canal inteiro desativado, hoje sem nenhuma tela que o usa).
ALTER TABLE public.chat_channel_members
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Policy de self-update (chat_members_update_self, migration
-- 20260812_chat_interno_fase1.sql:146-149) já cobre update de qualquer
-- coluna da própria linha — nenhuma mudança de RLS necessária.

-- chat_my_channels precisa devolver archived_at por membro pra tela filtrar
-- a lista principal x "Arquivadas". Muda o formato de retorno da função,
-- então precisa DROP antes do CREATE (Postgres não deixa CREATE OR REPLACE
-- mudar a lista de colunas de saída).
DROP FUNCTION IF EXISTS public.chat_my_channels();

CREATE OR REPLACE FUNCTION public.chat_my_channels()
RETURNS TABLE (
  id uuid, kind text, name text, icon text, description text, read_only boolean,
  updated_at timestamptz, last_read_at timestamptz, archived_at timestamptz, unread_count bigint,
  last_message_body text, last_message_at timestamptz, last_message_author uuid,
  dm_peer_id uuid, dm_peer_name text, dm_peer_initials text, dm_peer_avatar_bg text
)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    c.id, c.kind, c.name, c.icon, c.description, c.read_only, c.updated_at, m.last_read_at, m.archived_at,
    (SELECT count(*) FROM public.chat_messages msg
      WHERE msg.channel_id = c.id AND msg.deleted_at IS NULL
        AND msg.author_id <> auth.uid()
        AND (m.last_read_at IS NULL OR msg.created_at > m.last_read_at)) AS unread_count,
    lm.body, lm.created_at, lm.author_id,
    peer.id, peer.name, peer.initials, peer.avatar_bg
  FROM public.chat_channel_members m
  JOIN public.chat_channels c ON c.id = m.channel_id AND c.archived_at IS NULL
  LEFT JOIN LATERAL (
    SELECT body, created_at, author_id FROM public.chat_messages
    WHERE channel_id = c.id AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  ) lm ON true
  LEFT JOIN LATERAL (
    SELECT p.id, p.name, p.initials, p.avatar_bg
    FROM public.chat_channel_members m2
    JOIN public.profiles p ON p.id = m2.user_id
    WHERE c.kind = 'dm' AND m2.channel_id = c.id AND m2.user_id <> auth.uid()
    LIMIT 1
  ) peer ON true
  WHERE m.user_id = auth.uid()
  ORDER BY coalesce(lm.created_at, c.updated_at) DESC;
$$;

-- DROP+CREATE reseta o GRANT padrão (EXECUTE pra PUBLIC) — sem isto a
-- função voltaria a ficar chamável por `anon`, mesmo achado do linter que a
-- migration original (20260812) já tinha corrigido pras demais funções do
-- Chat.
REVOKE EXECUTE ON FUNCTION public.chat_my_channels() FROM anon;

-- Mensagem de áudio reaproveita o bucket de anexos existente (attachments
-- jsonb de chat_messages, type: "audio") — só precisa aceitar o mimetype que
-- o MediaRecorder do navegador produz (webm é o padrão em Chrome/Firefox;
-- ogg como fallback de codec em navegadores que não suportam webm).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments', 'chat-attachments', false, 10485760,
  ARRAY['application/pdf','application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv','text/plain',
        'image/jpeg','image/png','image/gif','image/webp',
        'audio/webm','audio/ogg']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
