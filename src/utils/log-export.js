import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Trilha auditável de exportações de dados (leads, clientes, viagens...) —
// proteção contra vazamento pra concorrente. Fire-and-forget: uma falha
// aqui não deve travar o download em si, só o download já aconteceu no
// momento em que essa função é chamada (ver call sites em CRMView,
// DashboardView, ExplorerView).
export function logExport(userId, domain, recordCount, meta = null) {
  if (!isSupabaseConfigured || !userId) return;
  supabase.from("export_audit_log").insert({
    exported_by: userId,
    domain,
    record_count: recordCount,
    meta,
  }).then(({ error }) => {
    if (error) console.warn("Falha ao registrar auditoria de exportação:", error.message);
  });
}
