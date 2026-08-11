import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const TABLE = "email_templates";

// Templates de e-mail do Funil de Vendas — "shared" (padrão) visível pro
// time inteiro, "private" só o dono (RLS já filtra isso na leitura, ver
// migration crm_email_send_and_templates — decisão A do mockup aprovado
// 11/08/2026, qualquer papel comercial cria os próprios).
function rowToTemplate(r) {
  return {
    id: r.id,
    name: r.name,
    subject: r.subject,
    bodyHtml: r.body_html,
    scope: r.scope,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function useEmailTemplates(userId) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    const { data, error } = await supabase.from(TABLE).select("*").order("name", { ascending: true });
    if (!error) setTemplates((data || []).map(rowToTemplate));
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addTemplate = useCallback(async ({ name, subject, bodyHtml, scope = "shared" }) => {
    if (!isSupabaseConfigured || !userId) return null;
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ name, subject, body_html: bodyHtml, scope, created_by: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const mapped = rowToTemplate(data);
    setTemplates(prev => [...prev, mapped].sort((a, b) => a.name.localeCompare(b.name)));
    return mapped;
  }, [userId]);

  const updateTemplate = useCallback(async (id, patch) => {
    if (!isSupabaseConfigured) return;
    const row = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.subject !== undefined) row.subject = patch.subject;
    if (patch.bodyHtml !== undefined) row.body_html = patch.bodyHtml;
    if (patch.scope !== undefined) row.scope = patch.scope;
    row.updated_at = new Date().toISOString();
    const { error } = await supabase.from(TABLE).update(row).eq("id", id);
    if (error) throw new Error(error.message);
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }, []);

  const deleteTemplate = useCallback(async (id) => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw new Error(error.message);
    setTemplates(prev => prev.filter(t => t.id !== id));
  }, []);

  return { templates, loading, addTemplate, updateTemplate, deleteTemplate, refetch: fetchAll };
}

export default useEmailTemplates;
