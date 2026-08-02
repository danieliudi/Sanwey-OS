import { useCallback } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const BUCKET = "chat-attachments";

// Não guarda estado próprio (ao contrário de use-lead-attachments.js): o
// anexo já vive dentro do jsonb `attachments` de cada chat_messages, cuja
// lista é gerenciada por use-chat.js — este hook só empacota upload/URL
// assinada do bucket privado, mesmo padrão de Storage do Lead.
export function useChatAttachments() {
  const uploadAttachment = useCallback(async (file, channelId) => {
    if (!isSupabaseConfigured || !file || !channelId) return null;
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
    const path = `${channelId}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext ? `.${ext}` : ""}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (error) throw error;

    return { name: file.name, path, size: file.size, mime: file.type || null };
  }, []);

  const getSignedUrl = useCallback(async (path) => {
    if (!isSupabaseConfigured || !path) return null;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error) return null;
    return data?.signedUrl || null;
  }, []);

  return { uploadAttachment, getSignedUrl };
}

export default useChatAttachments;
