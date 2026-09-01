import React, { useEffect, useMemo, useState } from "react";
import { X, GripVertical, Save, Plus, Trash2, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useRHPipelineStages } from "../../../hooks/use-rh-pipeline-stages";
import { StageColorPicker } from "./StageColorPicker";
import { StageAdvancedModal } from "./StageAdvancedModal";

// "Gerenciar etapas" — lista com drag-reorder, nome+cor inline, adicionar e
// excluir. A edição fina de UMA etapa (probabilidade, SLA, fase final) fica
// no StageAdvancedModal, aberto pelo botão de opções de cada linha — mesmo
// modal usado pelo painel de campos, layout do Pipefy.
//
// Um core visual, dois modos de persistência: RHStageListManager grava
// direto via useRHPipelineStages; CRMStageListManager trabalha por empresa
// (com coluna de código) e persiste via replacePipeline.

const NEW_STAGE_DEFAULTS = { name: "Nova etapa", color: "#64748B", probability: 50, slaDays: 14, terminal: false };

function slugifyStageKey(label) {
  return (label || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50) || `etapa_${Date.now().toString(36)}`;
}

// ── Core visual (draft + linhas) ─────────────────────────────────────────────

export function StageListCore({
  open,
  onClose,
  title,
  warning,
  stages,
  rowKey,          // (stage) => chave estável da linha
  getCount,        // (stage) => registros na etapa
  makeNewStage,    // () => objeto de etapa nova (isNew: true)
  protectedKeys = [],
  protectedLabel = "",
  showCode = false,
  showProbability = true,
  showDescription = true,
  onSave,          // async (draft) => void — validação/persistência do modo
  onReset = null,
  accent = "var(--accent)",
  countLabel = "Reg.",
}) {
  const [draft, setDraft] = useState(() => stages.map(s => ({ ...s, isNew: false })));
  const [dragIdx, setDragIdx] = useState(null);
  const [saving, setSaving] = useState(false);
  const [advIdx, setAdvIdx] = useState(null);

  // Só semeia o draft quando o modal ABRE — mudanças concorrentes (Realtime)
  // não podem descartar edições locais ainda não salvas.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open) setDraft(stages.map(s => ({ ...s, isNew: false })));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape" && advIdx == null) onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose, advIdx]);

  if (!open) return null;

  const patch = (idx, p) => setDraft(d => d.map((s, i) => i === idx ? { ...s, ...p } : s));

  const handleDragStart = (i) => { if (!draft[i]?.terminal) setDragIdx(i); };
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
    const newStage = { ...makeNewStage(), isNew: true };
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
    if (protectedKeys.includes(stage.stageKey)) {
      alert(`"${stage.name}" é uma etapa estrutural${protectedLabel ? ` de ${protectedLabel}` : ""} e não pode ser removida.`);
      return;
    }
    const count = stage.isNew ? 0 : getCount(stage);
    if (count > 0) {
      alert(`Não dá pra remover "${stage.name}": ${count} registro${count !== 1 ? "s" : ""} ainda está${count !== 1 ? "ão" : ""} nessa etapa. Mova esses registros antes.`);
      return;
    }
    if (!confirm(`Remover a etapa "${stage.name}"?`)) return;
    setDraft(d => d.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    for (const s of draft) {
      if (!s.name?.trim()) { alert("Toda etapa precisa de um nome."); return; }
      if (showCode && !s.code?.trim()) { alert(`Etapa "${s.name}" precisa de um código (letra).`); return; }
    }
    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } catch (e) {
      alert(`Erro ao salvar etapas: ${e?.message || "tente novamente."}`);
    } finally {
      setSaving(false);
    }
  };

  const gridCols = showCode
    ? "16px 48px 1fr 32px 70px 30px 28px"
    : "16px 1fr 32px 70px 30px 28px";

  const advStage = advIdx != null ? draft[advIdx] : null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "var(--overlay-scrim)" }}
      >
        <div
          className="rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col"
          style={{ background: "var(--surface)", maxHeight: "90vh" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: accent }} />
              <h2 className="font-bold" style={{ fontSize: 16, color: "var(--text)" }}>
                Editar etapas · {title}
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
            style={{ background: "var(--warning-bg)", borderColor: "var(--warning)", color: "var(--warning)" }}
          >
            {warning}
          </div>

          {/* Header row */}
          <div
            className="px-4 py-2 border-b grid items-center gap-2 text-[10px] font-bold uppercase"
            style={{
              borderColor: "var(--border)", color: "var(--text-dim)", letterSpacing: "0.06em",
              gridTemplateColumns: gridCols,
            }}
          >
            <span />
            {showCode && <span>Código</span>}
            <span>Nome</span>
            <span>Cor</span>
            <span className="text-right">{countLabel}</span>
            <span />
            <span />
          </div>

          {/* Lista */}
          <div className="overflow-y-auto flex-1 p-2 space-y-1.5">
            {draft.map((stage, idx) => {
              const count = stage.isNew ? 0 : getCount(stage);
              const isTerminal = !!stage.terminal;
              const isProtected = protectedKeys.includes(stage.stageKey);
              return (
                <div
                  key={rowKey(stage)}
                  draggable={!isTerminal}
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(idx)}
                  className="rounded-lg border p-2 grid items-center gap-2"
                  style={{
                    borderColor: dragIdx === idx ? accent : "var(--border)",
                    background: isTerminal ? "var(--surface-alt)" : "var(--surface)",
                    opacity: dragIdx != null && dragIdx !== idx ? 0.7 : 1,
                    gridTemplateColumns: gridCols,
                  }}
                >
                  <span
                    className="shrink-0"
                    style={{ color: isTerminal ? "var(--border-strong)" : "var(--text-dim)", cursor: isTerminal ? "not-allowed" : "grab" }}
                    title={isTerminal ? "Terminal não reordena" : "Arraste pra reordenar"}
                  >
                    <GripVertical size={16} />
                  </span>

                  {showCode && (
                    <input
                      value={stage.code || ""}
                      onChange={e => patch(idx, { code: e.target.value.toUpperCase().slice(0, 2) })}
                      className="w-full text-center font-bold rounded border px-1 py-1 text-sm"
                      style={{ borderColor: "var(--border)", color: stage.color, background: "var(--surface)" }}
                      maxLength={2}
                    />
                  )}

                  <input
                    value={stage.name}
                    onChange={e => patch(idx, { name: e.target.value })}
                    className="w-full rounded border px-2 py-1 text-sm"
                    style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
                  />

                  <StageColorPicker value={stage.color} onChange={c => patch(idx, { color: c })} />

                  {/* Contagem + badge terminal */}
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    {isTerminal && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{
                          // 3 estados: Ganho, Perdido, ou terminal neutro
                          // ("Concluído"/"Entregue") — nunca rotular neutro
                          // como Perdido (bug real já corrigido).
                          background: stage.won ? "var(--success-bg)" : stage.lost ? "var(--danger-bg)" : "color-mix(in srgb, #2563EB 12%, var(--surface))",
                          color: stage.won ? "var(--success)" : stage.lost ? "var(--danger)" : "color-mix(in srgb, #2563EB 60%, var(--text))",
                        }}
                      >
                        {stage.won ? "Ganho" : stage.lost ? "Perdido" : "Concluído"}
                      </span>
                    )}
                    {count > 0 && (
                      <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>
                        {count}
                      </span>
                    )}
                  </div>

                  {/* Opções avançadas */}
                  <button
                    onClick={() => setAdvIdx(idx)}
                    className="p-1 rounded cursor-pointer justify-self-center"
                    style={{ color: "var(--text-dim)" }}
                    title="Opções avançadas (descrição, probabilidade, SLA, fase final)"
                    onMouseEnter={e => { e.currentTarget.style.color = accent; e.currentTarget.style.background = "var(--surface-alt)"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.background = "transparent"; }}
                  >
                    <SlidersHorizontal size={13} />
                  </button>

                  {/* Delete */}
                  {isTerminal || isProtected ? (
                    isProtected ? (
                      <span title={`Etapa estrutural${protectedLabel ? ` de ${protectedLabel}` : ""} — não pode ser removida`} style={{ display: "flex", justifyContent: "center", color: "var(--border-strong)" }}>
                        <Trash2 size={13} />
                      </span>
                    ) : <span />
                  ) : (
                    <button
                      onClick={() => handleDelete(idx)}
                      className="p-1 rounded cursor-pointer"
                      style={{ color: count > 0 ? "var(--border-strong)" : "var(--text-dim)" }}
                      title={count > 0 ? `Não dá pra remover: ${count} registro${count !== 1 ? "s" : ""} aqui` : "Remover etapa"}
                      onMouseEnter={e => { if (count === 0) { e.currentTarget.style.color = "var(--danger)"; e.currentTarget.style.background = "var(--danger-bg)"; } }}
                      onMouseLeave={e => { e.currentTarget.style.color = count > 0 ? "var(--border-strong)" : "var(--text-dim)"; e.currentTarget.style.background = "transparent"; }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })}

            <button
              onClick={handleAdd}
              className="w-full flex items-center justify-center gap-1.5 p-2.5 text-xs font-semibold rounded-lg border-2 border-dashed cursor-pointer"
              style={{ borderColor: "var(--border-strong)", color: "var(--text-dim)", background: "var(--surface)" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent; e.currentTarget.style.background = "var(--accent-tint)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.background = "var(--surface)"; }}
            >
              <Plus size={13} />
              Adicionar etapa
            </button>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t flex items-center justify-between" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            {onReset ? (
              <button
                onClick={onReset}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer"
                style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--danger)"; e.currentTarget.style.borderColor = "color-mix(in srgb, var(--danger) 35%, transparent)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.borderColor = "var(--border)"; }}
              >
                <RotateCcw size={11} />
                Restaurar padrão
              </button>
            ) : <span />}
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer"
                style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}
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

      {/* Opções avançadas editam o draft — persistem junto no Salvar */}
      <StageAdvancedModal
        open={advIdx != null}
        onClose={() => setAdvIdx(null)}
        stage={advStage}
        accent={accent}
        showProbability={showProbability}
        showDescription={showDescription}
        onSave={(p) => { patch(advIdx, p); }}
      />
    </>
  );
}

