import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE  = "marketing_campaign_attachments";
const BUCKET = "marketing-attachments";

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function extractFolderId(url) {
  if (!url) return null;
  const m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

export function useMarketingCampaignAttachments(campaignId) {
  const [attachments, setAttachments] = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [error,       setError]       = useState(null);

  const fetch = useCallback(async () => {
    if (!campaignId || !isSupabaseConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from(TABLE)
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });
      if (err) throw err;
      setAttachments(data || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { fetch(); }, [fetch]);

  const upload = useCallback(async (file, { companyIds = [], uploadedBy = null, driveFolderId = null, driveFolderUrl = null }) => {
    if (!isSupabaseConfigured) return null;
    setUploading(true);
    setError(null);
    try {
      const ext  = file.name.split(".").pop();
      const path = `${campaignId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: storageErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (storageErr) throw storageErr;

      // Try to upload to Google Drive if folder is configured
      let driveUrl = null;
      const folderId = driveFolderId || extractFolderId(driveFolderUrl);
      if (folderId) {
        try {
          const b64 = await fileToBase64(file);
          const { data: driveData, error: driveErr } = await supabase.functions.invoke(
            "google-drive-upload",
            { body: { fileBase64: b64, fileName: file.name, mimeType: file.type || "application/octet-stream", folderId } }
          );
          if (!driveErr && driveData?.driveWebViewLink) {
            driveUrl = driveData.driveWebViewLink;
          }
        } catch {
          // Drive upload failure is non-fatal — file is still in Supabase Storage
        }
      }

      const { data, error: dbErr } = await supabase
        .from(TABLE)
        .insert({
          campaign_id: campaignId,
          company_ids: companyIds,
          file_name:   file.name,
          file_path:   path,
          file_size:   file.size,
          mime_type:   file.type || null,
          drive_url:   driveUrl,
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
  }, [campaignId]);

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
