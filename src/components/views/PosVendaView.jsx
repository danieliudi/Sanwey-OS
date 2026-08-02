import React, { useCallback, useMemo, useRef, useState } from "react";
import { Plus, X, AlertCircle, ExternalLink, Settings, LayoutGrid, TrendingUp, List, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import { Select } from "../ui/Select";
import { CurrencyInput } from "../ui/CurrencyInput";
import { AssigneeMultiSelect } from "../shared/AssigneeMultiSelect";
import { AvatarStack } from "../shared/AvatarStack";
import { MobileTableCards } from "../shared/MobileTableCards";
import { AppToast } from "../shared/AppToast";
import { StageNavigator } from "../shared/StageNavigator";
import { KanbanFab } from "../shared/KanbanFab";
import { KanbanColumnHeader } from "../shared/KanbanColumnHeader";
import { KanbanColumnSortMenu } from "../shared/KanbanColumnSortMenu";
import { useKanbanColumnSort } from "../../hooks/use-kanban-sort";
import { sortKanbanItems } from "../../utils/kanban-sort";
import { KanbanBoardHeader } from "../shared/KanbanBoardHeader";
import { KanbanBoardScrollArea } from "../shared/KanbanBoardScrollArea";
import { RHKanbanCard } from "../rh-pipeline/RHKanbanCard";
import { RHMobileKanbanAccordion } from "../rh-pipeline/RHMobileKanbanAccordion";
import { StageColorPicker } from "../shared/stage-editor/StageColorPicker";
import { RHStageFieldsPanel } from "../shared/stage-editor/RHStageFieldsPanel";
import { ViewToggleButton } from "../shared/ViewToggleButton";
import { KanbanAnalyticsPanel } from "../shared/KanbanAnalyticsPanel";
import { StageFieldInput } from "../shared/StageFieldInput";
import { SplitPanelDrawer } from "../shared/SplitPanelDrawer";
import { RHDetailDrawerShell, RHDetailComments } from "../rh-pipeline/RHDetailDrawerShell";
import { getMentionableUsers } from "../../utils/mentionable-users";
import { useRHPipelineStages } from "../../hooks/use-rh-pipeline-stages";
import { useRHStageFields } from "../../hooks/use-rh-stage-fields";
import { usePosvenda } from "../../hooks/use-posvenda";
import { useAvailableHeight } from "../../hooks/use-available-height";
import { formatK } from "../../utils/currency";
import { resolveVisibleFields, getMissingRequiredFields } from "../../utils/field-conditions";
import { getInvalidFields } from "../../utils/field-validation";

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
        <span className="font-semibold" style={{ color: "var(--success)" }}>{formatK(kase.value)}</span>
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
  const [customValues, setCustomValues] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const inputRef = useRef(null);

  const stageFields = useRHStageFields("posvenda");
  const visibleFields = resolveVisibleFields(stageFields.getFields(stage.stageKey), customValues);

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
    setSubmitAttempted(true);
    const missing = getMissingRequiredFields(visibleFields, customValues);
    if (missing.length > 0) {
      setError(`Preencha antes: ${missing.map(f => f.label).join(", ")}.`);
      return;
    }
    const invalid = getInvalidFields(visibleFields, customValues);
    if (invalid.length > 0) {
      setError(`Corrija antes: ${invalid.map(f => `${f.label} (${f.validationError})`).join(", ")}.`);
      return;
    }
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
        customFields: customValues,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Não foi possível criar o caso.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "var(--overlay-scrim)" }}>
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
          {visibleFields.length > 0 && (
            <div className="pt-1 space-y-3">
              {visibleFields.map(f => (
                <div key={f.id}>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-dim)" }}>
                    {f.effectiveRequired && <span style={{ color: "var(--danger)" }}>* </span>}
                    {f.label}
                  </label>
                  <StageFieldInput
                    field={f}
                    value={customValues[f.fieldKey]}
                    onChange={val => setCustomValues(prev => ({ ...prev, [f.fieldKey]: val }))}
                    users={users}
                    companyId={companyId}
                    touched={submitAttempted}
                  />
                </div>
              ))}
            </div>
          )}
          {error && (
            <div className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)" }}>
              {error}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || !clientName.trim()}
              className="flex-1 text-sm font-semibold py-2 rounded-xl transition-opacity"
              style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", opacity: saving || !clientName.trim() ? 0.5 : 1 }}
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

