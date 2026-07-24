import React, { useCallback, useMemo, useRef, useState } from "react";
import { Plus, X, AlertCircle, ExternalLink, Trash2, Settings } from "lucide-react";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import { Select } from "../ui/Select";
import { CurrencyInput } from "../ui/CurrencyInput";
import { AssigneeMultiSelect } from "../shared/AssigneeMultiSelect";
import { AvatarStack } from "../shared/AvatarStack";
import { AppToast } from "../shared/AppToast";
import { StageNavigator } from "../shared/StageNavigator";
import { KanbanFab } from "../shared/KanbanFab";
import { KanbanColumnHeader } from "../shared/KanbanColumnHeader";
import { KanbanBoardHeader } from "../shared/KanbanBoardHeader";
import { KanbanBoardScrollArea } from "../shared/KanbanBoardScrollArea";
import { RHKanbanCard } from "../rh-pipeline/RHKanbanCard";
import { RHMobileKanbanAccordion } from "../rh-pipeline/RHMobileKanbanAccordion";
import { StageColorPicker } from "../shared/stage-editor/StageColorPicker";
import { RHStageFieldsPanel } from "../shared/stage-editor/RHStageFieldsPanel";
import { useRHPipelineStages } from "../../hooks/use-rh-pipeline-stages";
import { usePosvenda } from "../../hooks/use-posvenda";
import { useAvailableHeight } from "../../hooks/use-available-height";
import { formatK } from "../../utils/currency";

function daysInStage(dateStr) {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

// ── Card ──────────────────────────────────────────────────────────────────────
// Chrome (badge de aging, menu "mover para"/excluir, drag) vem de
// RHKanbanCard — o mesmo componente que já cobre Recrutamento/Onboarding/
// Treinamentos/Avaliação/Férias, porque o dado aqui tem o mesmo formato
// (stage = stageKey de rh_pipeline_stages). Só o conteúdo interno é próprio.
function PosVendaCardBody({ kase, owners, sourceLead, onOpenLead }) {
  return (
    <>
      <div className="font-semibold text-[13px] leading-snug mb-2 line-clamp-2" style={{ color: "var(--text)" }}>
        {kase.clientName}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold" style={{ color: "#15803D" }}>{formatK(kase.value)}</span>
        <AvatarStack users={owners} size={20} max={3} />
      </div>
      {sourceLead && (
        <button
          onClick={(e) => { e.stopPropagation(); onOpenLead?.(sourceLead); }}
          className="mt-2.5 pt-2 border-t w-full flex items-center gap-1.5 text-[11px] cursor-pointer"
          style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "none", border: "none", borderTop: "1px solid var(--border)" }}
          onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}
          title="Ver negócio de origem em Venda"
        >
          <ExternalLink size={11} />
          Negócio de origem
        </button>
      )}
    </>
  );
}

// ── Novo caso (modal — funciona igual a partir do FAB, do botão do header,
// do "+" de cada coluna e do "+" do acordeão mobile) ─────────────────────────

