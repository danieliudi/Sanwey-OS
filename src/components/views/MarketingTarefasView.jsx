import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Plus, X, ListTodo, ChevronDown, Star, Filter, Settings2, AlertCircle, LayoutGrid, TrendingUp,
  List, CalendarDays, ChevronLeft, ChevronRight,
} from "lucide-react";
import { DeliverableKanbanCard } from "../campaign/DeliverableKanbanCard";
import { MarketingTaskDetailDrawer } from "../campaign/MarketingTaskDetailDrawer";
import { useMarketingTasks } from "../../hooks/use-marketing-tasks";
import { reopenAfterMove } from "../../utils/reopen-after-move";
import { useEscToClose } from "../../hooks/use-esc-to-close";
import { useMarketingCampaigns } from "../../hooks/use-marketing-campaigns";
import { useRHStageFields } from "../../hooks/use-rh-stage-fields";
import { useRHPipelineStages } from "../../hooks/use-rh-pipeline-stages";
import { RHStageFieldsPanel } from "../shared/stage-editor/RHStageFieldsPanel";
import { StageColorPicker } from "../shared/stage-editor/StageColorPicker";
import { DELIVERABLE_PRIORITIES } from "../../constants/marketing-pipelines";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import { localDateInputToISOString, formatDateBR, parseDateInput } from "../../utils/date";
import { AvatarStack } from "../shared/AvatarStack";
import { useUsersById } from "../../hooks/use-users-by-id";
import { resolveVisibleFields, getMissingRequiredFields, getFieldCompleteness } from "../../utils/field-conditions";
import { getInvalidFields } from "../../utils/field-validation";
import { getMentionableUsers } from "../../utils/mentionable-users";
import { RHStageFieldInput } from "../rh-pipeline/RHStageFieldInput";
import { AssigneeMultiSelect } from "../shared/AssigneeMultiSelect";
import { AppToast } from "../shared/AppToast";
import { useRecordViews } from "../../hooks/use-record-views";
import { hasUnreadNotesComment } from "../../lib/comment-badge";
import { useAvailableHeight } from "../../hooks/use-available-height";
import { KanbanFab } from "../shared/KanbanFab";
import { KanbanColumnHeader } from "../shared/KanbanColumnHeader";
import { KanbanBoardScrollArea } from "../shared/KanbanBoardScrollArea";
import { KanbanBoardHeader } from "../shared/KanbanBoardHeader";
import { ViewToggleButton } from "../shared/ViewToggleButton";
import { KanbanAnalyticsPanel } from "../shared/KanbanAnalyticsPanel";
import { KanbanColumnSortMenu } from "../shared/KanbanColumnSortMenu";
import { useKanbanColumnSort } from "../../hooks/use-kanban-sort";
import { sortKanbanItems } from "../../utils/kanban-sort";

function isOverdueTask(t) {
  return Boolean(t.deadline) && new Date(t.deadline) < new Date();
}

function isDueSoon(t) {
  if (!t.deadline) return false;
  const diffMs = new Date(t.deadline).getTime() - Date.now();
  return diffMs >= 0 && diffMs <= 7 * 86400000;
}