// ── Detalhe do caso (drawer de 3 painéis — mesmo shell de Venda/RH/Comex) ───

function PosVendaDetailDrawer({ kase, stages, owners, sourceLead, canWrite, users, currentUser, onClose, onMove, onDelete, onOpenLead, onUpdateCustomFields, onAddActivity, onUpdateActivity }) {
  const st = stages.find(s => s.stageKey === kase.stage) || { name: "—", color: "#8A8680" };
  const [moveError, setMoveError] = useState(null);

  const stageFields = useRHStageFields("posvenda");
  const customDefs = stageFields.getFields(kase.stage);
  const [customDraft, setCustomDraft] = useState({});
  React.useEffect(() => { setCustomDraft({}); setMoveError(null); }, [kase.id]);

  const getCustomValue = (fieldKey) =>
    fieldKey in customDraft ? customDraft[fieldKey] : (kase.customFields?.[fieldKey] ?? "");

  const handleCustomChange = (fieldKey, val) => {
    setCustomDraft(prev => ({ ...prev, [fieldKey]: val }));
    onUpdateCustomFields({ ...(kase.customFields || {}), [fieldKey]: val });
  };

  const customValuesByKey = { ...(kase.customFields || {}), ...customDraft };
  const visibleCustomDefs = resolveVisibleFields(customDefs, customValuesByKey);
  const days = daysInStage(kase.stageChangedAt);

  const header = (
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
  );

  const left = (
    <>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-dim)" }}>Valor</div>
        <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>{formatK(kase.value)}</div>
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-dim)" }}>Responsáveis</div>
        {owners.length > 0 ? <AvatarStack users={owners} size={22} max={4} /> : <span className="text-sm" style={{ color: "var(--text-dim)" }}>—</span>}
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-dim)" }}>Empresa</div>
        <div className="text-sm" style={{ color: "var(--text)" }}>{COMPANIES[kase.companyId]?.short || kase.companyId || "—"}</div>
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-dim)" }}>Nesta etapa há</div>
        <div className="text-sm" style={{ color: "var(--text)" }}>
          {kase.stageChangedAt ? `${days} dia${days !== 1 ? "s" : ""}` : "—"}
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
    </>
  );

  const formContent = (
    <div className="space-y-3">
      {visibleCustomDefs.length > 0 ? (
        <>
          <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Campos desta etapa</div>
          {visibleCustomDefs.map(f => (
            <div key={f.id}>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text)" }}>
                {f.effectiveRequired && <span style={{ color: "var(--danger)" }}>* </span>}
                {f.label}
              </label>
              <StageFieldInput
                field={f}
                value={getCustomValue(f.fieldKey)}
                onChange={val => canWrite && handleCustomChange(f.fieldKey, val)}
                users={users}
                touched={Boolean(moveError)}
              />
            </div>
          ))}
        </>
      ) : (
        <div className="text-xs italic" style={{ color: "var(--text-dim)" }}>
          Nenhum campo configurado para esta etapa ainda.
        </div>
      )}
    </div>
  );

  const center = (
    <RHDetailDrawerShell
      domain="posvenda"
      recordId={kase.id}
      activities={kase.notes || []}
      onAddActivity={canWrite ? onAddActivity : undefined}
      currentUser={currentUser}
      users={users}
      stages={stages}
      formContent={formContent}
      record={kase}
      recordTitle={kase.clientName}
      domainLabel="Pós-venda"
    />
  );

  const right = (
    <>
      {canWrite && moveError && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
          <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          {moveError}
        </div>
      )}

      {canWrite && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-dim)" }}>Mover para</div>
          <StageNavigator
            targets={stages.filter(s => s.stageKey !== kase.stage)}
            onMove={async (stageKey) => {
              const ok = await onMove(stageKey, setMoveError);
              if (ok === false) return;
              onClose();
            }}
          />
        </div>
      )}

      <RHDetailComments
        activities={kase.notes || []}
        onAddActivity={canWrite ? onAddActivity : undefined}
        onUpdateActivity={canWrite ? onUpdateActivity : undefined}
        currentUser={currentUser}
        users={users}
        mentionableUsers={getMentionableUsers(users, { domain: "crm", companyId: kase.companyId })}
        mentionContextLabel={kase.clientName}
      />
    </>
  );

  return (
    <SplitPanelDrawer
      onClose={onClose}
      header={header}
      left={left}
      center={center}
      right={right}
      onDelete={canWrite && onDelete ? onDelete : undefined}
      deleteLabel="Excluir caso"
    />
  );
}