function QuickAddCaseModal({ stage, companyId, currentUser, users, onAdd, onClose }) {
  const [clientName, setClientName] = useState("");
  const [value, setValue] = useState("");
  const [ownerIds, setOwnerIds] = useState(currentUser?.id ? [currentUser.id] : []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  React.useEffect(() => { inputRef.current?.focus(); }, []);

  const ownerOptions = useMemo(() => {
    return (users || []).filter(u =>
      u.companies?.includes(companyId) &&
      (u.role === "vendedor" || u.role === "consultor" || u.role === "gerente" || u.role === "admin")
    );
  }, [users, companyId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clientName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const primaryOwner = ownerIds[0] || currentUser?.id || null;
      await onAdd({
        companyId,
        clientName: clientName.trim(),
        value: parseFloat(value) || 0,
        ownerIds: ownerIds.length ? ownerIds : (primaryOwner ? [primaryOwner] : []),
        stage: stage.stageKey,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Não foi possível criar o caso.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "var(--overlay-scrim)" }} onClick={onClose}>
      <div
        className="rounded-2xl w-full max-w-md"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-pop)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          <div className="font-bold text-base" style={{ color: "var(--text)" }}>Novo caso de pós-venda</div>
          <button onClick={onClose} className="p-1.5 rounded-lg cursor-pointer" style={{ color: "var(--text-dim)", background: "none", border: "none" }}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          <div className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
            Etapa: <span style={{ color: stage.color }}>{stage.name}</span>
          </div>
          <input
            ref={inputRef}
            type="text"
            placeholder="Nome do cliente *"
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
            style={{ borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface-alt)" }}
          />
          <CurrencyInput
            value={value}
            onChange={setValue}
            className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
            style={{ borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface-alt)" }}
          />
          {ownerOptions.length > 0 && (
            <AssigneeMultiSelect
              value={ownerIds}
              onChange={setOwnerIds}
              options={ownerOptions}
              placeholder="Responsável(is)"
            />
          )}
          {error && (
            <div className="text-xs rounded-lg px-3 py-2" style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}>
              {error}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || !clientName.trim()}
              className="flex-1 text-sm font-semibold py-2 rounded-xl transition-opacity"
              style={{ background: "var(--accent)", color: "#FFFFFF", border: "none", opacity: saving || !clientName.trim() ? 0.5 : 1 }}
            >
              {saving ? "Salvando…" : "Criar caso"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 text-sm rounded-xl border"
              style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Detalhe do caso (modal leve — nada comparável ao drawer de 3 painéis de
// Venda/RH ainda, "começa simples" por pedido explícito do usuário) ─────────

function PosVendaDetailModal({ kase, stages, owners, sourceLead, canWrite, onClose, onMove, onDelete, onOpenLead }) {
  const st = stages.find(s => s.stageKey === kase.stage) || { name: "—", color: "#8A8680" };
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "var(--overlay-scrim)" }} onClick={onClose}>
      <div
        className="rounded-2xl w-full max-w-md flex flex-col"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-pop)", maxHeight: "88vh" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b flex items-start justify-between gap-3" style={{ borderColor: "var(--border)" }}>
          <div className="min-w-0">
            <div className="font-bold text-base truncate" style={{ color: "var(--text)" }}>{kase.clientName}</div>
            <span
              className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ background: `${st.color}18`, color: st.color, border: `1px solid ${st.color}40` }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.color }} />
              {st.name}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg cursor-pointer flex-shrink-0" style={{ color: "var(--text-dim)", background: "none", border: "none" }}>
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-dim)" }}>Valor</div>
              <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>{formatK(kase.value)}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-dim)" }}>Responsáveis</div>
              {owners.length > 0 ? <AvatarStack users={owners} size={22} max={4} /> : <span className="text-sm" style={{ color: "var(--text-dim)" }}>—</span>}
            </div>
          </div>

          {sourceLead && (
            <button
              onClick={() => { onOpenLead?.(sourceLead); onClose(); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer"
              style={{ background: "var(--surface-alt)", color: "var(--text)", border: "1px solid var(--border)" }}
            >
              <ExternalLink size={13} />
              Ver negócio de origem em Venda
            </button>
          )}

          {canWrite && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-dim)" }}>Mover para</div>
              <StageNavigator
                targets={stages.filter(s => s.stageKey !== kase.stage)}
                onMove={(stageKey) => { onMove(stageKey); onClose(); }}
              />
            </div>
          )}
        </div>

        {canWrite && (
          <div className="px-5 py-3 border-t" style={{ borderColor: "var(--border)" }}>
            {confirmingDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs flex-1" style={{ color: "var(--text)" }}>Excluir este caso? Não pode ser desfeito.</span>
                <button onClick={() => { onDelete(); onClose(); }} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer" style={{ background: "#B91C1C", color: "#FFFFFF", border: "none" }}>Excluir</button>
                <button onClick={() => setConfirmingDelete(false)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer" style={{ background: "var(--surface-alt)", color: "var(--text)", border: "1px solid var(--border)" }}>Cancelar</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                style={{ color: "#B91C1C", background: "none", border: "none" }}
              >
                <Trash2 size={13} />
                Excluir caso
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Nova etapa (local ao arquivo — mesmo molde de EntregasView.jsx/
// MarketingView.jsx: "Editar etapas" saiu do header, criar etapa agora é
// isso aqui, e renomear/recolorir/excluir uma já existente vive dentro de
// "Editar campos desta etapa") ───────────────────────────────────────────────

const NEW_STAGE_DEFAULTS_COLOR = "#64748B";

function slugifyStageKeyLocal(label) {
  return (label || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50) || `etapa_${Date.now().toString(36)}`;
}

function NewStageModal({ existingKeys, nextOrderIdx, onAdd, onClose }) {
  const [name, setName]   = useState("");
  const [color, setColor] = useState(NEW_STAGE_DEFAULTS_COLOR);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      let key = slugifyStageKeyLocal(name);
      let suffix = 1;
      while (existingKeys.includes(key)) key = `${slugifyStageKeyLocal(name)}_${suffix++}`;
      await onAdd({ stageKey: key, name: name.trim(), color, orderIdx: nextOrderIdx, terminal: false, won: false, lost: false });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao criar etapa.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 380, boxShadow: "var(--shadow-pop)" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Nova etapa</div>
          <button type="button" onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 6, borderRadius: 8, display: "flex" }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, display: "block" }}>
            Nome da etapa
          </label>
          <div className="flex items-center gap-2.5" style={{ marginBottom: 18 }}>
            <StageColorPicker value={color} onChange={setColor} size={38} />
            <input autoFocus type="text" placeholder="Ex.: Garantia estendida"
              value={name} onChange={e => setName(e.target.value)}
              className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
              style={{ borderColor: "#D1D5DB", color: "var(--text)", background: "var(--surface)" }} />
          </div>
          {error && (
            <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 16 }}>{error}</div>
          )}
          <button type="submit" disabled={saving || !name.trim()}
            className="w-full font-semibold py-2.5 rounded-xl text-sm"
            style={{ background: "var(--accent)", color: "#FFF", opacity: (saving || !name.trim()) ? 0.5 : 1, border: "none", cursor: (saving || !name.trim()) ? "default" : "pointer" }}>
            {saving ? "Criando…" : "Criar etapa"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── PosVendaView ──────────────────────────────────────────────────────────────

export function PosVendaView({ user, activeCompany, accessibleCompanies, onCompanyChange, leads, users, onOpenLead }) {
  const isGroupView = activeCompany === "all";
  const userRoleList = user.roles?.length ? user.roles : (user.role ? [user.role] : []);
  const isManager = userRoleList.includes("gerente") || userRoleList.includes("admin");
  const isConsultor = userRoleList.includes("consultor");
  // Mesma regra que hoje trava "Editar etapas" na visão agregada de várias
  // empresas — "+ Nova etapa"/drag de coluna herdam essa condição, não só
  // isManager, senão um gerente na visão de grupo ganha um jeito de mexer em
  // etapas que hoje é deliberadamente bloqueado nessa visão.
  const canManageStages = isManager && !isGroupView;

  // user.companies pode ter ids legados que a constraint do banco rejeita —
  // mesma proteção usada em CRMView.
  const firstValidCompany = (user.companies || []).find(c => COMPANY_IDS.includes(c)) || "industria";
  const companyForBoard = isGroupView ? firstValidCompany : activeCompany;

  const { stages, addStage, reorderStages } = useRHPipelineStages("posvenda");
  const { cases, canWrite, createCase, deleteCase, changeStage } = usePosvenda({
    userId: user.id, role: user.role, roles: user.roles,
  });

  const subordinateIds = useMemo(() => {
    if (user.role !== "vendedor") return new Set();
    return new Set((users || []).filter(u => u.supervisorId === user.id).map(u => u.id));
  }, [users, user.id, user.role]);

  const leadsById = useMemo(() => new Map((leads || []).map(l => [l.id, l])), [leads]);
  const usersById = useMemo(() => new Map((users || []).map(u => [u.id, u])), [users]);

  const scopedCases = useMemo(() => {
    let s = cases;
    if (!isGroupView) s = s.filter(c => c.companyId === activeCompany);
    if (isConsultor) {
      s = s.filter(c => c.ownerIds.includes(user.id));
    } else if (!isManager) {
      s = s.filter(c => c.ownerIds.some(id => id === user.id || subordinateIds.has(id)));
    }
    return s;
  }, [cases, activeCompany, isGroupView, isManager, isConsultor, subordinateIds, user.id]);

  const byStage = useMemo(() => {
    const bucket = Object.create(null);
    for (const s of stages) bucket[s.stageKey] = { cases: [], total: 0 };
    for (const c of scopedCases) {
      if (!bucket[c.stage]) bucket[c.stage] = { cases: [], total: 0 };
      bucket[c.stage].cases.push(c);
      bucket[c.stage].total += c.value || 0;
    }
    return bucket;
  }, [scopedCases, stages]);

  const summary = useMemo(() => {
    let total = 0;
    for (const c of scopedCases) total += c.value || 0;
    return { count: scopedCases.length, total };
  }, [scopedCases]);

  const [draggedCase, setDraggedCase] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [stageError, setStageError] = useState(null);
  const [createModalStage, setCreateModalStage] = useState(null);
  const [addingStage, setAddingStage] = useState(false);
  const [draggedColumnKey, setDraggedColumnKey] = useState(null);
  const [editingFieldsStage, setEditingFieldsStage] = useState(null); // { stageKey, name }
  const [selectedCase, setSelectedCase] = useState(null);

  const trailingRef = useRef(null);
  const [boardRef, boardHeight] = useAvailableHeight(16, [], trailingRef);

  const handleDragStart = useCallback((id) => setDraggedCase(id), []);
  const handleDragEnd = useCallback(() => { setDraggedCase(null); setDragOverStage(null); }, []);
  const handleDragOver = useCallback((e, stageKey) => { e.preventDefault(); setDragOverStage(stageKey); }, []);
  const handleDragLeave = useCallback((e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStage(null); }, []);

  const attemptStageChange = useCallback(async (id, stageKey) => {
    try {
      await changeStage(id, stageKey);
    } catch (e) {
      setStageError(e?.message || "Não foi possível mover o caso.");
    }
  }, [changeStage]);

  const handleDrop = useCallback((stageKey) => {
    if (draggedCase) attemptStageChange(draggedCase, stageKey);
    setDraggedCase(null);
    setDragOverStage(null);
  }, [draggedCase, attemptStageChange]);

  // Canal de drag separado do drag de card (draggedColumnKey vs
  // draggedCase) — reordena etapas arrastando o cabeçalho da coluna.
  const handleColumnDragEnd = useCallback(() => setDraggedColumnKey(null), []);
  const handleColumnDrop = useCallback((targetStageKey) => {
    const draggedKey = draggedColumnKey;
    setDraggedColumnKey(null);
    if (!draggedKey || draggedKey === targetStageKey) return;
    const order = stages.map(s => s.stageKey);
    const fromIdx = order.indexOf(draggedKey);
    const toIdx   = order.indexOf(targetStageKey);
    if (fromIdx === -1 || toIdx === -1) return;
    const nextOrder = [...order];
    nextOrder.splice(fromIdx, 1);
    nextOrder.splice(toIdx, 0, draggedKey);
    const dbIdByKey = new Map(stages.map(s => [s.stageKey, s.id]));
    const orderedIds = nextOrder.map(k => dbIdByKey.get(k)).filter(Boolean);
    if (orderedIds.length === nextOrder.length) reorderStages(orderedIds);
  }, [draggedColumnKey, stages, reorderStages]);

  const resolveOwners = useCallback((ownerIds) => (ownerIds || []).map(id => usersById.get(id)).filter(Boolean), [usersById]);

  const firstNonTerminalStage = stages.find(s => !s.terminal);

  return (
    <>
      {stageError && (
        <AppToast variant="danger" position="top-right" icon={AlertCircle} onDismiss={() => setStageError(null)}>
          {stageError}
        </AppToast>
      )}
      <div className="space-y-5">
        <KanbanBoardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="font-bold leading-tight" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
                Funil de Pós-venda
              </h1>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
                {summary.count} caso{summary.count !== 1 ? "s" : ""}
                {summary.total > 0 && ` · ${formatK(summary.total)} em carteira`}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {isManager && accessibleCompanies && accessibleCompanies.filter(id => id !== "all").length > 1 && (
                <Select
                  value={activeCompany}
                  onChange={e => onCompanyChange(e.target.value)}
                  options={[
                    { value: "all", label: "Todas as empresas" },
                    ...accessibleCompanies.filter(id => id !== "all").map(id => ({ value: id, label: COMPANIES[id]?.short || id })),
                  ]}
                  className="w-44"
                  size="sm"
                />
              )}
              {firstNonTerminalStage && (
                <button
                  onClick={() => setCreateModalStage(firstNonTerminalStage)}
                  className="flex items-center gap-1.5 font-semibold"
                  style={{ background: "var(--accent)", color: "#FFFFFF", border: "none", borderRadius: 10, padding: "6px 16px", fontSize: 13, cursor: "pointer" }}
                >
                  <Plus size={14} />
                  Novo caso
                </button>
              )}
            </div>
          </div>
        </KanbanBoardHeader>

        {firstNonTerminalStage && (
          <KanbanFab label="Novo caso" flush onClick={() => setCreateModalStage(firstNonTerminalStage)} />
        )}

        {/* Mobile: acordeão vertical — mesmo padrão dos boards de RH */}
        <RHMobileKanbanAccordion
          stages={stages}
          itemsByStage={Object.fromEntries(stages.map(s => [s.stageKey, (byStage[s.stageKey]?.cases) || []]))}
          addLabel="Novo caso"
          emptyLabel="Nenhum caso nesta etapa"
          onAdd={(stageKey) => setCreateModalStage(stages.find(s => s.stageKey === stageKey))}
          renderCard={(kase) => (
            <RHKanbanCard
              key={kase.id}
              id={kase.id}
              stage={kase.stage}
              stages={stages}
              onClick={() => setSelectedCase(kase)}
              onMoveToStage={canWrite ? attemptStageChange : undefined}
              onDeleteCard={canWrite ? deleteCase : undefined}
              deleteLabel="Excluir caso"
              deleteConfirmMessage="Excluir este caso de pós-venda? Não pode ser desfeito."
              agingDays={daysInStage(kase.stageChangedAt)}
              showMoveOptions
            >
              <PosVendaCardBody kase={kase} owners={resolveOwners(kase.ownerIds)} sourceLead={leadsById.get(kase.leadId)} onOpenLead={onOpenLead} />
            </RHKanbanCard>
          )}
        />
        {canManageStages && (
          <button
            onClick={() => setAddingStage(true)}
            className="lg:hidden w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 border-dashed text-xs font-semibold"
            style={{ borderColor: "var(--border-strong)", color: "var(--text-dim)", background: "var(--surface)", cursor: "pointer" }}
          >
            <Plus size={13} />
            Nova etapa
          </button>
        )}

        {/* Desktop: colunas horizontais — mesmo enquadramento visual de
            Venda/Entregas (coluna bege, header branco separado, ver
            KanbanBoardScrollArea.jsx). */}
        <div className="hidden lg:block">
          <KanbanBoardScrollArea scrollRef={boardRef} height={boardHeight}>
            <div className="flex gap-2 h-full" style={{ minWidth: `${stages.length * 280}px` }}>
              {stages.map(stage => {
                const bucket = byStage[stage.stageKey] || { cases: [], total: 0 };
                const isOver = dragOverStage === stage.stageKey;
                return (
                  <div
                    key={stage.stageKey}
                    onDragOver={e => handleDragOver(e, stage.stageKey)}
                    onDragLeave={handleDragLeave}
                    onDrop={() => handleDrop(stage.stageKey)}
                    className="flex flex-col rounded-lg transition-all duration-150"
                    style={{
                      width: 272, minWidth: 272, height: "100%", overflow: "hidden",
                      border: "1px solid var(--border)",
                      background: isOver ? stage.color + "14" : "var(--surface-alt)",
                      boxShadow: isOver ? `0 0 0 2px ${stage.color}40` : "none",
                    }}
                  >
                    {/* Arrastável pra reordenar etapas — canal de drag separado do
                        drag de card (draggedColumnKey vs draggedCase),
                        stopPropagation nos handlers pra não vazar pro drag de
                        card do <div> pai da coluna. Só gerente fora da visão
                        agregada pode reordenar (mesma regra de "+ Nova etapa"). */}
                    <div
                      draggable={canManageStages}
                      onDragStart={() => canManageStages && setDraggedColumnKey(stage.stageKey)}
                      onDragEnd={handleColumnDragEnd}
                      onDragOver={e => { if (draggedColumnKey) { e.preventDefault(); e.stopPropagation(); } }}
                      onDrop={e => { if (draggedColumnKey && draggedColumnKey !== stage.stageKey) { e.stopPropagation(); handleColumnDrop(stage.stageKey); } }}
                      style={{ cursor: canManageStages ? "grab" : "default" }}
                    >
                      <KanbanColumnHeader
                        color={stage.color}
                        name={stage.name}
                        count={bucket.cases.length}
                        bandHeight={4}
                        letterSpacing="normal"
                        nameColor={stage.color}
                        nameFontSize={14}
                        nameFontWeight={700}
                        uppercase={false}
                        countFontSize={12}
                        actions={isManager && (
                          <button
                            onClick={() => setEditingFieldsStage({ stageKey: stage.stageKey, name: stage.name })}
                            className="flex items-center justify-center rounded-md cursor-pointer transition-colors"
                            style={{ width: 24, height: 24, flexShrink: 0, color: "var(--text-dim)", background: "transparent", border: "1px solid transparent" }}
                            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
                            title="Editar fase"
                          >
                            <Settings size={13} />
                          </button>
                        )}
                      >
                        <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)", fontWeight: 600 }}>
                          {bucket.total > 0 ? formatK(bucket.total) : "R$ 0"}
                        </div>
                      </KanbanColumnHeader>
                    </div>

                    <div className="px-2 pt-2 pb-1 flex-1 overflow-y-auto" style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 0 }}>
                      {bucket.cases.length === 0 ? (
                        <div
                          className="flex flex-col items-center justify-center py-8 mx-1 rounded-lg border-2 border-dashed text-xs gap-1"
                          style={{ borderColor: isOver ? stage.color + "40" : "var(--border)", color: "var(--text-dim)" }}
                        >
                          {isOver ? (
                            <><Plus size={16} style={{ opacity: 0.5 }} /><span>Soltar aqui</span></>
                          ) : (
                            <span style={{ opacity: 0.5 }}>Nenhum caso nesta etapa</span>
                          )}
                        </div>
                      ) : (
                        bucket.cases.map(kase => (
                          <RHKanbanCard
                            key={kase.id}
                            id={kase.id}
                            stage={kase.stage}
                            stages={stages}
                            onClick={() => setSelectedCase(kase)}
                            onDragStart={canWrite ? handleDragStart : undefined}
                            onDragEnd={canWrite ? handleDragEnd : undefined}
                            onDeleteCard={canWrite ? deleteCase : undefined}
                            deleteLabel="Excluir caso"
                            deleteConfirmMessage="Excluir este caso de pós-venda? Não pode ser desfeito."
                            agingDays={daysInStage(kase.stageChangedAt)}
                            showMoveOptions={false}
                          >
                            <PosVendaCardBody kase={kase} owners={resolveOwners(kase.ownerIds)} sourceLead={leadsById.get(kase.leadId)} onOpenLead={onOpenLead} />
                          </RHKanbanCard>
                        ))
                      )}
                      {canWrite && !stage.terminal && (
                        <button
                          onClick={() => setCreateModalStage(stage)}
                          className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                          style={{ background: stage.color + "18", color: stage.color, border: `1px dashed ${stage.color}44` }}
                        >
                          <Plus size={12} />
                          Novo caso
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {canManageStages && (
                <button
                  onClick={() => setAddingStage(true)}
                  title="Nova etapa"
                  className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed text-xs font-semibold shrink-0"
                  style={{ width: 140, height: 64, borderColor: "var(--border-strong)", color: "var(--text-dim)", background: "var(--surface)", cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-dim)"; }}
                >
                  <Plus size={16} />
                  Nova etapa
                </button>
              )}
            </div>
          </KanbanBoardScrollArea>
        </div>

        <div ref={trailingRef}>
          <p className="text-xs text-center" style={{ color: "var(--text-dim)" }}>
            Arraste para mover entre etapas · Clique no card para ver detalhes
          </p>
        </div>
      </div>

      <RHStageFieldsPanel
        open={!!editingFieldsStage}
        onClose={() => setEditingFieldsStage(null)}
        domain="posvenda"
        stageKey={editingFieldsStage?.stageKey}
        stageName={editingFieldsStage?.name}
        records={cases}
        stageField="stage"
      />

      {selectedCase && (
        <PosVendaDetailModal
          kase={selectedCase}
          stages={stages}
          owners={resolveOwners(selectedCase.ownerIds)}
          sourceLead={leadsById.get(selectedCase.leadId)}
          canWrite={canWrite}
          onClose={() => setSelectedCase(null)}
          onMove={(stageKey) => attemptStageChange(selectedCase.id, stageKey)}
          onDelete={() => deleteCase(selectedCase.id)}
          onOpenLead={onOpenLead}
        />
      )}

      {createModalStage && (
        <QuickAddCaseModal
          stage={createModalStage}
          companyId={companyForBoard}
          currentUser={user}
          users={users}
          onAdd={createCase}
          onClose={() => setCreateModalStage(null)}
        />
      )}

      {addingStage && (
        <NewStageModal
          existingKeys={stages.map(s => s.stageKey)}
          nextOrderIdx={stages.length}
          onAdd={addStage}
          onClose={() => setAddingStage(false)}
        />
      )}
    </>
  );
}

export default PosVendaView;