/* ── Tabela (item 9/11: padronização de views — mesmo padrão de EntregasView.jsx) ── */
function TaskTableView({ tasks, stages, usersById, campaignsById, onRowClick }) {
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
            {["Título", "Campanha", "Prioridade", "Etapa", "Responsável", "Prazo"].map(h => (
              <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 && (
            <tr><td colSpan={6} className="text-center py-10 text-sm" style={{ color: "var(--text-dim)" }}>Nenhuma tarefa encontrada.</td></tr>
          )}
          {tasks.map(item => {
            const stage = (stages || []).find(s => s.id === item.stage);
            const color = stage?.color || "var(--text-dim)";
            const pri = DELIVERABLE_PRIORITIES.find(p => p.id === item.priority);
            const resolvedOwners = (item.assigneeIds || []).map(id => usersById.get(id)).filter(Boolean);
            const campaign = item.campaignId ? campaignsById.get(item.campaignId) : null;
            const isOverdue = isOverdueTask(item);
            return (
              <tr key={item.id} onClick={() => onRowClick(item)} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                <td className="px-4 py-3 text-sm font-medium" style={{ color: "var(--text)", maxWidth: 220 }}>
                  <div className="truncate">{item.title}</div>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)", maxWidth: 140 }}>
                  {campaign ? <span className="truncate block" title={campaign.name}>{campaign.name}</span> : "—"}
                </td>
                <td className="px-4 py-3">
                  {pri ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: pri.color + "18", color: pri.color, border: `1px solid ${pri.color}40` }}>
                      {pri.label}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: color + "18", color, border: `1px solid ${color}40` }}>
                    {stage?.name || item.stage}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {resolvedOwners.length > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <AvatarStack users={resolvedOwners} size={20} max={3} />
                      <span className="text-xs truncate" style={{ color: "var(--text-dim)", maxWidth: 100 }}>{resolvedOwners[0].name}</span>
                    </div>
                  ) : <span className="text-xs" style={{ color: "var(--text-dim)" }}>—</span>}
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: isOverdue ? "var(--danger)" : "var(--text-dim)", fontWeight: isOverdue ? 600 : 400 }}>
                  {item.deadline ? formatDateBR(item.deadline) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Calendário (mesmo grid de EntregasView.jsx — tarefa tem prazo de um dia só) ── */
const CAL_MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const CAL_DAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const CAL_MAX_VISIBLE = 3;

function calStartOfDay(d) { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; }
function calAddDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function calDayKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

function TaskCalendarView({ tasks, stages, onSelect }) {
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

  const { byDay, noDeadlineCount } = useMemo(() => {
    const map = new Map();
    let noDeadline = 0;
    tasks.forEach(item => {
      if (!item.deadline) { noDeadline++; return; }
      const key = calDayKey(calStartOfDay(parseDateInput(item.deadline)));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return { byDay: map, noDeadlineCount: noDeadline };
  }, [tasks]);

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
                    {visible.map(item => {
                      const stage = (stages || []).find(s => s.id === item.stage);
                      const color = stage?.color || "var(--text-dim)";
                      return (
                        <button
                          key={item.id}
                          onClick={() => onSelect(item)}
                          title={item.title}
                          className="text-left truncate text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: color + "18", color, border: `1px solid ${color}40`, cursor: "pointer" }}
                        >
                          {item.title}
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
        {(stages || []).map(s => (
          <div key={s.id} className="flex items-center gap-1.5">
            <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
            <span className="text-xs" style={{ color: "var(--text-dim)" }}>{s.name}</span>
          </div>
        ))}
      </div>

      {noDeadlineCount > 0 && (
        <p className="text-xs mt-2" style={{ color: "var(--text-dim)" }}>
          {noDeadlineCount} tarefa{noDeadlineCount > 1 ? "s" : ""} sem prazo definido não {noDeadlineCount > 1 ? "aparecem" : "aparece"} nesta visão — confira na Tabela ou no Kanban.
        </p>
      )}
    </div>
  );
}

/* ── Create modal ────────────────────────────────────────────── */
function TaskCreateModal({ stageId, stages, currentUser, users, campaigns, onAdd, onClose }) {
  const stage = (stages || []).find(s => s.id === stageId);
  const stageFields = useRHStageFields("marketing_tasks");

  const assignableUsers = useMemo(
    () => getMentionableUsers(users, { domain: "marketing" }),
    [users]
  );

  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [priority,    setPriority]    = useState("media");
  const [deadline,    setDeadline]    = useState("");
  const [companyIds,  setCompanyIds]  = useState(
    currentUser?.companies?.length > 0 ? [currentUser.companies[0]] : []
  );
  const [campaignId,  setCampaignId]  = useState("");
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);
  const [customValues, setCustomValues] = useState({});

  const visibleFields = resolveVisibleFields(stageFields.getFields(stageId), customValues);

  // Guarda contra descarte acidental: fechar por clique-fora/ESC com o
  // formulário preenchido pede confirmação — mesmo padrão do CreateModal de
  // Compras (ComprasMarketingView.jsx).
  const initialSnapshotRef = useRef(null);
  const stateRef = useRef(null);
  stateRef.current = JSON.stringify({ title, description, priority, deadline, companyIds, campaignId, assigneeIds, customValues });
  if (initialSnapshotRef.current === null) initialSnapshotRef.current = stateRef.current;
  const guardedClose = useCallback(() => {
    if (stateRef.current !== initialSnapshotRef.current
        && !window.confirm("Descartar os dados preenchidos? As informações não salvas serão perdidas.")) return;
    onClose();
  }, [onClose]);
  useEscToClose(guardedClose);

  const toggleCompany = (id) =>
    setCompanyIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (companyIds.length === 0) { setError("Selecione ao menos uma empresa."); return; }
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
    setSaving(true); setError(null);
    try {
      await onAdd({
        title:          title.trim(),
        description:    description.trim() || null,
        priority,
        deadline:       localDateInputToISOString(deadline),
        stage:          stageId,
        stageChangedAt: new Date().toISOString(),
        companyIds,
        campaignId:     campaignId || null,
        assigneeIds,
        notes:          [],
        activities:     [{ type: "created", description: "Tarefa criada", at: new Date().toISOString() }],
        createdBy:      currentUser?.id || null,
        customFields:   customValues,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao criar tarefa.");
    } finally {
      setSaving(false);
    }
  };

  const focusBlue = e => { e.target.style.borderColor = "var(--accent)"; };
  const blurGray  = e => { e.target.style.borderColor = "#D1D5DB"; };
  const labelSt   = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, display: "block" };
  const inputSt   = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)" };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "var(--shadow-pop)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Nova Tarefa</div>
            {stage && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color, display: "inline-block" }} />
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{stage.name}</span>
              </div>
            )}
          </div>
          <button type="button" onClick={guardedClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 6, borderRadius: 8, display: "flex" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>* Título</label>
            <input autoFocus type="text" placeholder="Ex: Preparar posts da semana"
              value={title} onChange={e => setTitle(e.target.value)}
              className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
              style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>Descrição</label>
            <textarea placeholder="Detalhes da tarefa"
              value={description} onChange={e => setDescription(e.target.value)}
              rows={3} className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
              style={{ ...inputSt, resize: "vertical" }} onFocus={focusBlue} onBlur={blurGray} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelSt}>Prazo</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
            </div>
            <div>
              <label style={labelSt}>* Prioridade</label>
              <div style={{ display: "flex", gap: 6, paddingTop: 2 }}>
                {DELIVERABLE_PRIORITIES.map(p => (
                  <button key={p.id} type="button" onClick={() => setPriority(p.id)}
                    style={{ flex: 1, padding: "5px 0", borderRadius: 8, fontSize: 11, fontWeight: 700, border: `1px solid ${priority === p.id ? p.color : "var(--border)"}`, background: priority === p.id ? p.color + "18" : "var(--surface)", color: priority === p.id ? p.color : "var(--text-dim)", cursor: "pointer" }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>Responsáveis</label>
            <AssigneeMultiSelect
              value={assigneeIds}
              onChange={setAssigneeIds}
              options={assignableUsers}
              placeholder="Selecionar responsáveis…"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>* Empresa</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {COMPANY_IDS.map(id => {
                const co = COMPANIES[id]; const sel = companyIds.includes(id);
                return (
                  <button key={id} type="button" onClick={() => toggleCompany(id)}
                    style={{ padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, border: `1px solid ${sel ? co.primary : "var(--border)"}`, background: sel ? co.primary + "22" : "var(--surface)", color: sel ? co.primary : "var(--text-dim)", cursor: "pointer" }}>
                    {co.short}
                  </button>
                );
              })}
            </div>
          </div>

          {campaigns.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <label style={labelSt}>Campanha relacionada</label>
              <select value={campaignId} onChange={e => setCampaignId(e.target.value)}
                className="w-full text-sm rounded-xl border outline-none px-3 py-2"
                style={{ ...inputSt, color: campaignId ? "var(--text)" : "var(--text-dim)" }}>
                <option value="">Nenhuma (opcional)</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {visibleFields.length > 0 && (
            <div style={{ marginBottom: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                Campos desta etapa {stage?.name ? `· ${stage.name}` : ""}
              </div>
              <div className="flex flex-col gap-3">
                {visibleFields.map(f => (
                  <div key={f.id}>
                    <label style={labelSt}>
                      {f.effectiveRequired && <span style={{ color: "var(--danger)" }}>* </span>}
                      {f.label}
                    </label>
                    <RHStageFieldInput
                      field={f}
                      value={customValues[f.fieldKey]}
                      onChange={val => setCustomValues(prev => ({ ...prev, [f.fieldKey]: val }))}
                      users={users}
                      touched={Boolean(error)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 16 }}>{error}</div>
          )}

          <button type="submit" disabled={saving || !title.trim()}
            className="w-full font-semibold py-2.5 rounded-xl text-sm"
            style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: (saving || !title.trim()) ? 0.5 : 1, border: "none", cursor: (saving || !title.trim()) ? "default" : "pointer" }}>
            {saving ? "Criando…" : "Criar novo card"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Nova etapa (criação rápida a partir do fim do Kanban) ──────
   "Editar etapas" (lista completa) saiu do header — criar uma etapa agora
   é isso aqui, ou "Opções Avançadas" dentro de "Editar campos desta etapa"
   pra renomear/recolorir/excluir uma já existente. */
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
            <input autoFocus type="text" placeholder="Ex.: Aprovação Jurídica"
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

/* ── Main view ───────────────────────────────────────────────── */
export function MarketingTarefasView({ user, users = [], notifyMentions }) {
  const location = useLocation();
  const {
    tasks, loading, canWrite,
    createTask, updateTask, deleteTask, duplicateTask,
    changeStage, toggleStar,
  } = useMarketingTasks({ userId: user?.id, role: user?.role, roles: user?.roles });

  const { campaigns } = useMarketingCampaigns({ userId: user?.id, role: user?.role, roles: user?.roles });
  const campaignsById = useMemo(() => new Map(campaigns.map(c => [c.id, c])), [campaigns]);
  const stageFields = useRHStageFields("marketing_tasks");

  // trailingRef mede o texto de dica que vem depois do board, pra sobrar
  // espaço suficiente pra ele também caber (ver use-available-height.js).
  const trailingRef = useRef(null);
  const [boardRef, boardHeight] = useAvailableHeight(16, [], trailingRef);

  // Etapas vêm de rh_pipeline_stages (domain="marketing_tasks") — criar/
  // reordenar via "+ Nova etapa" e drag de coluna, excluir dentro de
  // "Editar campos desta etapa" (mesmo padrão de EntregasView.jsx).
  const { stages: dbStages, loading: loadingStages, addStage, reorderStages } = useRHPipelineStages("marketing_tasks");
  const kanbanStages = useMemo(
    () => dbStages.map(s => ({ id: s.stageKey, name: s.name, color: s.color, sla: s.slaDays, terminal: s.terminal })),
    [dbStages]
  );
  const [fieldEditorStage, setFieldEditorStage] = useState(null);
  const [addingStage, setAddingStage] = useState(false);
  const [draggedColumnKey, setDraggedColumnKey] = useState(null);

  const usersById = useUsersById(users);

  const [draggedItem,   setDraggedItem]   = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [stageError,    setStageError]    = useState(null);
  const [quickAddStage, setQuickAddStage] = useState(null);
  const [selected,      setSelected]      = useState(null);
  const [viewMode,      setViewMode]      = useState("kanban"); // "kanban" | "table" | "calendar" | "analytics"
  const { getCriteria: getSortCriteria, setCriteria: setSortCriteria } = useKanbanColumnSort("marketing-tarefas");
  const [expandedMobileStages, setExpandedMobileStages] = useState(() => {
    const s = new Set(["a_fazer"]);
    if (location.state?.filterStage) s.add(location.state.filterStage);
    return s;
  });
  const toggleMobileStage = (id) => setExpandedMobileStages(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  /* Filters */
  const [ownerFilter,    setOwnerFilter]    = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [companyFilter,  setCompanyFilter]  = useState([]);
  const [starredOnly,    setStarredOnly]    = useState(false);
  const [showFilters,    setShowFilters]    = useState(false);
  const [campaignFilter, setCampaignFilter] = useState("");
  const [deadlineFilter, setDeadlineFilter] = useState("");

  // roles[] cobre cargo adicional — user.role sozinho fica só de fallback.
  const userRoleList = user?.roles?.length ? user.roles : (user?.role ? [user.role] : []);
  const isManager = userRoleList.includes("admin") || userRoleList.includes("gerente_marketing");

  const toggleCompanyFilter = (id) =>
    setCompanyFilter(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const activeFilterCount = (ownerFilter ? 1 : 0) + (priorityFilter ? 1 : 0) + companyFilter.length + (starredOnly ? 1 : 0) + (campaignFilter ? 1 : 0) + (deadlineFilter ? 1 : 0);

  /* Filtered tasks */
  const filtered = useMemo(() => {
    let list = tasks;
    if (ownerFilter)              list = list.filter(t => (t.assigneeIds || []).includes(ownerFilter));
    if (priorityFilter)           list = list.filter(t => t.priority === priorityFilter);
    if (companyFilter.length > 0) list = list.filter(t => companyFilter.some(c => t.companyIds?.includes(c)));
    if (starredOnly)              list = list.filter(t => t.starred);
    if (campaignFilter)           list = list.filter(t => t.campaignId === campaignFilter);
    if (deadlineFilter === "overdue")     list = list.filter(isOverdueTask);
    if (deadlineFilter === "due_soon")    list = list.filter(isDueSoon);
    if (deadlineFilter === "no_deadline") list = list.filter(t => !t.deadline);
    return list;
  }, [tasks, ownerFilter, priorityFilter, companyFilter, starredOnly, campaignFilter, deadlineFilter]);

  // Ordenar cards dentro de cada coluna — cada etapa guarda seu próprio
  // critério (ver KanbanColumnSortMenu).
  const tasksByStage = useMemo(() => {
    const bucket = Object.create(null);
    for (const s of kanbanStages) bucket[s.id] = [];
    for (const t of filtered) {
      if (bucket[t.stage]) bucket[t.stage].push(t);
    }
    for (const s of kanbanStages) {
      bucket[s.id] = sortKanbanItems(bucket[s.id], getSortCriteria(s.id), {
        deadline: t => t.deadline,
        priority: t => t.priority,
        name: t => t.title,
        createdAt: t => t.createdAt,
      });
    }
    return bucket;
  }, [filtered, kanbanStages, getSortCriteria]);

  const analyticsStages = useMemo(
    () => kanbanStages.filter(s => !s.terminal).map(s => ({ key: s.id, name: s.name, color: s.color, slaDays: s.sla })),
    [kanbanStages]
  );

  const taskSpecificStats = useMemo(() => {
    const byPriority = { baixa: 0, media: 0, alta: 0 };
    for (const t of filtered) if (byPriority[t.priority] !== undefined) byPriority[t.priority]++;
    const overdue = filtered.filter(isOverdueTask).length;
    return [
      { label: "Prioridade baixa", value: String(byPriority.baixa) },
      { label: "Prioridade média", value: String(byPriority.media) },
      { label: "Prioridade alta", value: String(byPriority.alta), color: byPriority.alta > 0 ? "var(--danger)" : undefined },
      { label: "Atrasadas", value: String(overdue), color: overdue > 0 ? "var(--danger)" : undefined },
    ];
  }, [filtered]);

  const handleDragStart = useCallback((item) => setDraggedItem(item), []);
  const handleDragOver  = useCallback((e, stageId) => { e.preventDefault(); setDragOverStage(stageId); }, []);
  const handleDragLeave = useCallback((e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStage(null); }, []);
  const handleDragEnd   = useCallback(() => { setDraggedItem(null); setDragOverStage(null); }, []);

  // Enforcement real: bloqueia sair da etapa atual com campo obrigatório
  // (via rh_pipeline_stage_fields) vazio — vale tanto pro drag-and-drop
  // quanto pro "Mover para" do menu do card. Mesmo padrão de
  // EntregasView.attemptStageChange, sem a checagem de campos estáticos
  // (STAGE_FIELDS) porque Tarefas não tem formulário fixo por etapa.
  const attemptStageChange = useCallback(async (itemId, toStage) => {
    const item = tasks.find(t => t.id === itemId);
    if (!item) return false;
    const fields = stageFields.getFields(item.stage);
    const missing = getMissingRequiredFields(fields, item.customFields || {});
    if (missing.length > 0) {
      setStageError(`Não dá pra mover "${item.title}": preencha antes — ${missing.map(f => f.label).join(", ")}.`);
      return false;
    }
    setStageError(null);
    await changeStage(itemId, toStage);
    return true;
  }, [tasks, stageFields, changeStage]);

  const getItemCompleteness = useCallback((item) => {
    const fields = stageFields.getFields(item.stage);
    return getFieldCompleteness(fields, item.customFields || {});
  }, [stageFields]);

  const { viewedAt: itemViewedAt, markViewed: markItemViewed } = useRecordViews("marketing_tasks", user?.id);
  const getItemUnread = useCallback((item) => hasUnreadNotesComment(item, itemViewedAt, user?.id), [itemViewedAt, user?.id]);
  useEffect(() => { if (selected?.id) markItemViewed(selected.id); }, [selected?.id]);

  const handleDrop = useCallback(async (toStage) => {
    if (!draggedItem || !canWrite) return;
    if (draggedItem.stage !== toStage) await attemptStageChange(draggedItem.id, toStage);
    setDraggedItem(null); setDragOverStage(null);
  }, [draggedItem, canWrite, attemptStageChange]);

  // Canal de drag separado do drag de card (draggedColumnKey vs draggedItem)
  // — arrastar o cabeçalho da coluna reordena etapas.
  const handleColumnDragEnd = useCallback(() => setDraggedColumnKey(null), []);
  const handleColumnDrop = useCallback((targetStageKey) => {
    const draggedKey = draggedColumnKey;
    setDraggedColumnKey(null);
    if (!draggedKey || draggedKey === targetStageKey) return;
    const order = kanbanStages.map(s => s.id);
    const fromIdx = order.indexOf(draggedKey);
    const toIdx   = order.indexOf(targetStageKey);
    if (fromIdx === -1 || toIdx === -1) return;
    const nextOrder = [...order];
    nextOrder.splice(fromIdx, 1);
    nextOrder.splice(toIdx, 0, draggedKey);
    const dbIdByKey = new Map(dbStages.map(s => [s.stageKey, s.id]));
    const orderedIds = nextOrder.map(k => dbIdByKey.get(k)).filter(Boolean);
    if (orderedIds.length === nextOrder.length) reorderStages(orderedIds);
  }, [draggedColumnKey, kanbanStages, dbStages, reorderStages]);

  const handleQuickAdd = useCallback(async (item) => { await createTask(item); }, [createTask]);

  const handleUpdate = useCallback(async (id, patch) => {
    await updateTask(id, patch);
    setSelected(prev => prev?.id === id ? { ...prev, ...patch } : prev);
  }, [updateTask]);

  const handleDelete = useCallback(async (id) => { await deleteTask(id); }, [deleteTask]);

  const handleDuplicate = useCallback(async (id) => {
    const source = tasks.find(t => t.id === id);
    if (!source) return;
    await duplicateTask(source, kanbanStages[0]?.id);
  }, [tasks, duplicateTask, kanbanStages]);

  const syncSelected = useMemo(() => {
    if (!selected) return null;
    return tasks.find(t => t.id === selected.id) || selected;
  }, [tasks, selected]);

  // Ver src/utils/reopen-after-move.js — o drawer já se fecha sozinho ao
  // mover de etapa; isso só agenda a reabertura já na etapa nova.
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  const reopenTaskAfterMove = useCallback((id) => {
    reopenAfterMove(setSelected, () => tasksRef.current.find(t => t.id === id) || null);
  }, []);

  return (
    <>
    {stageError && (
      <AppToast variant="danger" position="top-right" icon={AlertCircle} onDismiss={() => setStageError(null)}>
        {stageError}
      </AppToast>
    )}
    <div>
      <KanbanBoardHeader className="mb-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ListTodo size={22} style={{ color: "var(--text)" }} />
            <h1 className="font-bold" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
              Tarefas
            </h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>Kanban de tarefas do dia a dia de Marketing</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div className="inline-flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }} role="tablist">
            <ViewToggleButton active={viewMode === "kanban"} onClick={() => setViewMode("kanban")} icon={LayoutGrid} label="Kanban" iconOnlyMobile />
            <ViewToggleButton active={viewMode === "table"} onClick={() => setViewMode("table")} icon={List} label="Tabela" iconOnlyMobile />
            <ViewToggleButton active={viewMode === "calendar"} onClick={() => setViewMode("calendar")} icon={CalendarDays} label="Calendário" iconOnlyMobile />
            <ViewToggleButton active={viewMode === "analytics"} onClick={() => setViewMode("analytics")} icon={TrendingUp} label="Análise" iconOnlyMobile />
          </div>
          {canWrite && viewMode === "kanban" && (
            <button
              onClick={() => setQuickAddStage(kanbanStages[0]?.id)}
              className="flex items-center gap-1.5 font-semibold"
              style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none", borderRadius: 10, padding: "6px 16px", fontSize: 13, cursor: "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.filter = "brightness(0.9)"; }}
              onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
              aria-label="Criar nova tarefa"
            >
              <Plus size={14} />
              Nova tarefa
            </button>
          )}
        </div>
      </div>

      {/* Filter toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => setShowFilters(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, border: `1px solid ${showFilters || activeFilterCount > 0 ? "var(--accent)" : "var(--border)"}`, background: showFilters || activeFilterCount > 0 ? "var(--surface-alt)" : "var(--surface)", color: showFilters || activeFilterCount > 0 ? "var(--accent)" : "var(--text-dim)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
          <Filter size={12} />
          Filtros
          {activeFilterCount > 0 && (
            <span style={{ background: "var(--accent)", color: "var(--on-accent)", borderRadius: 99, fontSize: 9, fontWeight: 700, padding: "1px 5px", marginLeft: 2 }}>{activeFilterCount}</span>
          )}
        </button>

        {showFilters && (
          <>
            {/* Owner filter (managers only) */}
            {isManager && (
              <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}
                style={{ padding: "6px 12px", borderRadius: 12, border: "1px solid var(--border)", fontSize: 12, color: ownerFilter ? "var(--text)" : "var(--text-dim)", background: "var(--surface)", outline: "none", cursor: "pointer" }}>
                <option value="">Todos responsáveis</option>
                {Array.from(usersById.values()).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}

            {/* Priority filter */}
            <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: 12, border: "1px solid var(--border)", fontSize: 12, color: priorityFilter ? "var(--text)" : "var(--text-dim)", background: "var(--surface)", outline: "none", cursor: "pointer" }}>
              <option value="">Todas prioridades</option>
              {DELIVERABLE_PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>

            {/* Campaign filter */}
            <select value={campaignFilter} onChange={e => setCampaignFilter(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: 12, border: "1px solid var(--border)", fontSize: 12, color: campaignFilter ? "var(--text)" : "var(--text-dim)", background: "var(--surface)", outline: "none", cursor: "pointer" }}>
              <option value="">Todas as campanhas</option>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {/* Deadline filter */}
            <select value={deadlineFilter} onChange={e => setDeadlineFilter(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: 12, border: "1px solid var(--border)", fontSize: 12, color: deadlineFilter ? "var(--text)" : "var(--text-dim)", background: "var(--surface)", outline: "none", cursor: "pointer" }}>
              <option value="">Todos os prazos</option>
              <option value="overdue">Vencidas</option>
              <option value="due_soon">Próximos 7 dias</option>
              <option value="no_deadline">Sem prazo</option>
            </select>

            {/* Company filter */}
            {COMPANY_IDS.map(id => {
              const co  = COMPANIES[id];
              const sel = companyFilter.includes(id);
              return (
                <button key={id} onClick={() => toggleCompanyFilter(id)}
                  style={{ padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, border: `1px solid ${sel ? co.primary : "var(--border)"}`, background: sel ? co.primary + "22" : "var(--surface)", color: sel ? co.primary : "var(--text-dim)", cursor: "pointer" }}>
                  {co.short}
                </button>
              );
            })}

            {/* Starred */}
            <button onClick={() => setStarredOnly(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 99, border: `1px solid ${starredOnly ? "#F59E0B" : "var(--border)"}`, background: starredOnly ? "var(--warning-bg)" : "var(--surface)", color: starredOnly ? "var(--warning)" : "var(--text-dim)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              <Star size={11} fill={starredOnly ? "#F59E0B" : "none"} />
              Favoritos
            </button>

            {activeFilterCount > 0 && (
              <button onClick={() => { setOwnerFilter(""); setPriorityFilter(""); setCompanyFilter([]); setStarredOnly(false); setCampaignFilter(""); setDeadlineFilter(""); }}
                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--danger)", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}>
                <X size={11} /> Limpar
              </button>
            )}
          </>
        )}
      </div>
      </KanbanBoardHeader>

      {canWrite && viewMode === "kanban" && (
        <KanbanFab label="Nova tarefa" flush onClick={() => setQuickAddStage(kanbanStages[0]?.id)} />
      )}

      {(loading || loadingStages) && <div className="text-sm text-center py-8" style={{ color: "var(--text-dim)" }}>Carregando tarefas…</div>}

      {!loading && !loadingStages && viewMode === "table" && (
        <TaskTableView
          tasks={filtered}
          stages={kanbanStages}
          usersById={usersById}
          campaignsById={campaignsById}
          onRowClick={setSelected}
        />
      )}

      {!loading && !loadingStages && viewMode === "calendar" && (
        <TaskCalendarView tasks={filtered} stages={kanbanStages} onSelect={setSelected} />
      )}

      {!loading && !loadingStages && viewMode === "analytics" && (
        <KanbanAnalyticsPanel
          stages={analyticsStages}
          records={filtered}
          getStageKey={t => t.stage}
          getStageEnteredAt={t => t.stageChangedAt}
          specificStats={taskSpecificStats}
          getOwnerIds={t => t.assigneeIds || []}
          usersById={usersById}
        />
      )}

      {!loading && !loadingStages && viewMode === "kanban" && (<>
        {/* Mobile kanban: vertical collapsible stages */}
        <div className="lg:hidden space-y-1.5 pb-24">
          {kanbanStages.map(stage => {
            const stageItems = tasksByStage[stage.id] || [];
            const expanded = expandedMobileStages.has(stage.id);
            return (
              <div key={stage.id} className="rounded-xl overflow-hidden border" style={{ borderColor: stage.color + "28" }}>
                <button
                  className="w-full flex items-center justify-between px-4 py-3.5 cursor-pointer"
                  style={{ background: stage.color + "12", border: "none" }}
                  onClick={() => toggleMobileStage(stage.id)}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: stage.color, flexShrink: 0 }} />
                    <span className="font-bold text-sm" style={{ color: stage.color }}>{stage.name}</span>
                    {stage.sla && <span className="text-xs" style={{ color: stage.color + "88" }}>SLA {stage.sla}d</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm" style={{ color: stage.color }}>{stageItems.length}</span>
                    <div onClick={e => e.stopPropagation()}>
                      <KanbanColumnSortMenu
                        criteria={getSortCriteria(stage.id)}
                        onChange={(v) => setSortCriteria(stage.id, v)}
                        options={["recent", "deadline", "priority", "alpha"]}
                        accentColor={stage.color}
                      />
                    </div>
                    {canWrite && (
                      <span
                        role="button"
                        title="Editar campos desta etapa"
                        onClick={e => { e.stopPropagation(); setFieldEditorStage(stage); }}
                        style={{ color: stage.color, display: "flex", cursor: "pointer" }}
                      >
                        <Settings2 size={13} />
                      </span>
                    )}
                    <div style={{ width: 26, height: 26, borderRadius: "50%", border: `2px solid ${stage.color}`, display: "flex", alignItems: "center", justifyContent: "center", color: stage.color, transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>
                      <ChevronDown size={13} />
                    </div>
                  </div>
                </button>
                {expanded && (
                  <div className="p-2.5 space-y-2" style={{ background: "var(--surface-alt)" }}>
                    {stageItems.length === 0 ? (
                      <div className="text-center py-4 text-xs" style={{ color: "var(--text-dim)" }}>Nenhuma tarefa nesta etapa</div>
                    ) : (
                      stageItems.map(item => (
                        <DeliverableKanbanCard
                          key={item.id}
                          item={item}
                          users={users}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          canWrite={canWrite}
                          onClick={setSelected}
                          stages={kanbanStages}
                          onMoveToStage={canWrite ? attemptStageChange : null}
                          onDeleteCard={canWrite ? handleDelete : null}
                          onDuplicateCard={canWrite ? handleDuplicate : null}
                          onToggleStar={canWrite ? toggleStar : null}
                          completeness={getItemCompleteness(item)}
                          unread={getItemUnread(item)}
                          campaignsById={campaignsById}
                        />
                      ))
                    )}
                    {canWrite && !stage.terminal && (
                      <button
                        onClick={() => setQuickAddStage(stage.id)}
                        className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                        style={{ background: stage.color + "18", color: stage.color, border: `1px dashed ${stage.color}44` }}
                      >
                        <Plus size={12} />
                        Nova tarefa
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {canWrite && (
            <button
              onClick={() => setAddingStage(true)}
              className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 border-dashed text-xs font-semibold"
              style={{ borderColor: "var(--border-strong)", color: "var(--text-dim)", background: "var(--surface)", cursor: "pointer" }}
            >
              <Plus size={13} />
              Nova etapa
            </button>
          )}
        </div>

        {/* Desktop kanban: horizontal scroll */}
        <div className="hidden lg:block">
          <KanbanBoardScrollArea scrollRef={boardRef} height={boardHeight}>
            <div className="flex gap-2 h-full" style={{ minWidth: `${kanbanStages.length * 280}px` }}>
              {kanbanStages.map(stage => {
                const stageItems = tasksByStage[stage.id] || [];
                const isOver     = dragOverStage === stage.id;

                return (
                  <div key={stage.id}
                    onDragOver={e => handleDragOver(e, stage.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={() => handleDrop(stage.id)}
                    className="flex flex-col rounded-lg transition-all duration-150"
                    style={{ width: 272, minWidth: 272, overflow: "hidden", border: "1px solid var(--border)", background: isOver ? stage.color + "14" : "var(--surface-alt)", boxShadow: isOver ? `0 0 0 2px ${stage.color}40` : "none", height: "100%", flexShrink: 0 }}>
                    {/* Arrastável pra reordenar etapas — canal de drag
                        separado do card (draggedColumnKey vs draggedItem),
                        stopPropagation nos handlers pra não vazar pro drag
                        de card do <div> pai da coluna. */}
                    <div
                      draggable={canWrite}
                      onDragStart={() => canWrite && setDraggedColumnKey(stage.id)}
                      onDragEnd={handleColumnDragEnd}
                      onDragOver={e => { if (draggedColumnKey) { e.preventDefault(); e.stopPropagation(); } }}
                      onDrop={e => { if (draggedColumnKey && draggedColumnKey !== stage.id) { e.stopPropagation(); handleColumnDrop(stage.id); } }}
                      style={{ cursor: canWrite ? "grab" : "default" }}
                    >
                      <KanbanColumnHeader
                        color={stage.color}
                        name={stage.name}
                        count={stageItems.length}
                        bandHeight={4}
                        letterSpacing="normal"
                        nameColor={stage.color}
                        nameFontSize={14}
                        nameFontWeight={700}
                        uppercase={false}
                        countFontSize={12}
                        actions={<>
                          <KanbanColumnSortMenu
                            criteria={getSortCriteria(stage.id)}
                            onChange={(v) => setSortCriteria(stage.id, v)}
                            options={["recent", "deadline", "priority", "alpha"]}
                          />
                          {canWrite && (
                            <button onClick={() => setFieldEditorStage(stage)}
                              className="flex items-center justify-center rounded-md transition-colors"
                              style={{ width: 28, height: 28, color: "var(--text-dim)", background: "transparent", border: "1px solid transparent", flexShrink: 0 }}
                              onMouseEnter={e => { e.currentTarget.style.background = "#F1F3F5"; e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
                              title="Editar campos desta etapa">
                              <Settings2 size={13} />
                            </button>
                          )}
                          {canWrite && !stage.terminal && (
                            <button onClick={() => setQuickAddStage(stage.id)}
                              className="flex items-center justify-center rounded-md transition-colors"
                              style={{ width: 28, height: 28, color: "var(--text-dim)", background: "transparent", border: "1px solid transparent", flexShrink: 0 }}
                              onMouseEnter={e => { e.currentTarget.style.background = "#F1F3F5"; e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
                              title="Adicionar tarefa">
                              <Plus size={14} />
                            </button>
                          )}
                        </>}
                      >
                        {stage.sla && <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>SLA {stage.sla}d</div>}
                      </KanbanColumnHeader>
                    </div>

                    <div className="px-2 pt-2 pb-1 flex-1 overflow-y-auto" style={{ minHeight: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                      {stageItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 mx-1 rounded-lg border-2 border-dashed text-xs gap-1"
                          style={{ borderColor: isOver ? stage.color + "40" : "var(--border)", color: "var(--text-dim)" }}>
                          {isOver ? (
                            <>
                              <Plus size={16} style={{ opacity: 0.5 }} />
                              <span>Soltar aqui</span>
                            </>
                          ) : (
                            <>
                              <span style={{ opacity: 0.5 }}>Nenhuma tarefa nesta etapa</span>
                              {!stage.terminal && canWrite && (
                                <span style={{ opacity: 0.4, fontSize: 10 }}>Arraste um card aqui ou crie um novo</span>
                              )}
                            </>
                          )}
                        </div>
                      ) : (
                        stageItems.map(item => (
                          <DeliverableKanbanCard
                            key={item.id}
                            item={item}
                            users={users}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            canWrite={canWrite}
                            onClick={setSelected}
                            stages={kanbanStages}
                            onMoveToStage={canWrite ? attemptStageChange : null}
                            onDeleteCard={canWrite ? handleDelete : null}
                            onDuplicateCard={canWrite ? handleDuplicate : null}
                            onToggleStar={canWrite ? toggleStar : null}
                            completeness={getItemCompleteness(item)}
                            unread={getItemUnread(item)}
                            campaignsById={campaignsById}
                            showMoveOptions={false}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
              {canWrite && (
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
      </>)}

      {!loading && !loadingStages && viewMode === "kanban" && (
        <div ref={trailingRef}>
          <p className="text-xs text-center mt-3" style={{ color: "var(--text-dim)" }}>
            Arraste para mover · "+" para criar · Clique para ver detalhes
          </p>
        </div>
      )}
    </div>

    {quickAddStage && (
      <TaskCreateModal
        stageId={quickAddStage}
        stages={kanbanStages}
        currentUser={user}
        users={users}
        campaigns={campaigns}
        onAdd={handleQuickAdd}
        onClose={() => setQuickAddStage(null)}
      />
    )}

    {syncSelected && (
      <MarketingTaskDetailDrawer
        item={syncSelected}
        stages={kanbanStages}
        campaigns={campaigns}
        onClose={() => setSelected(null)}
        onStageMoved={reopenTaskAfterMove}
        onUpdate={handleUpdate}
        onMoveToStage={attemptStageChange}
        onDelete={handleDelete}
        users={Array.from(usersById.values())}
        canWrite={canWrite}
        currentUser={user}
        notifyMentions={notifyMentions}
      />
    )}

    {/* Editor de campos customizados por etapa (rh_pipeline_stage_fields) —
        "Opções Avançadas" dentro dele também cobre renomear/recolorir/SLA/
        excluir a etapa (records+stageField habilitam a exclusão guardada
        por registro ativo). Substitui o antigo "Editar etapas" separado. */}
    {canWrite && (
      <RHStageFieldsPanel
        open={!!fieldEditorStage}
        onClose={() => setFieldEditorStage(null)}
        domain="marketing_tasks"
        stageKey={fieldEditorStage?.id}
        stageName={fieldEditorStage?.name}
        records={tasks}
        stageField="stage"
      />
    )}

    {addingStage && (
      <NewStageModal
        existingKeys={dbStages.map(s => s.stageKey)}
        nextOrderIdx={dbStages.length}
        onAdd={addStage}
        onClose={() => setAddingStage(false)}
      />
    )}

    </>
  );
}
