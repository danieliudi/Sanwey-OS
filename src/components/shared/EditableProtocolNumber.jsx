import React, { useState } from "react";
import { Pencil, Check, X } from "lucide-react";

// Número de protocolo (P00001…) é gerado automaticamente, mas pode ser
// corrigido manualmente — o banco valida duplicidade (trigger de sincronia
// do razão compartilhado entre Solicitações de Marketing e Entregas) e
// devolve um erro de chave duplicada, que aqui vira uma mensagem legível.
export function EditableProtocolNumber({ value, canWrite, onSave, mono = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!canWrite) {
    return <span style={{ fontFamily: mono ? "monospace" : undefined }}>{value || "—"}</span>;
  }

  if (!editing) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontFamily: mono ? "monospace" : undefined }}>{value || "—"}</span>
        <button
          onClick={(e) => { e.stopPropagation(); setDraft(value || ""); setError(null); setEditing(true); }}
          title="Editar número de protocolo"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 1, display: "inline-flex" }}
        >
          <Pencil size={11} />
        </button>
      </span>
    );
  }

  const save = async (e) => {
    e?.stopPropagation();
    const trimmed = draft.trim();
    if (!trimmed || trimmed === value) { setEditing(false); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch (err) {
      setError(err?.message?.includes("inválido")
        ? "Número inválido — use um valor entre 1 e 999999."
        : err?.message?.includes("marketing_protocol_numbers_pkey")
        ? "Esse número já está em uso."
        : (err?.message || "Erro ao salvar."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", verticalAlign: "middle" }} onClick={e => e.stopPropagation()}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
        <input
          autoFocus
          value={draft}
          maxLength={8}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") save(e); if (e.key === "Escape") setEditing(false); }}
          style={{ fontSize: 12, padding: "2px 5px", borderRadius: 5, border: "1px solid var(--border)", color: "var(--text)", background: "var(--surface)", width: 90 }}
        />
        <button onClick={save} disabled={saving} title="Salvar"
          style={{ background: "none", border: "none", cursor: saving ? "wait" : "pointer", color: "var(--success)", padding: 1, display: "inline-flex" }}>
          <Check size={12} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); setEditing(false); }} title="Cancelar"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 1, display: "inline-flex" }}>
          <X size={12} />
        </button>
      </span>
      {error && <span style={{ fontSize: 10, color: "var(--danger)", marginTop: 2 }}>{error}</span>}
    </span>
  );
}