// ── Tabela (mesmo molde de DeliverableTableView em EntregasView.jsx) ────────

function PosVendaTableView({ cases, stages, usersById, onRowClick }) {
  return (
    <>
    <MobileTableCards
      rows={cases}
      onRowClick={onRowClick}
      emptyMessage="Nenhum caso encontrado."
      title={(kase) => kase.clientName}
      chips={(kase) => {
        const stage = stages.find(s => s.stageKey === kase.stage);
        const color = stage?.color || "var(--text-dim)";
        return [{ label: stage?.name || kase.stage, color }];
      }}
      right={(kase) => (
        <span className="text-sm font-semibold" style={{ color: "var(--success)", whiteSpace: "nowrap" }}>{formatK(kase.value)}</span>
      )}
      metaRight={(kase) => {
        const owners = (kase.ownerIds || []).map(id => usersById.get(id)).filter(Boolean);
        const days = daysInStage(kase.stageChangedAt);
        return (
          <>
            {owners.length > 0 && <AvatarStack users={owners} size={18} max={2} />}
            <span>{kase.stageChangedAt ? `${days} dia${days !== 1 ? "s" : ""} na etapa` : "—"}</span>
          </>
        );
      }}
    />
    <div className="hidden md:block rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
            {["Cliente", "Valor", "Etapa", "Responsáveis", "Há quanto tempo na etapa"].map(h => (
              <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cases.length === 0 && (
            <tr><td colSpan={5} className="text-center py-10 text-sm" style={{ color: "var(--text-dim)" }}>Nenhum caso encontrado.</td></tr>
          )}
          {cases.map(kase => {
            const stage  = stages.find(s => s.stageKey === kase.stage);
            const color  = stage?.color || "var(--text-dim)";
            const owners = (kase.ownerIds || []).map(id => usersById.get(id)).filter(Boolean);
            const days   = daysInStage(kase.stageChangedAt);
            return (
              <tr key={kase.id} onClick={() => onRowClick(kase)} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                <td className="px-4 py-3 text-sm font-medium" style={{ color: "var(--text)", maxWidth: 220 }}>
                  <div className="truncate">{kase.clientName}</div>
                </td>
                <td className="px-4 py-3 text-xs font-semibold" style={{ color: "var(--success)", whiteSpace: "nowrap" }}>{formatK(kase.value)}</td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: color + "18", color, border: `1px solid ${color}40` }}>
                    {stage?.name || kase.stage}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {owners.length > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <AvatarStack users={owners} size={20} max={3} />
                      <span className="text-xs truncate" style={{ color: "var(--text-dim)", maxWidth: 100 }}>{owners[0].name}</span>
                    </div>
                  ) : <span className="text-xs" style={{ color: "var(--text-dim)" }}>—</span>}
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>
                  {kase.stageChangedAt ? `${days} dia${days !== 1 ? "s" : ""}` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

// ── Calendário (mesmo molde de DeliverableCalendarView em EntregasView.jsx) ──

const CAL_MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const CAL_DAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const CAL_MAX_VISIBLE = 3;

function calStartOfDay(d) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}
function calAddDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function calDayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Pós-venda não tem prazo próprio (ver use-posvenda.js — só value/companyId/
// ownerIds/stage/stageChangedAt) — cada caso é posicionado no dia em que
// entrou na etapa atual (stageChangedAt), decisão já fechada com o Daniel.
function PosVendaCalendarView({ cases, stages, onSelect }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const today = useMemo(() => calStartOfDay(new Date()), []);

  const prevMonth = () => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  const goToday   = () => { const n = new Date(); setCurrentMonth(new Date(n.getFullYear(), n.getMonth(), 1)); };

  const weeks = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);
    const gridStart = new Date(firstDay);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());

    const weeksArr = [];
    let curr = new Date(gridStart);
    while (curr <= lastDay || weeksArr.length < 4) {
      const week = [];
      for (let i = 0; i < 7; i++) { week.push(new Date(curr)); curr = calAddDays(curr, 1); }
      weeksArr.push(week);
      if (weeksArr.length >= 6) break;
    }
    return weeksArr;
  }, [currentMonth]);

  const { byDay, noDateCount } = useMemo(() => {
    const map = new Map();
    let noDate = 0;
    cases.forEach(kase => {
      if (!kase.stageChangedAt) { noDate++; return; }
      const key = calDayKey(calStartOfDay(new Date(kase.stageChangedAt)));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(kase);
    });
    return { byDay: map, noDateCount: noDate };
  }, [cases]);

  const currentMonthNum = currentMonth.getMonth();

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-bold" style={{ fontSize: 20, color: "var(--text)", letterSpacing: "-0.01em" }}>
            {CAL_MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h2>
          <button onClick={goToday} className="text-xs px-2.5 py-1 rounded-lg border font-medium"
            style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)", cursor: "pointer" }}>
            Hoje
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="flex items-center justify-center rounded-lg border"
            style={{ width: 32, height: 32, background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-dim)", cursor: "pointer" }}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={nextMonth} className="flex items-center justify-center rounded-lg border"
            style={{ width: 32, height: 32, background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-dim)", cursor: "pointer" }}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="grid grid-cols-7" style={{ borderBottom: "1px solid var(--border)" }}>
          {CAL_DAY_SHORT.map((d, i) => (
            <div key={d} className="text-center py-2 text-xs font-semibold" style={{ color: "var(--text-dim)", borderRight: i < 6 ? "1px solid var(--border)" : "none" }}>
              {d}
            </div>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7" style={{ borderBottom: wi < weeks.length - 1 ? "1px solid var(--border)" : "none" }}>
            {week.map((day, di) => {
              const isCurrentMonth = day.getMonth() === currentMonthNum;
              const isToday = day.getTime() === today.getTime();
              const isWeekend = di === 0 || di === 6;
              const items = byDay.get(calDayKey(day)) || [];
              const visible = items.slice(0, CAL_MAX_VISIBLE);
              const overflow = items.length - visible.length;
              return (
                <div key={di} style={{ borderRight: di < 6 ? "1px solid var(--border)" : "none", minHeight: 96, padding: "6px 4px", background: isWeekend ? "var(--surface-alt)" : "transparent" }}>
                  <div className="flex justify-center mb-1">
                    <span className="flex items-center justify-center text-xs font-semibold select-none"
                      style={{ width: 24, height: 24, borderRadius: "50%", background: isToday ? "var(--accent)" : "transparent", color: isToday ? "var(--on-accent)" : isCurrentMonth ? "var(--text)" : "var(--text-dim)", fontWeight: isToday ? 700 : 600 }}>
                      {day.getDate()}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {visible.map(kase => {
                      const stage = stages.find(s => s.stageKey === kase.stage);
                      const color = stage?.color || "var(--text-dim)";
                      return (
                        <button
                          key={kase.id}
                          onClick={() => onSelect(kase)}
                          title={kase.clientName}
                          className="text-left truncate text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: color + "18", color, border: `1px solid ${color}40`, cursor: "pointer" }}
                        >
                          {kase.clientName}
                        </button>
                      );
                    })}
                    {overflow > 0 && (
                      <span style={{ fontSize: 10, color: "var(--text-dim)", paddingLeft: 4 }}>+{overflow} mais</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4">
        <span className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>Etapas:</span>
        {stages.map(s => (
          <div key={s.stageKey} className="flex items-center gap-1.5">
            <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
            <span className="text-xs" style={{ color: "var(--text-dim)" }}>{s.name}</span>
          </div>
        ))}
      </div>

      {noDateCount > 0 && (
        <p className="text-xs mt-2" style={{ color: "var(--text-dim)" }}>
          {noDateCount} caso{noDateCount > 1 ? "s" : ""} sem data de entrada na etapa não {noDateCount > 1 ? "aparecem" : "aparece"} nesta visão — confira na Tabela ou no Kanban.
        </p>
      )}
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
              style={{ borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)" }} />
          </div>
          {error && (
            <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 16 }}>{error}</div>
          )}
          <button type="submit" disabled={saving || !name.trim()}
            className="w-full font-semibold py-2.5 rounded-xl text-sm"
            style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: (saving || !name.trim()) ? 0.5 : 1, border: "none", cursor: (saving || !name.trim()) ? "default" : "pointer" }}>
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
  const { cases, canWrite, createCase, updateCase, deleteCase, changeStage } = usePosvenda({
    userId: user.id, role: user.role, roles: user.roles,
  });
  const stageFields = useRHStageFields("posvenda");

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

  const { getCriteria: getSortCriteria, setCriteria: setSortCriteria } = useKanbanColumnSort("posvenda");
  const byStage = useMemo(() => {
    const bucket = Object.create(null);
    for (const s of stages) bucket[s.stageKey] = { cases: [], total: 0 };
    for (const c of scopedCases) {
      if (!bucket[c.stage]) bucket[c.stage] = { cases: [], total: 0 };
      bucket[c.stage].cases.push(c);
      bucket[c.stage].total += c.value || 0;
    }
    for (const s of stages) {
      bucket[s.stageKey].cases = sortKanbanItems(bucket[s.stageKey].cases, getSortCriteria(s.stageKey), {
        value: c => c.value,
        name: c => c.clientName,
        createdAt: c => c.createdAt,
      });
    }
    return bucket;
  }, [scopedCases, stages, getSortCriteria]);

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
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [viewMode, setViewMode] = useState("kanban"); // "kanban" | "table" | "calendar" | "analytics"

  const trailingRef = useRef(null);
  const [boardRef, boardHeight] = useAvailableHeight(16, [], trailingRef);

  const handleDragStart = useCallback((id) => setDraggedCase(id), []);
  const handleDragEnd = useCallback(() => { setDraggedCase(null); setDragOverStage(null); }, []);
  const handleDragOver = useCallback((e, stageKey) => { e.preventDefault(); setDragOverStage(stageKey); }, []);
  const handleDragLeave = useCallback((e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStage(null); }, []);

  // Mesmo enforcement do attemptStageChange do Pipeline de CRM (CRMView.jsx):
  // bloqueia sair da etapa atual com campo obrigatório (estático ou
  // condicional) vazio, ou com valor em formato inválido, antes de gravar a
  // transição.
  // onBlocked: quando o chamador já mostra o erro por conta própria (drawer,
  // que exibe inline na coluna direita), o toast global não dispara junto.
  const attemptStageChange = useCallback(async (id, stageKey, onBlocked) => {
    const reportBlock = (msg) => { if (onBlocked) onBlocked(msg); else setStageError(msg); };
    const kase = cases.find(c => c.id === id);
    if (kase) {
      const fields = stageFields.getFields(kase.stage);
      const customValues = kase.customFields || {};
      const missing = getMissingRequiredFields(fields, customValues);
      if (missing.length > 0) {
        reportBlock(`Não dá pra mover "${kase.clientName}": preencha antes — ${missing.map(f => f.label).join(", ")}.`);
        return false;
      }
      const invalid = getInvalidFields(fields, customValues);
      if (invalid.length > 0) {
        reportBlock(`Não dá pra mover "${kase.clientName}": corrija antes — ${invalid.map(f => `${f.label} (${f.validationError})`).join(", ")}.`);
        return false;
      }
    }
    try {
      await changeStage(id, stageKey);
      setStageError(null);
      if (onBlocked) onBlocked(null);
      return true;
    } catch (e) {
      reportBlock(e?.message || "Não foi possível mover o caso.");
      return false;
    }
  }, [cases, stageFields, changeStage]);

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

  // Lido sempre da lista (não de um snapshot em estado) pra que comentário
  // novo e mudança de etapa apareçam no drawer sem precisar reabrir.
  const selectedCase = selectedCaseId ? cases.find(c => c.id === selectedCaseId) : null;

  const handleAddActivity = useCallback(async (entry) => {
    const current = cases.find(c => c.id === selectedCaseId);
    if (!current) return;
    await updateCase(current.id, { notes: [...(current.notes || []), entry] });
  }, [cases, selectedCaseId, updateCase]);

  const handleUpdateActivity = useCallback(async (activityId, patch) => {
    const current = cases.find(c => c.id === selectedCaseId);
    if (!current) return;
    const next = (current.notes || []).map(a => (a.id === activityId ? { ...a, ...patch } : a));
    await updateCase(current.id, { notes: next });
  }, [cases, selectedCaseId, updateCase]);

  const firstNonTerminalStage = stages.find(s => !s.terminal);

  const analyticsStages = useMemo(
    () => stages.filter(s => !s.terminal).map(s => ({ key: s.stageKey, name: s.name, color: s.color, slaDays: s.slaDays })),
    [stages]
  );

  // "Distribuição por tipo de caso" (sugerido na spec) não tem coluna
  // equivalente em posvenda_cases (ver 20260770_posvenda_kanban.sql — sem
  // case_type/reason) — substituído por distribuição por empresa, único
  // agrupamento categórico já carregado sem query nova.
  const posVendaSpecificStats = useMemo(() => {
    const stats = [{ label: "Valor Total", value: formatK(summary.total) }];
    const byCompany = {};
    for (const c of scopedCases) byCompany[c.companyId] = (byCompany[c.companyId] || 0) + 1;
    for (const id of Object.keys(byCompany)) {
      stats.push({ label: COMPANIES[id]?.short || id, value: String(byCompany[id]) });
    }
    return stats;
  }, [scopedCases, summary.total]);

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
              <div className="inline-flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }} role="tablist">
                <ViewToggleButton active={viewMode === "kanban"} onClick={() => setViewMode("kanban")} icon={LayoutGrid} label="Kanban" iconOnlyMobile />
                <ViewToggleButton active={viewMode === "table"} onClick={() => setViewMode("table")} icon={List} label="Tabela" iconOnlyMobile />
                <ViewToggleButton active={viewMode === "calendar"} onClick={() => setViewMode("calendar")} icon={CalendarDays} label="Calendário" iconOnlyMobile />
                <ViewToggleButton active={viewMode === "analytics"} onClick={() => setViewMode("analytics")} icon={TrendingUp} label="Análise" iconOnlyMobile />
              </div>
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
              {viewMode === "kanban" && firstNonTerminalStage && (
                <button
                  onClick={() => setCreateModalStage(firstNonTerminalStage)}
                  className="flex items-center gap-1.5 font-semibold"
                  style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "6px 16px", fontSize: 13, cursor: "pointer" }}
                >
                  <Plus size={14} />
                  Novo caso
                </button>
              )}
            </div>
          </div>
        </KanbanBoardHeader>

        {viewMode === "kanban" && firstNonTerminalStage && (
          <KanbanFab label="Novo caso" flush onClick={() => setCreateModalStage(firstNonTerminalStage)} />
        )}

        {viewMode === "table" && (
          <PosVendaTableView
            cases={scopedCases}
            stages={stages}
            usersById={usersById}
            onRowClick={kase => setSelectedCaseId(kase.id)}
          />
        )}

        {viewMode === "calendar" && (
          <PosVendaCalendarView
            cases={scopedCases}
            stages={stages}
            onSelect={kase => setSelectedCaseId(kase.id)}
          />
        )}

        {viewMode === "analytics" && (
          <KanbanAnalyticsPanel
            stages={analyticsStages}
            records={scopedCases}
            getStageKey={c => c.stage}
            getStageEnteredAt={c => c.stageChangedAt}
            specificStats={posVendaSpecificStats}
            getOwnerIds={c => c.ownerIds || []}
            usersById={usersById}
          />
        )}

        {viewMode === "kanban" && (<>
        {/* Mobile: acordeão vertical — mesmo padrão dos boards de RH */}
        <RHMobileKanbanAccordion
          stages={stages}
          itemsByStage={Object.fromEntries(stages.map(s => [s.stageKey, (byStage[s.stageKey]?.cases) || []]))}
          getSortCriteria={getSortCriteria}
          setSortCriteria={setSortCriteria}
          sortOptions={["recent", "value", "alpha"]}
          addLabel="Novo caso"
          emptyLabel="Nenhum caso nesta etapa"
          onAdd={(stageKey) => setCreateModalStage(stages.find(s => s.stageKey === stageKey))}
          renderCard={(kase) => (
            <RHKanbanCard
              key={kase.id}
              id={kase.id}
              stage={kase.stage}
              stages={stages}
              onClick={() => setSelectedCaseId(kase.id)}
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
                        actions={
                          <div className="flex items-center gap-1 shrink-0">
                            <KanbanColumnSortMenu
                              criteria={getSortCriteria(stage.stageKey)}
                              onChange={(v) => setSortCriteria(stage.stageKey, v)}
                              options={["recent", "value", "alpha"]}
                              accentColor={stage.color}
                            />
                            {isManager && (
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
                          </div>
                        }
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
                            <>
                              <span style={{ opacity: 0.5 }}>Nenhum caso nesta etapa</span>
                              {!stage.terminal && <span style={{ opacity: 0.4, fontSize: 10 }}>Arraste um card aqui ou crie um novo</span>}
                            </>
                          )}
                        </div>
                      ) : (
                        bucket.cases.map(kase => (
                          <RHKanbanCard
                            key={kase.id}
                            id={kase.id}
                            stage={kase.stage}
                            stages={stages}
                            onClick={() => setSelectedCaseId(kase.id)}
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
        </>)}
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
        <PosVendaDetailDrawer
          kase={selectedCase}
          stages={stages}
          owners={resolveOwners(selectedCase.ownerIds)}
          sourceLead={leadsById.get(selectedCase.leadId)}
          canWrite={canWrite}
          users={users}
          currentUser={user}
          onClose={() => setSelectedCaseId(null)}
          onMove={(stageKey, onBlocked) => attemptStageChange(selectedCase.id, stageKey, onBlocked)}
          onDelete={() => deleteCase(selectedCase.id)}
          onUpdateCustomFields={(merged) => updateCase(selectedCase.id, { customFields: merged })}
          onAddActivity={handleAddActivity}
          onUpdateActivity={handleUpdateActivity}
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
