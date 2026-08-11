import React, { useState } from "react";
import { Modal } from "../ui/Modal";

const inputBase = {
  width: "100%", fontSize: 13, borderRadius: 6,
  border: "1px solid var(--border-strong)", padding: "8px 10px",
  background: "var(--surface)", color: "var(--text)", outline: "none", fontFamily: "inherit",
};
const labelSt = { fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, display: "block" };

// Builder de template — decisão D do mockup aprovado 11/08/2026: inline (modal
// compartilhado ui/Modal.jsx), não uma tela própria em Configurações. Mesmas
// 3 variáveis usadas no compose (EmailPanel, LeadDetailDrawer.jsx):
// {{empresa}}/{{contato}} vêm de lead.company (não existe campo de nome de
// contato pessoa física separado hoje — os dois mapeiam pro mesmo valor),
// {{vendedor}} vem de currentUser.name.
export function EmailTemplateBuilderModal({ open, onClose, onSave, template }) {
  const [name, setName] = useState(template?.name || "");
  const [scope, setScope] = useState(template?.scope || "shared");
  const [subject, setSubject] = useState(template?.subject || "");
  const [bodyHtml, setBodyHtml] = useState(template?.bodyHtml || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    if (!name.trim() || !subject.trim() || !bodyHtml.trim()) {
      setError("Preencha nome, assunto e corpo.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), subject: subject.trim(), bodyHtml, scope });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao salvar template.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={template ? "Editar template de email" : "Novo template de email"} width={520}>
      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, maxHeight: "70vh", overflowY: "auto" }}>
        {error && (
          <div style={{ padding: "8px 12px", borderRadius: 8, fontSize: 12, background: "var(--danger-bg)", color: "var(--danger)" }}>
            {error}
          </div>
        )}
        <div>
          <label style={labelSt}>Nome do template</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Follow-up 15 dias" style={inputBase} />
        </div>
        <div>
          <label style={labelSt}>Visibilidade</label>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" onClick={() => setScope("shared")}
              style={{ flex: 1, textAlign: "center", fontSize: 11.5, fontWeight: 700, padding: "7px 0", borderRadius: 7, cursor: "pointer",
                border: `1px solid ${scope === "shared" ? "var(--accent)" : "var(--border-strong)"}`,
                background: scope === "shared" ? "var(--accent)" : "var(--surface)",
                color: scope === "shared" ? "var(--on-accent)" : "var(--text-dim)" }}>
              Compartilhado com o time
            </button>
            <button type="button" onClick={() => setScope("private")}
              style={{ flex: 1, textAlign: "center", fontSize: 11.5, fontWeight: 700, padding: "7px 0", borderRadius: 7, cursor: "pointer",
                border: `1px solid ${scope === "private" ? "var(--accent)" : "var(--border-strong)"}`,
                background: scope === "private" ? "var(--accent)" : "var(--surface)",
                color: scope === "private" ? "var(--on-accent)" : "var(--text-dim)" }}>
              Só eu
            </button>
          </div>
        </div>
        <div>
          <label style={labelSt}>Assunto</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Novidades pra {{empresa}}" style={inputBase} />
        </div>
        <div>
          <label style={labelSt}>Corpo</label>
          <textarea value={bodyHtml} onChange={e => setBodyHtml(e.target.value)} rows={7}
            placeholder={"Olá {{contato}}, tudo bem?\n\n...\n\nAbraço,\n{{vendedor}}"}
            style={{ ...inputBase, resize: "vertical" }} />
          <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6, lineHeight: 1.5 }}>
            Variáveis disponíveis:{" "}
            {["{{contato}}", "{{empresa}}", "{{vendedor}}"].map(v => (
              <span key={v} style={{ background: "var(--accent-tint, var(--surface-alt))", color: "var(--accent)", fontWeight: 700, padding: "1px 6px", borderRadius: 4, marginRight: 4, display: "inline-block" }}>{v}</span>
            ))}
            — substituídas automaticamente ao enviar.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
          <button onClick={onClose} disabled={saving} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: "8px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, border: "none", background: "var(--accent)", color: "var(--on-accent)", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Salvando…" : "Salvar template"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default EmailTemplateBuilderModal;
