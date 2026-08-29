import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "marketing_quote_email_template";

export function useMarketingQuoteTemplate({ enabled = true } = {}) {
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTemplate = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.from(TABLE).select("*").single();
      if (err) throw err;
      setTemplate(data ? { subject: data.subject, bodyHtml: data.body_html, updatedAt: data.updated_at } : null);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { fetchTemplate(); }, [fetchTemplate]);

  const saveTemplate = useCallback(async ({ subject, bodyHtml }, userId) => {
    if (!isSupabaseConfigured) return;
    const { data, error: err } = await supabase.from(TABLE).update({
      subject, body_html: bodyHtml, updated_by: userId ?? null, updated_at: new Date().toISOString(),
    }).eq("id", true).select();
    if (err) throw err;
    // Zero linha = RLS barrou (a policy de update é só admin/gerente_marketing).
    if (!data || data.length === 0) throw new Error("Não foi possível salvar o modelo de e-mail de cotação — verifique suas permissões.");
    setTemplate({ subject, bodyHtml, updatedAt: new Date().toISOString() });
  }, []);

  return { template, loading, error, saveTemplate, refetch: fetchTemplate };
}

export default useMarketingQuoteTemplate;