// ── Modo RH/Marketing (persistência direta via useRHPipelineStages) ──────────

export function RHStageListManager({
  open,
  onClose,
  domain,
  domainLabel,
  records,
  stageField,
  nonDeletableStageKeys = [],
}) {
  const { stages, addStage, updateStage, deleteStage, reorderStages } = useRHPipelineStages(domain);

  const countsByStage = useMemo(() => {
    const m = {};
    for (const r of records || []) {
      const key = r?.[stageField];
      if (!key) continue;
      m[key] = (m[key] || 0) + 1;
    }
    return m;
  }, [records, stageField]);

  const handleSave = async (draft) => {
    const originalById = new Map(stages.map(s => [s.id, s]));
    const idByRef = new Map();

    // Deletes primeiro — revalida contagem no momento da gravação e evita
    // colisão de stage_key ao apagar+recriar com o mesmo nome na sessão.
    const remainingIds = new Set(draft.filter(s => !s.isNew).map(s => s.id));
    const blockedDeletes = [];
    for (const orig of stages) {
      if (remainingIds.has(orig.id)) continue;
      const liveCount = countsByStage[orig.stageKey] || 0;
      if (liveCount > 0) {
        blockedDeletes.push({ name: orig.name, count: liveCount });
        continue;
      }
      await deleteStage(orig.id);
    }
    if (blockedDeletes.length) {
      alert(blockedDeletes.map(b => `Não deu pra remover "${b.name}": ${b.count} registro(s) foram movidos pra lá enquanto o editor estava aberto.`).join("\n"));
    }

    const usedKeys = new Set(draft.filter(s => !s.isNew).map(s => s.stageKey));
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
          description: s.description ?? null,
          terminal: !!s.terminal,
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
          orig.slaDays !== s.slaDays ||
          // `description` PRECISA estar aqui e no payload abaixo. Sem ela, em
          // Recrutamento (o único board que edita etapa por este gerenciador)
          // o usuário digitava a descrição, clicava "Salvar alterações", o
          // modal fechava sem erro e nada era gravado — e se ele tivesse
          // mexido SÓ na descrição, `changed` dava false e não havia nem
          // UPDATE. Achado do QA, 01/09/2026.
          orig.description !== s.description ||
          orig.terminal !== !!s.terminal
        );
        if (changed) {
          await updateStage(s.id, {
            name: s.name,
            color: s.color,
            probability: s.probability,
            slaDays: s.slaDays,
            description: s.description ?? null,
            terminal: !!s.terminal,
          });
        }
        idByRef.set(s.stageKey, s.id);
      }
    }

    const orderedIds = draft
      .map(s => s.isNew ? idByRef.get(s.tempId) : idByRef.get(s.stageKey))
      .filter(Boolean);
    if (orderedIds.length) await reorderStages(orderedIds);
  };

  return (
    <StageListCore
      open={open}
      onClose={onClose}
      title={domainLabel}
      warning={`Alterações afetam o Kanban imediatamente para todos os usuários de ${domainLabel}. Não dá pra remover etapas com registros ativos.`}
      stages={stages}
      rowKey={(s) => s.isNew ? s.tempId : s.stageKey}
      getCount={(s) => countsByStage[s.stageKey] || 0}
      makeNewStage={() => ({
        tempId: `new_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        ...NEW_STAGE_DEFAULTS,
      })}
      protectedKeys={nonDeletableStageKeys}
      protectedLabel={domainLabel}
      onSave={handleSave}
    />
  );
}

// ── Modo CRM (persistência via replacePipeline, com código de etapa) ─────────

export function CRMStageListManager({
  open,
  onClose,
  companyId,
  companyLabel,
  accent = "var(--accent)",
  stages,
  leads,
  onReplacePipeline,
  onResetPipeline,
}) {
  const countsByStage = useMemo(() => {
    const m = {};
    for (const l of leads || []) {
      if (l.companyId !== companyId) continue;
      m[l.stage] = (m[l.stage] || 0) + 1;
    }
    return m;
  }, [leads, companyId]);

  const handleSave = async (draft) => {
    // Revalida a contagem AGORA — um lead pode ter sido movido pra uma etapa
    // removida do draft enquanto o editor estava aberto.
    const draftIds = new Set(draft.map(s => s.id));
    const blockedRemovals = (stages || []).filter(s => !draftIds.has(s.id) && (countsByStage[s.id] || 0) > 0);
    if (blockedRemovals.length) {
      alert(blockedRemovals.map(s => `Não deu pra remover "${s.name}": ${countsByStage[s.id]} lead(s) foram movidos pra lá enquanto o editor estava aberto.`).join("\n"));
      return;
    }
    await onReplacePipeline(companyId, draft.map(({ isNew, tempId, ...s }) => s));
  };

  const handleReset = () => {
    if (!confirm("Restaurar o pipeline padrão pra esta empresa? Suas customizações de etapa serão perdidas (transições não são afetadas).")) return;
    onResetPipeline(companyId);
    onClose();
  };

  return (
    <StageListCore
      open={open}
      onClose={onClose}
      title={companyLabel || companyId}
      warning="Alterações afetam o Kanban e relatórios imediatamente. Não dá pra remover etapas com leads ativos."
      stages={stages || []}
      rowKey={(s) => s.id}
      getCount={(s) => countsByStage[s.id] || 0}
      makeNewStage={() => ({ id: `custom_${Date.now().toString(36)}`, code: "?", ...NEW_STAGE_DEFAULTS })}
      showCode
      countLabel="Leads"
      accent={accent}
      onSave={handleSave}
      onReset={onResetPipeline ? handleReset : null}
    />
  );
}

export default RHStageListManager;
