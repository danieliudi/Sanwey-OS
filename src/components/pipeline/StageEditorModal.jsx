import React, { useEffect, useMemo, useState } from "react";
import { X, GripVertical, RotateCcw, Save } from "lucide-react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";

// Editor de etapas por empresa. Permite renomear, mudar código (letra
// que o presidente quer no sistema), cor, probabilidade e reordenar via
// drag. NÃO permite adicionar nem deletar etapas em v1 — IDs precisam
// ser estáveis pra leads existentes continuarem funcionando, e
// criar/remover requer migração que ainda não foi desenhada.

const PALETTE = [
  "#B45309", "#DC2626", "#EAB308", "#16A34A", "#10B981",
  "#3B82F6", "#1E3A8A", "#7C3AED", "#9333EA", "#0EA5E9",
  "#64748B", "#475569",
];

export function StageEditorModal({
  open,
  onClose,
  companyId,
  stages,
  leads,
  onUpdateStage,
  onReorderStages,
  onResetPipeline,
}) {
  // Editamos sobre um draft local; só persiste no Save. Evita re-render
  // do kanban a cada keystroke e dá um cancel funcional.
  const [draft, setDraft] = useState(() => stages.map(s => ({ ...s })));
  const [dragIdx, setDragIdx] = useState(null);

  useEffect(() => {
    if (open) setDraft(stages.map(s => ({ ...s })));
  }, [open, stages]);

  // Conta leads por etapa pra avisar antes de mudanças que afetam o
  // operacional (renomear "Negociação" durante uma reunião confunde).
  const countsByStage = useMemo(() => {
    const m = {};
    for (const l of leads || []) {
      if (l.companyId !== companyId) continue;
      m[l.stage] = (m[l.stage] || 0) + 1;
    }
    return m;
  }, [leads, companyId]);

  if (!open) return null;

  const company = COMPANIES[companyId];
  const accent = company?.primary || NEUTRAL.graphite;

  const patch = (idx, p) => setDraft(d => d.map((s, i) => i === idx ? { ...s, ...p } : s));

  const handleDragStart = (i) => setDragIdx(i);
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (targetIdx) => {
    if (dragIdx == null || dragIdx === targetIdx) return;
    setDraft(d => {
      const next = [...d];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
    setDragIdx(null);
  };

  const handleSave = () => {
    // 1. Aplica patches em campos
    for (const s of draft) onUpdateStage(companyId, s.id, s);
    // 2. Aplica nova ordem
    onReorderStages(companyId, draft.map(s => s.id));
    onClose();
  };

  const handleReset = () => {
    if (!confirm("Restaurar o pipeline padrão pra esta empresa? Suas customizações de etapa serão perdidas (transições não são afetadas).")) return;
    onResetPipeline(companyId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col"
        style={{ background: "#FFFFFF", maxHeight: "90vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "#E5E7EB" }}>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: accent }} />
            <h2 className="font-bold" style={{ fontSize: 16, color: NEUTRAL.graphite }}>
              Editar etapas · {company?.short || companyId}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg cursor-pointer"
            style={{ color: NEUTRAL.slate }}
            onMouseEnter={e => { e.currentTarget.style.background = "#F3F4F6"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Aviso */}
        <div
          className="px-5 py-2.5 text-xs border-b"
          style={{ background: "#FFFBEB", borderColor: "#FDE68A", color: "#92400E" }}
        >
          Renomear ou recolorir uma etapa afeta imediatamente o Kanban e todos os relatórios. Adicionar/remover etapas chega em uma próxima atualização.
        </div>

        {/* Lista de etapas */}
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {draft.map((stage, idx) => {
            const count = countsByStage[stage.id] || 0;
            const isTerminal = !!stage.terminal;
            return (
              <div
                key={stage.id}
                draggable={!isTerminal}
                onDragStart={() => !isTerminal && handleDragStart(idx)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(idx)}
                className="rounded-lg border p-3 flex items-center gap-3"
                style={{
                  borderColor: dragIdx === idx ? accent : "#E5E7EB",
                  background: isTerminal ? "#FAFAFA" : "#FFFFFF",
                  opacity: dragIdx != null && dragIdx !== idx ? 0.7 : 1,
                }}
              >
                <span
                  className="shrink-0"
                  style={{ color: isTerminal ? "#D1D5DB" : NEUTRAL.slate, cursor: isTerminal ? "not-allowed" : "grab" }}
                  title={isTerminal ? "Etapa terminal não pode ser reordenada" : "Arraste pra reordenar"}
                >
                  <GripVertical size={16} />
                </span>

                {/* Código (letra) */}
                <input
                  value={stage.code || ""}
                  onChange={e => patch(idx, { code: e.target.value.toUpperCase().slice(0, 2) })}
                  className="w-12 text-center font-bold rounded border px-1 py-1 text-sm"
                  style={{
                    borderColor: "#E5E7EB",
                    color: stage.color,
                    background: "#FFFFFF",
                  }}
                  maxLength={2}
                  title="Código interno da etapa (1-2 letras)"
                />

                {/* Nome */}
                <input
                  value={stage.name}
                  onChange={e => patch(idx, { name: e.target.value })}
                  className="flex-1 rounded border px-2 py-1 text-sm"
                  style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite, background: "#FFFFFF" }}
                />

                {/* Probabilidade */}
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={stage.probability ?? ""}
                    onChange={e => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      patch(idx, { probability: v });
                    }}
                    className="w-14 rounded border px-1 py-1 text-xs text-right"
                    style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite, background: "#FFFFFF" }}
                    title="Probabilidade de fechamento (%) — alimentará o forecast"
                  />
                  <span className="text-xs" style={{ color: NEUTRAL.slate }}>%</span>
                </div>

                {/* Cor */}
                <ColorPicker value={stage.color} onChange={c => patch(idx, { color: c })} />

                {/* Badges */}
                <div className="flex flex-col items-end gap-0.5 shrink-0" style={{ minWidth: 70 }}>
                  {isTerminal && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: stage.won ? "#E8F2EC" : "#FEF2F2",
                        color: stage.won ? "#1A6E35" : "#B91C1C",
                      }}
                    >
                      {stage.won ? "Ganho" : "Perdido"}
                    </span>
                  )}
                  {count > 0 && (
                    <span className="text-[10px]" style={{ color: NEUTRAL.slate }}>
                      {count} lead{count !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t flex items-center justify-between" style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer"
            style={{ borderColor: "#E5E7EB", color: NEUTRAL.slate, background: "#FFFFFF" }}
            onMouseEnter={e => { e.currentTarget.style.color = "#B91C1C"; e.currentTarget.style.borderColor = "#FECACA"; }}
            onMouseLeave={e => { e.currentTarget.style.color = NEUTRAL.slate; e.currentTarget.style.borderColor = "#E5E7EB"; }}
          >
            <RotateCcw size={11} />
            Restaurar padrão
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer"
              style={{ borderColor: "#E5E7EB", color: NEUTRAL.slate, background: "#FFFFFF" }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer"
              style={{ background: accent, color: "#FFFFFF" }}
            >
              <Save size={12} />
              Salvar alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-7 h-7 rounded-full border-2 cursor-pointer"
        style={{ background: value, borderColor: "#FFFFFF", boxShadow: "0 0 0 1px #E5E7EB" }}
        title="Mudar cor"
        type="button"
      />
      {open && (
        <div
          className="absolute right-0 top-9 z-10 rounded-lg shadow-lg border p-2 grid grid-cols-6 gap-1"
          style={{ background: "#FFFFFF", borderColor: "#E5E7EB", width: 168 }}
          onMouseLeave={() => setOpen(false)}
        >
          {PALETTE.map(c => (
            <button
              key={c}
              onClick={() => { onChange(c); setOpen(false); }}
              className="w-6 h-6 rounded-full cursor-pointer"
              style={{
                background: c,
                outline: value === c ? "2px solid #1E40AF" : "none",
                outlineOffset: 1,
              }}
              type="button"
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default StageEditorModal;
