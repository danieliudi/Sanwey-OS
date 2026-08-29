import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Biblioteca de documentos técnicos (18/08/2026) — repositório reutilizável
// de datasheet/certificado (ISO 9001, INMETRO, FSSC, ficha técnica de modelo
// Sanbag). Diferente de lead_attachments: o registro de metadados
// (document_library) nasce ANTES do upload — a policy de Storage de INSERT
// exige que a linha já exista (mesmo padrão de lead-attachments, que exige
// o lead já existir), então o id é gerado no cliente (crypto.randomUUID(),
// mesmo precedente de leads) pra poder montar o path antes do insert.

const TABLE = "document_library";
const BUCKET = "document-library";

export function useDocumentLibrary() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from(TABLE)
        .select("*")
        .order("created_at", { ascending: false });
      if (err) throw err;
      setDocuments(data || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const create = useCallback(async (file, { title, category, tags = [], companyIds = [], expiresAt, uploadedBy }) => {
    if (!isSupabaseConfigured) return null;
    const id = crypto.randomUUID();
    const ext = file.name.split(".").pop();
    const path = `${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { data, error: dbErr } = await supabase.from(TABLE).insert({
      id, title, category, tags, company_ids: companyIds,
      file_name: file.name, file_path: path, file_size: file.size, mime_type: file.type || null,
      expires_at: expiresAt || null, uploaded_by: uploadedBy || null,
    }).select().single();
    if (dbErr) throw new Error(dbErr.message);

    const { error: storageErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (storageErr) {
      // Rollback: sem arquivo, o registro de metadados não serve de nada —
      // não deixa entulho na biblioteca.
      await supabase.from(TABLE).delete().eq("id", id);
      throw new Error(storageErr.message);
    }

    setDocuments(prev => [data, ...prev]);
    return data;
  }, []);

  const update = useCallback(async (id, patch) => {
    const { data, error: err } = await supabase.from(TABLE).update({
      title: patch.title, category: patch.category, tags: patch.tags,
      company_ids: patch.companyIds, expires_at: patch.expiresAt || null,
    }).eq("id", id).select();
    if (err) throw new Error(err.message);
    // Zero linha = RLS barrou (UPDATE bloqueado volta error:null/data:[]).
    if (!data || data.length === 0) throw new Error("Não foi possível salvar o documento — verifique suas permissões.");
    await fetchAll();
  }, [fetchAll]);

  // Troca o conteúdo do arquivo sem trocar o registro (mesmo id/file_path) —
  // upsert:true sobrescreve o objeto no bucket no lugar, então quem já
  // anexou este documento a um negócio (lead_document_refs) continua
  // apontando pro mesmo document_library_id, sem precisar reanexar.
  const replaceFile = useCallback(async (doc, file) => {
    const { error: storageErr } = await supabase.storage
      .from(BUCKET)
      .upload(doc.file_path, file, { contentType: file.type, upsert: true });
    if (storageErr) throw new Error(storageErr.message);
    const { data, error: dbErr } = await supabase.from(TABLE).update({
      file_name: file.name, file_size: file.size, mime_type: file.type || null,
    }).eq("id", doc.id).select();
    if (dbErr) throw new Error(dbErr.message);
    // Zero linha = RLS barrou. Grave: o arquivo novo JÁ subiu por cima do
    // antigo no Storage (upsert), então sem avisar a lista seguiria mostrando
    // nome/tamanho do arquivo velho pra um conteúdo que já mudou.
    if (!data || data.length === 0) {
      throw new Error("O arquivo foi enviado, mas o documento não foi atualizado — verifique suas permissões.");
    }
  }, []);

  const remove = useCallback(async (doc) => {
    await supabase.storage.from(BUCKET).remove([doc.file_path]);
    const { error: err } = await supabase.from(TABLE).delete().eq("id", doc.id);
    if (err) throw new Error(err.message);
    setDocuments(prev => prev.filter(d => d.id !== doc.id));
  }, []);

  const getSignedUrl = useCallback(async (filePath) => {
    if (!isSupabaseConfigured) return null;
    const { data, error: err } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 3600);
    if (err) return null;
    return data?.signedUrl || null;
  }, []);

  return { documents, loading, error, create, update, replaceFile, remove, getSignedUrl, refetch: fetchAll };
}

// "Anexar da biblioteca" num negócio — lead_document_refs (só a referência,
// nunca copia o arquivo pro bucket do lead, ver migration document_library).
export function useLeadDocumentRefs(leadId) {
  const [refs, setRefs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !leadId) { setRefs([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("lead_document_refs")
      .select("id, lead_id, document_library_id, created_at, document_library(id, title, category, file_name, file_path, mime_type, expires_at)")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    if (!error) setRefs(data || []);
    setLoading(false);
  }, [leadId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const attach = useCallback(async (documentLibraryId, attachedBy) => {
    const { error } = await supabase.from("lead_document_refs").insert({
      lead_id: leadId, document_library_id: documentLibraryId, attached_by: attachedBy || null,
    });
    if (error) throw new Error(error.message);
    await fetchAll();
  }, [leadId, fetchAll]);

  const detach = useCallback(async (refId) => {
    const { error } = await supabase.from("lead_document_refs").delete().eq("id", refId);
    if (error) throw new Error(error.message);
    setRefs(prev => prev.filter(r => r.id !== refId));
  }, []);

  return { refs, loading, attach, detach, refetch: fetchAll };
}

export default useDocumentLibrary;
