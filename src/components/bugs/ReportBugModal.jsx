import React, { useState } from "react";
import { Modal } from "../ui/Modal";
import { BUG_PRIORITIES } from "../../constants/bug-reports";

const MODULOS = [
  "Funil de Vendas", "Explorador", "Sinais", "Pedidos", "Catálogo", "Pós-venda",
  "Viagens & Despesas", "Comex", "Marketing", "Compras", "RH", "Lista Pessoal", "Chat", "Outro",
];

// Formulário de report de bug — qualquer pessoa da plataforma pode abrir
// (mockup aprovado 17/08/2026). Linguagem não-técnica de propósito: quem
// reporta não precisa saber em qual tela/componente técnico o problema mora.
export function ReportBugModal({ open, onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [module, setModule] = useState(MODULOS[0]);
  const [priority, setPriority] = useState("media");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit = title.trim() && description.trim() && !submitting;

  const handleClose = () => {
    setTitle(""); setDescription(""); setModule(MODULOS[0]); setPriority("media"); setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ title: title.trim(), description: description.trim(), module, priority });
      handleClose();
    } catch (e) {
      setError(e?.message || "Não foi possível enviar — tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Reportar um bug" width={520}>
      <div className="p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>O que aconteceu?</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Comentário no card não salva"
            className="rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: "var(--border-strong)", background: "var(--surface)", color: "var(--text)" }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>O que você esperava, e o que aconteceu no lugar?</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Descreva os passos, o que devia acontecer e o que de fato aconteceu"
            className="rounded-lg border px-3 py-2 text-sm outline-none resize-none"
            style={{ borderColor: "var(--border-strong)", background: "var(--surface)", color: "var(--text)" }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>Onde</label>
            <select
              value={module}
              onChange={(e) => setModule(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--border-strong)", background: "var(--surface)", color: "var(--text)" }}
            >
              {MODULOS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>Prioridade</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--border-strong)", background: "var(--surface)", color: "var(--text)" }}
            >
              {BUG_PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
        </div>
        {error && (
          <div className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "transparent", color: "var(--text-dim)", border: "1px solid var(--border)", cursor: "pointer" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", cursor: canSubmit ? "pointer" : "default", opacity: canSubmit ? 1 : 0.5 }}
          >
            {submitting ? "Enviando…" : "Reportar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default ReportBugModal;
