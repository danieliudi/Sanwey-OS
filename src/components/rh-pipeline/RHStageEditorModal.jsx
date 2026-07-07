import React, { useEffect, useMemo, useState } from "react";
import { X, GripVertical, Save, Plus, Trash2 } from "lucide-react";
import { NEUTRAL } from "../../constants/companies";
import { useRHPipelineStages } from "../../hooks/use-rh-pipeline-stages";

// Editor de etapas do pipeline de RH (Vagas / Candidatos / Onboarding).
// Baseado em src/components/pipeline/StageEditorModal.jsx, mas sem o campo
// "código" (não existe nesse domínio) e persistindo direto no Supabase via
// useRHPipelineStages(domain) — dados compartilhados entre usuários do RH,
// não localStorage por navegador.
//
// Trabalha sobre draft local; só persiste no Save (add/update/delete/reorder).

const PALETTE = [
  "#B45309", "#DC2626", "#EAB308", "#16A34A", "#10B981",
  "#3B82F6", "#1E3A8A", "#7C3AED", "#9333EA", "#0EA5E9",
  "#64748B", "#475569",
];

const NEW_STAGE_DEFAULTS = { name: "Nova etapa", color: "#64748B", probability: 50, slaDays: 14 };

function slugifyStageKey(label) {
  return (label || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50) || `etapa_${Date.now().toString(36)}`;
}

