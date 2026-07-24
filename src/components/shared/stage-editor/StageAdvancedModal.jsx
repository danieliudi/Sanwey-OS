import React, { useEffect, useState } from "react";
import { X, Trash2 } from "lucide-react";
import { StageColorPicker } from "./StageColorPicker";

// "Opções avançadas para {Fase}" — modal por etapa no layout do Pipefy:
// nome com swatch de cor, checkbox de fase final, probabilidade e alerta de
// atraso (SLA). Só expõe o que já tem coluna em rh_pipeline_stages; os
// recursos do Pipefy sem coluna (descrição, permitir criar cards, coletar
// e-mail, responsável automático) ficam pra uma rodada com schema aprovado.
//
// onSave(patch) decide a persistência: draft local (StageListManager) ou
// gravação direta (painel de campos). patch = { name, color, probability?,
// slaDays, terminal }.

const SECTION_TITLE = { fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 2 };
const SECTION_HELP  = { fontSize: 12, color: "var(--text-dim)", marginBottom: 10 };
const INPUT_BASE = {
  width: "100%", fontSize: 13, borderRadius: 8, border: "1px solid var(--border-strong)",
  padding: "9px 12px", color: "var(--text)", background: "var(--surface-alt)",
  outline: "none", boxSizing: "border-box",
};

function focusStyle(e) { e.target.style.borderColor = "var(--accent)"; e.target.style.boxShadow = "0 0 0 2px color-mix(in srgb, var(--accent) 12%, transparent)"; }
function blurStyle(e)  { e.target.style.borderColor = "var(--border-strong)"; e.target.style.boxShadow = "none"; }

