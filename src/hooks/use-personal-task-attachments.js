import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE  = "personal_task_attachments";
const BUCKET = "personal-task-attachments";

// Mesmo formato de use-deliverable-attachments.js. Path no bucket é
// `${userId}/${taskId}/...` (não só `${taskId}/...`) porque a policy de
// Storage lê o 1º segmento do path pra confirmar dono — ver migration
// 20260828_personal_tasks_level1_level2.sql.
export function usePersonalTaskAttachments(taskId, userId) {
  const [attachments, setAttachments] = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [error,       setError]       = useState(null);

  const fetch = useCallback(async () => {
    if (!taskId || !isSupabaseConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from(TABLE)
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (err) throw err;
      setAttachments(data || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { fetch(); }, [fetch]);

  const upload = useCallback(async (file) => {
    if (!isSupabaseConfigured || !userId) return null;
    setUploading(true);
    setError(null);
    try {
      const ext  = file.name.split(".").pop();
      const path = `${userId}/${taskId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: storageErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (storageErr) throw storageErr;

      const { data, error: dbErr } = await supabase
        .from(TABLE)
        .insert({
          task_id:   taskId,
          user_id:   userId,
          file_name: file.name,
          file_path: path,
          file_size: file.size,
          mime_type: file.type || null,
        })
        .select()
        .single();
      if (dbErr) throw dbErr;

      setAttachments(prev => [data, ...prev]);
      return data;
    } catch (e) {
      setError(e.message || String(e));
      return null;
    } finally {
      setUploading(false);
    }
  }, [taskId, userId]);

  const remove = useCallback(async (attachment) => {
    if (!isSupabaseConfigured) return;
    try {
      await supabase.storage.from(BUCKET).remove([attachment.file_path]);
      await supabase.from(TABLE).delete().eq("id", attachment.id);
      setAttachments(prev => prev.filter(a => a.id !== attachment.id));
    } catch (e) {
      setError(e.message || String(e));
    }
  }, []);

  const getSignedUrl = useCallback(async (filePath) => {
    if (!isSupabaseConfigured) return null;
    const { data, error: err } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 3600);
    if (err) return null;
    return data?.signedUrl || null;
  }, []);

  return { attachments, loading, uploading, error, upload, remove, getSignedUrl, refetch: fetch };
}

export default usePersonalTaskAttachments;