export function RHStageEditorModal({
  open,
  onClose,
  domain,
  domainLabel,
  records,
  stageField,
}) {
  const { stages, addStage, updateStage, deleteStage, reorderStages } = useRHPipelineStages(domain);

  const [draft, setDraft] = useState(() => stages.map(s => ({ ...s, isNew: false })));
  const [dragIdx, setDragIdx] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(stages.map(s => ({ ...s, isNew: false })));
  }, [open, stages]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  const countsByStage = useMemo(() => {
    const m = {};
    for (const r of records || []) {
      const key = r?.[stageField];
      if (!key) continue;
      m[key] = (m[key] || 0) + 1;
    }
    return m;
  }, [records, stageField]);

  if (!open) return null;

  const accent = "var(--accent)";

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
    const tempId = `new_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const newStage = { tempId, isNew: true, ...NEW_STAGE_DEFAULTS };
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
    const count = countsByStage[stage.stageKey] || 0;
    if (count > 0) {
      alert(`Não dá pra remover "${stage.name}": ${count} registro${count !== 1 ? "s" : ""} ainda está${count !== 1 ? "ão" : ""} nessa etapa. Mova esses registros antes.`);
      return;
    }
    if (!confirm(`Remover a etapa "${stage.name}"?`)) return;
    setDraft(d => d.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    // Validação básica: nomes não vazios.
    for (const s of draft) {
      if (!s.name?.trim()) { alert("Toda etapa precisa de um nome."); return; }
    }

    setSaving(true);
    try {
      const originalById = new Map(stages.map(s => [s.id, s]));
      const usedKeys = new Set(draft.filter(s => !s.isNew).map(s => s.stageKey));
      // idByRef: tempId (novas) ou stageKey (existentes) -> id real no banco.
      const idByRef = new Map();

      for (let i = 0; i < draft.length; i++) {
        const s = draft[i];
        if (s.isNew) {
          let key = slugifyStageKey(s.name);
          let suffix = 1;
          while (usedKeys.has(key)) key = `${slugifyStageKey(s.name)}_${suffix++}`;
          usedKeys.add(key);
          const created = await addStage({
            stageKey: key,
            name: s.name,
            color: s.color,
            orderIdx: i,
            probability: s.probability,
            slaDays: s.slaDays,
            terminal: false,
            won: false,
            lost: false,
          });
          if (created?.id) idByRef.set(s.tempId, created.id);
        } else {
          const orig = originalById.get(s.id);
          const changed = orig && (
            orig.name !== s.name ||
            orig.color !== s.color ||
            orig.probability !== s.probability ||
            orig.slaDays !== s.slaDays
          );
          if (changed) {
            await updateStage(s.id, {
              name: s.name,
              color: s.color,
              probability: s.probability,
              slaDays: s.slaDays,
            });
          }
          idByRef.set(s.stageKey, s.id);
        }
      }

      // Remove no banco as etapas que saíram do draft.
      const remainingIds = new Set(draft.filter(s => !s.isNew).map(s => s.id));
      for (const orig of stages) {
        if (!remainingIds.has(orig.id)) {
          await deleteStage(orig.id);
        }
      }

      // Reordena com base na ordem final do draft (best-effort).
      const orderedIds = draft
        .map(s => s.isNew ? idByRef.get(s.tempId) : idByRef.get(s.stageKey))
        .filter(Boolean);
      if (orderedIds.length) await reorderStages(orderedIds);

      onClose();
    } catch (e) {
      alert(`Erro ao salvar etapas: ${e?.message || "tente novamente."}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
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
            <h2 className="font-bold" style={{ fontSize: 16, color: NEUTRAL.graphite }}>
              Editar etapas · {domainLabel}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg cursor-pointer"
            style={{ color: NEUTRAL.slate }}
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
          Alterações afetam o Kanban imediatamente para todos os usuários do RH. Não dá pra remover etapas com registros ativos.
        </div>

        {/* Header row */}
        <div
          className="px-4 py-2 border-b grid items-center gap-2 text-[10px] font-bold uppercase"
          style={{
            borderColor: "#E5E7EB",
            color: NEUTRAL.slate,
            letterSpacing: "0.06em",
            gridTemplateColumns: "16px 1fr 90px 90px 32px 70px 28px",
          }}
        >
          <span />
          <span>Nome</span>
          <span className="text-right">Prob.</span>
          <span className="text-right">SLA (dias)</span>
          <span>Cor</span>
          <span className="text-right">Reg.</span>
          <span />
        </div>

        {/* Lista de etapas */}
        <div className="overflow-y-auto flex-1 p-2 space-y-1.5">
          {draft.map((stage, idx) => {
            const count = countsByStage[stage.stageKey] || 0;
            const isTerminal = !!stage.terminal;
            return (
              <div
                key={stage.isNew ? stage.tempId : stage.stageKey}
                draggable={!isTerminal}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(idx)}
                className="rounded-lg border p-2 grid items-center gap-2"
                style={{
                  borderColor: dragIdx === idx ? accent : "#E5E7EB",
                  background: isTerminal ? "var(--surface)" : "#FFFFFF",
                  opacity: dragIdx != null && dragIdx !== idx ? 0.7 : 1,
                  gridTemplateColumns: "16px 1fr 90px 90px 32px 70px 28px",
                }}
              >
                {/* Grip */}
                <span
                  className="shrink-0"
                  style={{ color: isTerminal ? "#D1D5DB" : NEUTRAL.slate, cursor: isTerminal ? "not-allowed" : "grab" }}
                  title={isTerminal ? "Terminal não reordena" : "Arraste pra reordenar"}
                >
                  <GripVertical size={16} />
                </span>

                {/* Nome */}
                <input
                  value={stage.name}
                  onChange={e => patch(idx, { name: e.target.value })}
                  className="w-full rounded border px-2 py-1 text-sm"
                  style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite, background: "#FFFFFF" }}
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
                    style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite, background: "#FFFFFF" }}
                  />
                  <span className="text-xs" style={{ color: NEUTRAL.slate }}>%</span>
                </div>

                {/* SLA */}
                <div className="flex items-center justify-end gap-1">
                  {isTerminal ? (
                    <span className="text-xs italic" style={{ color: NEUTRAL.slate }}>—</span>
                  ) : (
                    <>
                      <input
                        type="number"
                        min={0}
                        value={stage.slaDays ?? ""}
                        onChange={e => patch(idx, { slaDays: e.target.value === "" ? null : Number(e.target.value) })}
                        className="w-14 rounded border px-1 py-1 text-xs text-right"
                        style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite, background: "#FFFFFF" }}
                        title="Dias máximos esperados na etapa antes de virar 'parado'"
                      />
                      <span className="text-xs" style={{ color: NEUTRAL.slate }}>d</span>
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
                    <span className="text-[10px]" style={{ color: NEUTRAL.slate }}>
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
                    style={{ color: count > 0 ? "#D1D5DB" : NEUTRAL.slate }}
                    title={count > 0 ? `Não dá pra remover: ${count} registro${count !== 1 ? "s" : ""} aqui` : "Remover etapa"}
                    onMouseEnter={e => { if (count === 0) { e.currentTarget.style.color = "#B91C1C"; e.currentTarget.style.background = "#FEF2F2"; } }}
                    onMouseLeave={e => { e.currentTarget.style.color = count > 0 ? "#D1D5DB" : NEUTRAL.slate; e.currentTarget.style.background = "transparent"; }}
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
            style={{ borderColor: "#D1D5DB", color: NEUTRAL.slate, background: "var(--surface)" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent; e.currentTarget.style.background = "var(--accent-tint)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.color = NEUTRAL.slate; e.currentTarget.style.background = "var(--surface)"; }}
          >
            <Plus size={13} />
            Adicionar etapa
          </button>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t flex items-center justify-end" style={{ borderColor: "#E5E7EB", background: "var(--surface)" }}>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer"
              style={{ borderColor: "#E5E7EB", color: NEUTRAL.slate, background: "#FFFFFF" }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer"
              style={{ background: saving ? "#9CA3AF" : accent, color: "#FFFFFF" }}
            >
              <Save size={12} />
              {saving ? "Salvando…" : "Salvar alterações"}
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

export default RHStageEditorModal;
