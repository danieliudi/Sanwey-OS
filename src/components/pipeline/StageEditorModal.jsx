import React, { useEffect, useMemo, useState } from "react";
import { X, GripVertical, RotateCcw, Save, Plus, Trash2 } from "lucide-react";
import { COMPANIES } from "../../constants/companies";

// Editor de etapas por empresa. Permite renomear, mudar código (letra
// que o presidente quer no sistema), cor, probabilidade, SLA em dias,
// reordenar via drag, adicionar e remover etapas.
//
// Trabalha sobre draft local; só persiste no Save via replacePipeline.

const PALETTE = [
  "#B45309", "#DC2626", "#EAB308", "#16A34A", "#10B981",
  "#3B82F6", "#1E3A8A", "#7C3AED", "#9333EA", "#0EA5E9",
  "#64748B", "#475569",
];

const NEW_STAGE_DEFAULTS = { code: "?", name: "Nova etapa", color: "#64748B", probability: 50, slaDays: 14 };

export function StageEditorModal({
  open,
  onClose,
  companyId,
  stages,
  leads,
  onReplacePipeline,
  onResetPipeline,
}) {
  const [draft, setDraft] = useState(() => stages.map(s => ({ ...s })));
  const [dragIdx, setDragIdx] = useState(null);

  useEffect(() => {
    if (open) setDraft(stages.map(s => ({ ...s })));
  }, [open, stages]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

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
  const accent = company?.primary || "var(--text)";

  const patch = (idx, p) => setDraft(d => d.map((s, i) => i === idx ? { ...s, ...p } : s));

  const handleDragStart = (i) => {
    if (draft[i]?.terminal) return;
    setDragIdx(i);
  };
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (targetIdx) => {
    if (dragIdx == null || dragIdx === targetIdx) return;
    if (draft[targetIdx]?.terminal) { setDragIdx(null); return; }
    setDraft(d => {
      const next = [...d];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
    setDragIdx(null);
  };

  const handleAdd = () => {
    const id = `custom_${Date.now().toString(36)}`;
    const newStage = { id, ...NEW_STAGE_DEFAULTS };
    // Insere antes das terminais pra manter ganho/perdido no fim.
    setDraft(d => {
      const firstTerminal = d.findIndex(s => s.terminal);
      const insertAt = firstTerminal === -1 ? d.length : firstTerminal;
      const next = [...d];
      next.splice(insertAt, 0, newStage);
      return next;
    });
  };

  const handleDelete = (idx) => {
    const stage = draft[idx];
    const count = countsByStage[stage.id] || 0;
    if (count > 0) {
      alert(`Não dá pra remover "${stage.name}": ${count} lead${count !== 1 ? "s" : ""} ainda está${count !== 1 ? "ão" : ""} nessa etapa. Mova ou feche esses leads antes.`);
      return;
    }
    if (!confirm(`Remover a etapa "${stage.name}"?`)) return;
    setDraft(d => d.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    // Validação básica: códigos não vazios, nomes não vazios.
    for (const s of draft) {
      if (!s.name?.trim()) { alert("Toda etapa precisa de um nome."); return; }
      if (!s.code?.trim()) { alert(`Etapa "${s.name}" precisa de um código (letra).`); return; }
    }
    onReplacePipeline(companyId, draft);
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
      style={{ background: "var(--overlay-scrim)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col"
        style={{ background: "#FFFFFF", maxHeight: "90vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "#E5E7EB" }}>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: accent }} />
            <h2 className="font-bold" style={{ fontSize: 16, color: "var(--text)" }}>
              Editar etapas · {company?.short || companyId}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg cursor-pointer"
            style={{ color: "var(--text-dim)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
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
          Alterações afetam o Kanban e relatórios imediatamente. Não dá pra remover etapas com leads ativos.
        </div>

        {/* Header row + lista compartilham scroll horizontal em telas estreitas (colunas fixas em px somam 374px+) */}
        <div className="overflow-x-auto flex-1 flex flex-col min-h-0">
          <div
            className="px-4 py-2 border-b grid items-center gap-2 text-[10px] font-bold uppercase"
            style={{
              borderColor: "#E5E7EB",
              color: "var(--text-dim)",
              letterSpacing: "0.06em",
              gridTemplateColumns: "16px 48px 1fr 90px 90px 32px 70px 28px",
              minWidth: 620,
            }}
          >
            <span />
            <span>Código</span>
            <span>Nome</span>
            <span className="text-right">Prob.</span>
            <span className="text-right">SLA (dias)</span>
            <span>Cor</span>
            <span className="text-right">Leads</span>
            <span />
          </div>

          {/* Lista de etapas */}
          <div className="overflow-y-auto flex-1 p-2 space-y-1.5" style={{ minWidth: 620 }}>
            {draft.map((stage, idx) => {
              const count = countsByStage[stage.id] || 0;
              const isTerminal = !!stage.terminal;
              return (
                <div
                  key={stage.id}
                  draggable={!isTerminal}
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(idx)}
                  className="rounded-lg border p-2 grid items-center gap-2"
                  style={{
                    borderColor: dragIdx === idx ? accent : "#E5E7EB",
                    background: isTerminal ? "var(--surface)" : "#FFFFFF",
                    opacity: dragIdx != null && dragIdx !== idx ? 0.7 : 1,
                    gridTemplateColumns: "16px 48px 1fr 90px 90px 32px 70px 28px",
                    minWidth: 620,
                  }}
                >
                  {/* Grip */}
                  <span
                    className="shrink-0"
                    style={{ color: isTerminal ? "#D1D5DB" : "var(--text-dim)", cursor: isTerminal ? "not-allowed" : "grab" }}
                    title={isTerminal ? "Terminal não reordena" : "Arraste pra reordenar"}
                  >
                    <GripVertical size={16} />
                  </span>

                  {/* Código */}
                  <input
                    value={stage.code || ""}
                    onChange={e => patch(idx, { code: e.target.value.toUpperCase().slice(0, 2) })}
                    className="w-full text-center font-bold rounded border px-1 py-1 text-sm"
                    style={{ borderColor: "#E5E7EB", color: stage.color, background: "#FFFFFF" }}
                    maxLength={2}
                  />

                  {/* Nome */}
                  <input
                    value={stage.name}
                    onChange={e => patch(idx, { name: e.target.value })}
                    className="w-full rounded border px-2 py-1 text-sm"
                    style={{ borderColor: "#E5E7EB", color: "var(--text)", background: "#FFFFFF" }}
                  />

                  {/* Probabilidade */}
                  <div className="flex items-center justify-end gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={stage.probability ?? ""}
                      onChange={e => patch(idx, { probability: e.target.value === "" ? null : Number(e.target.value) })}
                      className="w-14 rounded border px-1 py-1 text-xs text-right"
                      style={{ borderColor: "#E5E7EB", color: "var(--text)", background: "#FFFFFF" }}
                    />
                    <span className="text-xs" style={{ color: "var(--text-dim)" }}>%</span>
                  </div>

                  {/* SLA */}
                  <div className="flex items-center justify-end gap-1">
                    {isTerminal ? (
                      <span className="text-xs italic" style={{ color: "var(--text-dim)" }}>—</span>
                    ) : (
                      <>
                        <input
                          type="number"
                          min={0}
                          value={stage.slaDays ?? ""}
                          onChange={e => patch(idx, { slaDays: e.target.value === "" ? null : Number(e.target.value) })}
                          className="w-14 rounded border px-1 py-1 text-xs text-right"
                          style={{ borderColor: "#E5E7EB", color: "var(--text)", background: "#FFFFFF" }}
                          title="Dias máximos esperados na etapa antes de virar 'parado'"
                        />
                        <span className="text-xs" style={{ color: "var(--text-dim)" }}>d</span>
                      </>
                    )}
                  </div>

                  {/* Cor */}
                  <ColorPicker value={stage.color} onChange={c => patch(idx, { color: c })} />

                  {/* Contagem + badge terminal */}
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
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
                      <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>
                        {count}
                      </span>
                    )}
                  </div>

                  {/* Delete */}
                  {isTerminal ? (
                    <span />
                  ) : (
                    <button
                      onClick={() => handleDelete(idx)}
                      className="p-1 rounded cursor-pointer"
                      style={{ color: count > 0 ? "#D1D5DB" : "var(--text-dim)" }}
                      title={count > 0 ? `Não dá pra remover: ${count} lead${count !== 1 ? "s" : ""} aqui` : "Remover etapa"}
                      onMouseEnter={e => { if (count === 0) { e.currentTarget.style.color = "#B91C1C"; e.currentTarget.style.background = "#FEF2F2"; } }}
                      onMouseLeave={e => { e.currentTarget.style.color = count > 0 ? "#D1D5DB" : "var(--text-dim)"; e.currentTarget.style.background = "transparent"; }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Adicionar etapa */}
            <button
              onClick={handleAdd}
              className="w-full flex items-center justify-center gap-1.5 p-2.5 text-xs font-semibold rounded-lg border-2 border-dashed cursor-pointer"
              style={{ borderColor: "#D1D5DB", color: "var(--text-dim)", background: "var(--surface)" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent; e.currentTarget.style.background = accent + "08"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.background = "var(--surface)"; }}
            >
              <Plus size={13} />
              Adicionar etapa
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t flex items-center justify-between" style={{ borderColor: "#E5E7EB", background: "var(--surface)" }}>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer"
            style={{ borderColor: "#E5E7EB", color: "var(--text-dim)", background: "#FFFFFF" }}
            onMouseEnter={e => { e.currentTarget.style.color = "#B91C1C"; e.currentTarget.style.borderColor = "#FECACA"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.borderColor = "#E5E7EB"; }}
          >
            <RotateCcw size={11} />
            Restaurar padrão
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer"
              style={{ borderColor: "#E5E7EB", color: "var(--text-dim)", background: "#FFFFFF" }}
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
              style={{ background: c, outline: value === c ? "2px solid #1E40AF" : "none", outlineOffset: 1 }}
              type="button"
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default StageEditorModal;
