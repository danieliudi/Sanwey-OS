import React, { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { Modal } from "../ui/Modal";
import { BUG_PRIORITIES } from "../../constants/bug-reports";
import { BUG_REPORT_MODULES, moduloDaRota, montarContexto, tituloAutomatico } from "../../utils/bug-context";

// Formulário de report de bug — mockup aprovado 03/09/2026 (baixa fricção).
//
// Fluxo principal:
//   1. Pessoa digita qualquer frase → "Enviar" libera.
//   2. "Impacto · Onde" ficam colapsados atrás de "+ detalhes" — quem quer
//      especificar expande, quem só quer reportar nunca vê.
//
// Exceção: `erro` preenchido = veio da tela de erro. Aí o campo de relato
// fica opcional e o Enviar libera imediatamente (o erro técnico já é o relato).
export function ReportBugModal({ open, onClose, onSubmit, rota, empresa, erro = null, origem = "central" }) {
  const [relato, setRelato] = useState("");
  const [module, setModule] = useState(() => moduloDaRota(rota));
  const [priority, setPriority] = useState("media");
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setModule(moduloDaRota(rota));
      setDetalhesAbertos(false);
    }
  }, [open, rota]);

  const canSubmit = (erro ? true : relato.trim().length > 0) && !submitting;

  const handleClose = () => {
    setRelato(""); setPriority("media"); setError(null); setDetalhesAbertos(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        title: tituloAutomatico({ relato, erro, rota }),
        description: relato.trim() || (erro?.message || String(erro) || "Reportado sem descrição."),
        module,
        priority,
        origem,
        contexto: montarContexto({ rota, empresa, erro }),
      });
      handleClose();
    } catch (e) {
      setError(e?.message || "Não foi possível enviar — tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={erro ? "Reportar este erro" : "Reportar um problema"} width={480}>
      <div className="px-5 pb-5 pt-3 flex flex-col gap-3">

        {/* Banner de contexto automático */}
        <div
          className="text-xs rounded-lg px-3 py-2 flex items-start gap-2"
          style={{ background: "var(--surface-alt)", color: "var(--text-dim)" }}
        >
          <span style={{ color: "var(--accent)", fontWeight: 700, lineHeight: 1.5 }}>✓</span>
          <span>
            Já anexamos <b style={{ color: "var(--text)" }}>as dimensões da tela, o navegador e o erro técnico</b> — você não precisa tirar print.
          </span>
        </div>

        {/* Campo principal */}
        <textarea
          autoFocus
          value={relato}
          onChange={(e) => setRelato(e.target.value)}
          rows={2}
          placeholder={erro
            ? "Se quiser, conte o que você estava fazendo quando isso apareceu."
            : "O que aconteceu? Uma frase já ajuda."}
          className="rounded-lg border px-3 py-2.5 text-sm outline-none resize-none w-full"
          style={{ borderColor: "var(--border-strong)", background: "var(--surface)", color: "var(--text)" }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && canSubmit) handleSubmit();
          }}
        />

        {/* Detalhes colapsáveis: Impacto + Onde */}
        <div>
          <button
            type="button"
            onClick={() => setDetalhesAbertos(v => !v)}
            className="flex items-center gap-1 text-xs font-medium"
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--text-dim)" }}
          >
            <ChevronRight
              size={13}
              style={{
                transition: "transform 0.15s",
                transform: detalhesAbertos ? "rotate(90deg)" : "rotate(0deg)",
              }}
            />
            {detalhesAbertos ? "Ocultar detalhes" : "+ detalhes — Impacto · Onde"}
          </button>

          {detalhesAbertos && (
            <div className="flex flex-col gap-3 mt-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>O quanto atrapalha</label>
                <div className="flex gap-2 flex-wrap">
                  {BUG_PRIORITIES.map(p => {
                    const on = priority === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPriority(p.id)}
                        aria-pressed={on}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{
                          background: on ? "var(--warning-bg)" : "transparent",
                          color: on ? "var(--warning)" : "var(--text-dim)",
                          border: `1px solid ${on ? "var(--warning)" : "var(--border)"}`,
                          cursor: "pointer",
                        }}
                      >
                        {p.pill}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>Onde</label>
                <select
                  value={module}
                  onChange={(e) => setModule(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "var(--border-strong)", background: "var(--surface)", color: "var(--text)" }}
                >
                  {BUG_REPORT_MODULES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
            {error}
          </div>
        )}

        {/* Rodapé */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            onClick={handleClose}
            className="text-xs font-medium"
            style={{ background: "none", border: "none", padding: "4px 0", cursor: "pointer", color: "var(--text-dim)" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 py-2 rounded-lg text-sm font-semibold"
            style={{
              background: canSubmit ? "var(--accent)" : "var(--surface-alt)",
              color: canSubmit ? "var(--on-accent)" : "var(--text-faint)",
              border: "none",
              cursor: canSubmit ? "pointer" : "default",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {submitting ? "Enviando…" : "Enviar"}
          </button>
        </div>

      </div>
    </Modal>
  );
}

export default ReportBugModal;
