import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "lead_attachments";
const BUCKET = "lead-attachments";

export function useLeadAttachments(leadId) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!leadId || !isSupabaseConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from(TABLE)
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (err) throw err;
      setAttachments(data || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { fetch(); }, [fetch]);

  const upload = useCallback(async (file, { leadId: lid, companyId, uploadedBy }) => {
    if (!isSupabaseConfigured) return null;
    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop();
      const path = `${lid}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: storageErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (storageErr) throw storageErr;

      const { data, error: dbErr } = await supabase
        .from(TABLE)
        .insert({
          lead_id: lid,
          company_id: companyId,
          file_name: file.name,
          file_path: path,
          file_size: file.size,
          mime_type: file.type || null,
          uploaded_by: uploadedBy || null,
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
  }, []);

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

  const getUrl = useCallback((filePath) => {
    if (!isSupabaseConfigured) return null;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    return data?.publicUrl || null;
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
