import React, { useState } from "react";
import { Pencil, Check, X } from "lucide-react";

// Título editável do card, na escala de um <h2> — mesma mecânica de
// EditableProtocolNumber.jsx (clique no lápis, Enter salva, Esc cancela),
// generalizada pro título inteiro. Lápis sempre visível (não só no hover):
// sinaliza "isto é editável" sem depender de mouse, funciona em touch/mobile.
// Padrão da plataforma pra título de card — usado em Campanhas, Entregas,
// Tarefas e Compras (spec aprovada com o Daniel).
export function EditableTitle({ value, canWrite, onSave, fontSize = 18 }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const headingStyle = { fontSize, color: "var(--text)", letterSpacing: "-0.01em", wordBreak: "break-word" };

  if (!canWrite) {
    return <h2 className="font-bold" style={headingStyle}>{value || "—"}</h2>;
  }

  if (!editing) {
    return (
      <h2 className="font-bold" style={{ ...headingStyle, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ wordBreak: "break-word" }}>{value || "—"}</span>
        <button
          onClick={(e) => { e.stopPropagation(); setDraft(value || ""); setError(null); setEditing(true); }}
          title="Editar título"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 2, display: "inline-flex", flexShrink: 0 }}
        >
          <Pencil size={14} />
        </button>
      </h2>
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
      setError(err?.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") save(e); if (e.key === "Escape") setEditing(false); }}
          style={{ flex: 1, minWidth: 0, fontSize, fontWeight: 700, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border-strong)", color: "var(--text)", background: "var(--surface)" }}
        />
        <button onClick={save} disabled={saving} title="Salvar"
          style={{ background: "none", border: "none", cursor: saving ? "wait" : "pointer", color: "var(--success)", padding: 2, display: "inline-flex", flexShrink: 0 }}>
          <Check size={16} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); setEditing(false); }} title="Cancelar"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 2, display: "inline-flex", flexShrink: 0 }}>
          <X size={16} />
        </button>
      </div>
      {error && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>{error}</div>}
    </div>
  );
}

export default EditableTitle;