export function StageAdvancedModal({
  open,
  onClose,
  stage,
  onSave,
  onDelete,
  showProbability = true,
  accent = "var(--accent)",
  isProtectedStage = false,
  protectedLabel = "",
}) {
  const [name, setName]               = useState("");
  const [color, setColor]             = useState("#64748B");
  const [probability, setProbability] = useState(null);
  const [slaDays, setSlaDays]         = useState(null);
  const [terminal, setTerminal]       = useState(false);
  const [saving, setSaving]           = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [error, setError]             = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open && stage) {
      setName(stage.name || "");
      setColor(stage.color || "#64748B");
      setProbability(stage.probability ?? null);
      setSlaDays(stage.slaDays ?? null);
      setTerminal(!!stage.terminal);
      setError(null);
    }
  }, [open, stage?.stageKey, stage?.id]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", h, true);
    return () => document.removeEventListener("keydown", h, true);
  }, [open, onClose]);

  if (!open || !stage) return null;

  // won/lost são estruturais (resultado do funil) — o flag de fase final só
  // é editável em etapas que não são Ganho/Perdido.
  const terminalLocked = !!(stage.won || stage.lost);

  const handleSave = async () => {
    if (!name.trim()) { setError("Informe um nome para a fase."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        color,
        ...(showProbability ? { probability } : {}),
        slaDays: terminal ? null : slaDays,
        terminal: terminalLocked ? true : terminal,
      });
      onClose();
    } catch (e) {
      setError(e?.message || "Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Excluir a etapa "${stage.name}"? Essa ação não pode ser desfeita.`)) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete();
      onClose();
    } catch (e) {
      setError(e?.message || "Erro ao excluir. Tente novamente.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "var(--overlay-scrim)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl shadow-2xl w-full max-w-md flex flex-col"
        style={{ background: "var(--surface)", maxHeight: "88vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-3 flex items-start justify-between gap-3">
          <h2 className="font-bold" style={{ fontSize: 17, color: "var(--text)" }}>
            Opções avançadas para {stage.name}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg cursor-pointer shrink-0"
            style={{ color: "var(--text-dim)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 pb-2 space-y-5">
          {/* Nome da fase */}
          <div>
            <div style={SECTION_TITLE}>Nome da fase</div>
            <div style={SECTION_HELP}>
              Dê um nome para esta fase conforme as atividades que devem ser realizadas nela.
            </div>
            <div className="flex items-center gap-2.5">
              <StageColorPicker value={color} onChange={setColor} size={38} />
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                style={INPUT_BASE}
                onFocus={focusStyle} onBlur={blurStyle}
              />
            </div>
          </div>

          {/* Fase final */}
          <div>
            <label
              className="flex items-center gap-2.5"
              style={{
                fontSize: 13, color: "var(--text)", userSelect: "none",
                cursor: terminalLocked ? "not-allowed" : "pointer",
                opacity: terminalLocked ? 0.6 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={terminalLocked ? true : terminal}
                disabled={terminalLocked}
                onChange={e => setTerminal(e.target.checked)}
                style={{ accentColor: accent, width: 15, height: 15 }}
              />
              Definir como fase final de processo
            </label>
            {terminalLocked ? (
              <div className="flex items-center gap-1.5 mt-1.5" style={{ marginLeft: 26 }}>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: stage.won ? "#E8F2EC" : "#FEF2F2",
                    color: stage.won ? "#1A6E35" : "#B91C1C",
                  }}
                >
                  {stage.won ? "Ganho" : "Perdido"}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                  Resultado do funil — sempre é fase final.
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4, marginLeft: 26 }}>
                Cards nesta fase contam como encerrados (sem alerta de atraso).
              </div>
            )}
          </div>

          {/* Probabilidade */}
          {showProbability && !terminal && (
            <div>
              <div style={SECTION_TITLE}>Probabilidade</div>
              <div style={SECTION_HELP}>
                Chance estimada de ganho enquanto o card está nesta fase.
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={probability ?? ""}
                  onChange={e => setProbability(e.target.value === "" ? null : Math.max(0, Math.min(100, Number(e.target.value))))}
                  style={{ ...INPUT_BASE, width: 110, textAlign: "right" }}
                  onFocus={focusStyle} onBlur={blurStyle}
                />
                <span style={{ fontSize: 13, color: "var(--text-dim)" }}>%</span>
              </div>
            </div>
          )}

          {/* Alerta de atraso (SLA) */}
          {!terminal && (
            <div>
              <div style={SECTION_TITLE}>Alerta de atraso</div>
              <div style={SECTION_HELP}>
                Define um tempo máximo (SLA) para o card permanecer nesta fase.
              </div>
              <div className="flex items-end gap-3">
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>Tempo</div>
                  <input
                    type="number"
                    min={0}
                    value={slaDays ?? ""}
                    onChange={e => setSlaDays(e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
                    style={{ ...INPUT_BASE, width: 110, textAlign: "right" }}
                    onFocus={focusStyle} onBlur={blurStyle}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>Unidade</div>
                  <div
                    style={{ ...INPUT_BASE, width: 110, background: "var(--surface)", color: "var(--text-dim)", cursor: "default" }}
                  >
                    dias
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div style={{ fontSize: 12, color: "#B91C1C", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 12px" }}>
              {error}
            </div>
          )}

          {onDelete && (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <div style={SECTION_TITLE}>Excluir etapa</div>
              {isProtectedStage ? (
                <>
                  <div style={SECTION_HELP}>
                    Esta é uma etapa estrutural{protectedLabel ? ` de ${protectedLabel}` : ""} e não pode ser removida.
                  </div>
                  <span
                    title={`Etapa estrutural${protectedLabel ? ` de ${protectedLabel}` : ""} — não pode ser removida`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border"
                    style={{ borderColor: "var(--border)", color: "var(--border-strong)", background: "var(--surface-alt)", cursor: "not-allowed" }}
                  >
                    <Trash2 size={12} />
                    Excluir esta etapa
                  </span>
                </>
              ) : (
                <>
                  <div style={SECTION_HELP}>
                    Remove esta fase do Kanban. Só é possível excluir etapas sem registros ativos.
                  </div>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting || saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer"
                    style={{ borderColor: "#FECACA", color: "#B91C1C", background: "#FEF2F2" }}
                  >
                    <Trash2 size={12} />
                    {deleting ? "Excluindo…" : "Excluir esta etapa"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold rounded-lg border cursor-pointer"
            style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold rounded-lg cursor-pointer"
            style={{ background: saving ? "#9CA3AF" : accent, color: "#FFFFFF" }}
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default StageAdvancedModal;
