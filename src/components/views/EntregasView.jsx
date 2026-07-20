import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Plus, X, Package, TrendingUp, ChevronDown, Star, Download,
  Filter, CalendarDays, LayoutGrid, List, Pencil, Settings2, AlertCircle,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { DeliverableKanbanCard } from "../campaign/DeliverableKanbanCard";
import { useMarketingDeliverables } from "../../hooks/use-marketing-deliverables";
import { reopenAfterMove } from "../../utils/reopen-after-move";
import { useMarketingCampaigns }    from "../../hooks/use-marketing-campaigns";
import { useRHStageFields } from "../../hooks/use-rh-stage-fields";
import { useRHPipelineStages } from "../../hooks/use-rh-pipeline-stages";
import { RHStageEditorModal } from "../rh-pipeline/RHStageEditorModal";
import { RHStageFieldEditorModal } from "../rh-pipeline/RHStageFieldEditorModal";
import {
  DELIVERABLE_STAGES, DELIVERABLE_DEPARTMENTS, DELIVERABLE_PRIORITIES,
} from "../../constants/marketing-pipelines";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import { formatDateBR, localDateInputToISOString, parseDateInput } from "../../utils/date";
import { useUsersById }  from "../../hooks/use-users-by-id";
import { resolveVisibleFields, getMissingRequiredFields, getFieldCompleteness } from "../../utils/field-conditions";
import { getInvalidFields } from "../../utils/field-validation";
import { RHStageFieldInput } from "../rh-pipeline/RHStageFieldInput";
import { DeliverableDetailDrawer, STAGE_FIELDS } from "../campaign/DeliverableDetailDrawer";
import { AvatarStack } from "../shared/AvatarStack";

const PRIORITY_LABELS = { baixa: "Baixa", media: "Média", alta: "Alta" };
const PRIORITY_COLORS = { baixa: "#16A34A", media: "#D97706", alta: "#DC2626" };

// FASE 5: mais de um responsável por entrega — resolve assignee_ids (com
// fallback pro assignee escalar em entregas legadas), mesmo padrão de
// getLeadOwnerIds em CRMView.jsx / getCampaignOwnerIds em MarketingView.jsx.
function getDeliverableAssigneeIds(d) {
  return Array.isArray(d.assigneeIds) && d.assigneeIds.length ? d.assigneeIds : (d.assignee ? [d.assignee] : []);
}

// Mesmo critério do card "Presas em revisão" do Painel de Marketing
// (MarketingDashboardView.jsx) — usado pra manter os dois em sincronia
// quando o card leva pra cá com o filtro pré-aplicado.
function isStuckInRevisao(d) {
  return d.stage === "revisao" && d.stageChangedAt &&
    (Date.now() - new Date(d.stageChangedAt).getTime()) / 86400000 > 3;
}

function isStaticValueEmpty(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

// STAGE_FIELDS (DeliverableDetailDrawer.jsx) é um segundo formulário fixo
// por etapa, além dos campos dinâmicos de useRHStageFields — a troca de
// etapa só validava os dinâmicos, então os campos "obrigatórios" desse
// formulário fixo nunca travavam nada (achado da auditoria completa).
function getMissingStaticFields(stage, stageData) {
  const fields = STAGE_FIELDS[stage] || [];
  const dataForStage = stageData?.[stage] || {};
  return fields.filter(f => f.required && isStaticValueEmpty(dataForStage[f.key]));
}

/* ── CSV export ─────────────────────────────────────────────── */
function exportCSV(deliverables, stages) {
  const headers = ["Título","Solicitante","Departamento","Prioridade","Prazo","Etapa","Empresas","Criado em"];
  const rows = deliverables.map(d => [
    d.title,
    d.requesterName || "",
    d.department    || "",
    PRIORITY_LABELS[d.priority] || d.priority || "",
    d.deadline ? formatDateBR(d.deadline) : "",
    (stages || DELIVERABLE_STAGES).find(s => s.id === d.stage)?.name || d.stage,
    (d.companyIds || []).map(id => COMPANIES[id]?.short || id).join(";"),
    d.createdAt ? new Date(d.createdAt).toLocaleDateString("pt-BR") : "",
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "entregas.csv"; a.click();
  URL.revokeObjectURL(url);
}

/* ── Create modal ────────────────────────────────────────────── */
function DeliverableCreateModal({ stageId, currentUser, users, campaigns, onAdd, onClose }) {
  const stage = DELIVERABLE_STAGES.find(s => s.id === stageId);
  const stageFields = useRHStageFields("marketing_deliverables");

  const [title,         setTitle]         = useState("");
  const [requesterName, setRequester]     = useState("");
  const [department,    setDepartment]    = useState("");
  const [description,   setDescription]  = useState("");
  const [priority,      setPriority]      = useState("media");
  const [deadline,      setDeadline]      = useState("");
  const [companyIds,    setCompanyIds]    = useState(
    currentUser?.companies?.length > 0 ? [currentUser.companies[0]] : []
  );
  const [campaignId,    setCampaignId]    = useState("");
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState(null);
  const [customValues,  setCustomValues]  = useState({});

  const visibleFields = resolveVisibleFields(stageFields.getFields(stageId), customValues);

  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

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
        requesterName:  requesterName.trim() || null,
        department:     department || null,
        description:    description.trim() || null,
        priority,
        deadline:       localDateInputToISOString(deadline),
        stage:          stageId,
        stageChangedAt: new Date().toISOString(),
        companyIds,
        campaignId:     campaignId || null,
        notes:          [],
        activities:     [{ type: "created", description: "Entregável criado", at: new Date().toISOString() }],
        createdBy:      currentUser?.id || null,
        customFields:   customValues,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao criar entrega.");
    } finally {
      setSaving(false);
    }
  };

  const focusBlue = e => { e.target.style.borderColor = "var(--accent)"; };
  const blurGray  = e => { e.target.style.borderColor = "#D1D5DB"; };
  const labelSt   = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, display: "block" };
  const inputSt   = { borderColor: "#D1D5DB", color: "var(--text)", background: "var(--surface)" };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "var(--shadow-pop)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Novo Entregável</div>
            {stage && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color, display: "inline-block" }} />
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{stage.name}</span>
              </div>
            )}
          </div>
          <button type="button" onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 6, borderRadius: 8, display: "flex" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>* Nome do Solicitante</label>
            <input autoFocus type="text" placeholder="Nome de quem está solicitando"
              value={requesterName} onChange={e => setRequester(e.target.value)}
              className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
              style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>* Departamento</label>
            <select value={department} onChange={e => setDepartment(e.target.value)}
              className="w-full text-sm rounded-xl border outline-none px-3 py-2"
              style={{ ...inputSt, color: department ? "var(--text)" : "var(--text-dim)" }}>
              <option value="">Escolha uma opção</option>
              {DELIVERABLE_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>Descrição do Entregável</label>
            <textarea placeholder="Detalhes do entregável solicitado"
              value={description} onChange={e => setDescription(e.target.value)}
              rows={3} className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
              style={{ ...inputSt, resize: "vertical" }} onFocus={focusBlue} onBlur={blurGray} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>* Título resumido</label>
            <input type="text" placeholder="Ex: Banner para Instagram"
              value={title} onChange={e => setTitle(e.target.value)}
              className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
              style={inputSt} onFocus={focusBlue} onBlur={blurGray} />
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
            <label style={labelSt}>Empresa</label>
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
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 16 }}>{error}</div>
          )}

          <button type="submit" disabled={saving || !title.trim()}
            className="w-full font-semibold py-2.5 rounded-xl text-sm"
            style={{ background: "var(--accent)", color: "#FFF", opacity: (saving || !title.trim()) ? 0.5 : 1, border: "none", cursor: (saving || !title.trim()) ? "default" : "pointer" }}>
            {saving ? "Criando…" : "Criar novo card"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Analytics panel ─────────────────────────────────────────── */
function AnalyticsPanel({ deliverables, stages }) {
  const [open, setOpen] = useState(false);

  // Etapas vivas (DB, editáveis) quando disponíveis — DELIVERABLE_STAGES é só
  // o fallback estático de antes da customização por etapa existir. Sem
  // isso, renomear/criar/excluir uma etapa via "Editar etapas" deixava a
  // Análise mostrando o conjunto antigo de etapas, com dado errado.
  const stageStats = useMemo(() => (stages || DELIVERABLE_STAGES).map(stage => {
    const items   = deliverables.filter(d => d.stage === stage.id);
    const overdue = items.filter(d => d.deadline && new Date(d.deadline) < new Date()).length;
    const daysArr = items.filter(d => d.stageChangedAt).map(d => Math.floor((Date.now() - new Date(d.stageChangedAt).getTime()) / 86400000));
    const avgDays = daysArr.length > 0 ? Math.round(daysArr.reduce((a, b) => a + b, 0) / daysArr.length) : null;
    return { stage, count: items.length, overdue, avgDays };
  }), [deliverables, stages]);

  const maxCount = Math.max(...stageStats.map(s => s.count), 1);

  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs font-medium transition-colors duration-150"
        style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}
        onMouseEnter={e => { e.currentTarget.style.color = "var(--text)"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}>
        <TrendingUp size={13} strokeWidth={2} />
        <span>Análise das entregas</span>
        <ChevronDown size={13} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
      </button>
      {open && (
        <div className="rounded-2xl border mt-3 p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="text-xs font-semibold mb-4" style={{ color: "var(--text-dim)" }}>Distribuição por etapa</div>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            {stageStats.map(({ stage, count, overdue, avgDays }) => (
              <div key={stage.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "var(--text)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color, display: "inline-block", flexShrink: 0 }} />
                    {stage.name}
                  </div>
                  <div className="text-xs" style={{ color: overdue > 0 ? "var(--danger)" : "var(--text-dim)" }}>
                    {count}{overdue > 0 ? ` · ${overdue} atrasada${overdue !== 1 ? "s" : ""}` : ""}
                  </div>
                </div>
                <div style={{ height: 6, background: "#F1F3F5", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ height: "100%", width: `${(count / maxCount) * 100}%`, background: stage.color, borderRadius: 3, transition: "width 0.4s ease" }} />
                </div>
                <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
                  {avgDays !== null ? `Média ${avgDays}d · SLA: ${stage.sla ?? "—"}d` : count > 0 ? "Sem tempo registrado" : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── KPI card ─────────────────────────────────────────────────── */
function KpiCard({ label, value, color }) {
  return (
    <div className="rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)", padding: "12px 16px", boxShadow: "var(--shadow-card)" }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || "var(--text)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

/* ── View toggle button ──────────────────────────────────────── */
function ViewToggleButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "6px 12px", fontSize: 12, fontWeight: 500,
        background: active ? "var(--accent)" : "var(--surface)",
        color:      active ? "#FFFFFF"  : "var(--text-dim)",
        border: "none",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

/* ── Tabela ───────────────────────────────────────────────────── */
function DeliverableTableView({ deliverables, stages, usersById, campaignsById, onRowClick }) {
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
            {["Protocolo", "Título", "Campanha", "Prioridade", "Etapa", "Responsável", "Prazo"].map(h => (
              <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {deliverables.length === 0 && (
            <tr><td colSpan={7} className="text-center py-10 text-sm" style={{ color: "var(--text-dim)" }}>Nenhuma entrega encontrada.</td></tr>
          )}
          {deliverables.map(item => {
            const stage    = (stages || DELIVERABLE_STAGES).find(s => s.id === item.stage);
            const color    = stage?.color || "var(--text-dim)";
            const priColor = PRIORITY_COLORS[item.priority] || null;
            const resolvedOwners = getDeliverableAssigneeIds(item).map(id => usersById.get(id)).filter(Boolean);
            const campaign = item.campaignId ? campaignsById.get(item.campaignId) : null;
            const isOverdue = item.deadline && new Date(item.deadline) < new Date();
            return (
              <tr key={item.id} onClick={() => onRowClick(item)} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                <td className="px-4 py-3 text-xs font-mono font-bold" style={{ color: "var(--accent)" }}>{item.requestNumber || "—"}</td>
                <td className="px-4 py-3 text-sm font-medium" style={{ color: "var(--text)", maxWidth: 220 }}>
                  <div className="flex items-center gap-1.5">
                    <div className="truncate">{item.title}</div>
                    {item.starred && <Star size={12} style={{ color: "#F59E0B", fill: "#F59E0B", flexShrink: 0 }} />}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)", maxWidth: 140 }}>
                  {campaign ? <span className="truncate block" title={campaign.name}>{campaign.name}</span> : "—"}
                </td>
                <td className="px-4 py-3">
                  {priColor ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: priColor + "18", color: priColor, border: `1px solid ${priColor}40` }}>
                      {PRIORITY_LABELS[item.priority] || item.priority}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: color + "18", color, border: `1px solid ${color}40` }}>
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

/* ── Calendário ───────────────────────────────────────────────── */

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

// Entregas têm um prazo de um dia só (sem intervalo), diferente do
// CampaignCalendar (campanhas com launchDate/endDate) — por isso um grid
// próprio e mais simples, em vez de reaproveitar aquele componente.
function DeliverableCalendarView({ deliverables, stages, onSelect }) {
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
    deliverables.forEach(item => {
      if (!item.deadline) { noDeadline++; return; }
      const key = calDayKey(calStartOfDay(parseDateInput(item.deadline)));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return { byDay: map, noDeadlineCount: noDeadline };
  }, [deliverables]);

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
                      style={{ width: 24, height: 24, borderRadius: "50%", background: isToday ? "var(--accent)" : "transparent", color: isToday ? "#FFF" : isCurrentMonth ? "var(--text)" : "var(--text-dim)", fontWeight: isToday ? 700 : 600 }}>
                      {day.getDate()}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {visible.map(item => {
                      const stage = (stages || DELIVERABLE_STAGES).find(s => s.id === item.stage);
                      const color = stage?.color || "var(--text-dim)";
                      return (
                        <button
                          key={item.id}
                          onClick={() => onSelect(item)}
                          title={item.title}
                          className="text-left truncate text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: color + "18", color, border: `1px solid ${color}40`, cursor: "pointer" }}
                        >
                          {item.requestNumber ? `${item.requestNumber} ` : ""}{item.title}
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
        {(stages || DELIVERABLE_STAGES).map(s => (
          <div key={s.id} className="flex items-center gap-1.5">
            <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
            <span className="text-xs" style={{ color: "var(--text-dim)" }}>{s.name}</span>
          </div>
        ))}
      </div>

      {noDeadlineCount > 0 && (
        <p className="text-xs mt-2" style={{ color: "var(--text-dim)" }}>
          {noDeadlineCount} entrega{noDeadlineCount > 1 ? "s" : ""} sem prazo definido não {noDeadlineCount > 1 ? "aparecem" : "aparece"} nesta visão — confira na Tabela ou no Kanban.
        </p>
      )}
    </div>
  );
}

/* ── Main view ───────────────────────────────────────────────── */
export function EntregasView({ user, users = [], notifyMentions }) {
  const location = useLocation();
  const {
    deliverables, loading, canWrite,
    createDeliverable, updateDeliverable, deleteDeliverable,
    changeStage, toggleStar,
  } = useMarketingDeliverables({ userId: user?.id, role: user?.role, roles: user?.roles });

  const { campaigns } = useMarketingCampaigns({ userId: user?.id, role: user?.role, roles: user?.roles });
  const campaignsById = useMemo(() => new Map(campaigns.map(c => [c.id, c])), [campaigns]);
  const stageFields = useRHStageFields("marketing_deliverables");

  // Etapas vêm de rh_pipeline_stages (domain="marketing_deliverables"),
  // editáveis via RHStageEditorModal — mesmo padrão do RHOnboardingView.
  // Normalizamos pro shape que o resto do arquivo (colunas, badges,
  // DeliverableKanbanCard) já espera: { id, name, color, sla, terminal }.
  const { stages: dbStages, loading: loadingStages } = useRHPipelineStages("marketing_deliverables");
  const kanbanStages = useMemo(
    () => dbStages.map(s => ({ id: s.stageKey, name: s.name, color: s.color, sla: s.slaDays, terminal: s.terminal })),
    [dbStages]
  );
  const [stageEditorOpen, setStageEditorOpen] = useState(false);
  const [fieldEditorStage, setFieldEditorStage] = useState(null);

  const usersById = useUsersById(users);

  const [draggedItem,    setDraggedItem]    = useState(null);
  const [dragOverStage,  setDragOverStage]  = useState(null);
  const [stageError,     setStageError]     = useState(null);
  const [quickAddStage,  setQuickAddStage]  = useState(null);
  const [selected,       setSelected]       = useState(null);
  const [viewMode,       setViewMode]       = useState("kanban"); // "kanban" | "table" | "calendar"
  const [expandedMobileStages, setExpandedMobileStages] = useState(() => {
    const s = new Set(["solicitacao"]);
    if (location.state?.filterStage) s.add(location.state.filterStage);
    return s;
  });
  const toggleMobileStage = (id) => setExpandedMobileStages(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  /* Filters */
  const [ownerFilter,    setOwnerFilter]    = useState("");
  const [companyFilter,  setCompanyFilter]  = useState([]);
  const [starredOnly,    setStarredOnly]    = useState(false);
  const [showFilters,    setShowFilters]    = useState(false);
  // Deep-link do card "Presas em revisão" no Painel de Marketing (achado
  // da auditoria de fricção de 18/07) — chega via navigate(..., {state}).
  const [stuckOnly,      setStuckOnly]      = useState(Boolean(location.state?.stuckOnly));

  // roles[] cobre cargo adicional — user.role sozinho fica só de fallback.
  // Achado da 2ª auditoria (esta view ficou de fora do fix a28bfb5).
  const userRoleList = user?.roles?.length ? user.roles : (user?.role ? [user.role] : []);
  const isManager = userRoleList.includes("admin") || userRoleList.includes("gerente_marketing");

  const toggleCompanyFilter = (id) =>
    setCompanyFilter(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const activeFilterCount = (ownerFilter ? 1 : 0) + companyFilter.length + (starredOnly ? 1 : 0) + (stuckOnly ? 1 : 0);

  /* Filtered deliverables */
  const filtered = useMemo(() => {
    let list = deliverables;
    if (stuckOnly)               list = list.filter(isStuckInRevisao);
    if (ownerFilter)             list = list.filter(d => getDeliverableAssigneeIds(d).includes(ownerFilter));
    if (companyFilter.length > 0) list = list.filter(d => companyFilter.some(c => d.companyIds?.includes(c)));
    if (starredOnly)             list = list.filter(d => d.starred);
    return list;
  }, [deliverables, ownerFilter, companyFilter, starredOnly, stuckOnly]);

  const handleDragStart = useCallback((item) => setDraggedItem(item), []);
  const handleDragOver  = useCallback((e, stageId) => { e.preventDefault(); setDragOverStage(stageId); }, []);
  const handleDragLeave = useCallback((e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStage(null); }, []);
  const handleDragEnd   = useCallback(() => { setDraggedItem(null); setDragOverStage(null); }, []);

  // Enforcement real: bloqueia sair da etapa atual com campo obrigatório
  // (estático ou condicional) vazio — vale tanto pro drag-and-drop quanto
  // pro "Mover para" do menu do card. Antes disso "required" era só o
  // asterisco visual, confirmado ao vivo que não travava nada. Mesmo padrão
  // do attemptStageChange do Pipeline de CRM (CRMView.jsx), mas lendo os
  // campos via useRHStageFields("marketing_deliverables") — Entregas não usa
  // a tabela antiga pipeline_stage_fields.
  const attemptStageChange = useCallback(async (itemId, toStage) => {
    const item = deliverables.find(d => d.id === itemId);
    if (!item) return false;
    const fields = stageFields.getFields(item.stage);
    const missing = getMissingRequiredFields(fields, item.customFields || {});
    const missingStatic = getMissingStaticFields(item.stage, item.stageData);
    if (missing.length > 0 || missingStatic.length > 0) {
      const labels = [...missing.map(f => f.label), ...missingStatic.map(f => f.label)];
      setStageError(`Não dá pra mover "${item.title}": preencha antes — ${labels.join(", ")}.`);
      return false;
    }
    setStageError(null);
    await changeStage(itemId, toStage);
    return true;
  }, [deliverables, stageFields, changeStage]);

  // Badge "X/Y campos obrigatórios" no card (auditoria 10.3).
  const getItemCompleteness = useCallback((item) => {
    const fields = stageFields.getFields(item.stage);
    return getFieldCompleteness(fields, item.customFields || {});
  }, [stageFields]);

  const handleDrop = useCallback(async (toStage) => {
    if (!draggedItem || !canWrite) return;
    if (draggedItem.stage !== toStage) await attemptStageChange(draggedItem.id, toStage);
    setDraggedItem(null); setDragOverStage(null);
  }, [draggedItem, canWrite, attemptStageChange]);

  const handleQuickAdd = useCallback(async (item) => { await createDeliverable(item); }, [createDeliverable]);

  const handleUpdate = useCallback(async (id, patch) => {
    await updateDeliverable(id, patch);
    setSelected(prev => prev?.id === id ? { ...prev, ...patch } : prev);
  }, [updateDeliverable]);

  const handleDelete = useCallback(async (id) => { await deleteDeliverable(id); }, [deleteDeliverable]);

  const syncSelected = useMemo(() => {
    if (!selected) return null;
    return deliverables.find(d => d.id === selected.id) || selected;
  }, [deliverables, selected]);

  // Ver src/utils/reopen-after-move.js — o drawer já se fecha sozinho ao
  // mover de etapa (handleMoveStage); isso só agenda a reabertura já na
  // etapa nova, em vez de deixar fechado.
  const deliverablesRef = useRef(deliverables);
  useEffect(() => { deliverablesRef.current = deliverables; }, [deliverables]);
  const reopenDeliverableAfterMove = useCallback((id) => {
    reopenAfterMove(setSelected, () => deliverablesRef.current.find(d => d.id === id) || null);
  }, []);

  const kpis = useMemo(() => ({
    total:       deliverables.length,
    solicitacao: deliverables.filter(d => d.stage === "solicitacao").length,
    em_producao: deliverables.filter(d => d.stage === "em_producao").length,
    entregue:    deliverables.filter(d => d.stage === "entregue").length,
  }), [deliverables]);

  return (
    <>
    {stageError && (
      <div
        className="fixed z-50 flex items-start gap-2 p-3 rounded-xl text-sm shadow-lg"
        style={{ top: 16, right: 16, maxWidth: 380, background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FCA5A5" }}
      >
        <AlertCircle size={15} className="shrink-0 mt-0.5" />
        <span className="flex-1">{stageError}</span>
        <button onClick={() => setStageError(null)} className="shrink-0" style={{ color: "#B91C1C" }}>
          <X size={14} />
        </button>
      </div>
    )}
    <div>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Package size={22} style={{ color: "var(--text)" }} />
            <h1 className="font-bold" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
              Entregas
            </h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>Kanban de entregas de campanha</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* View toggle */}
          <div className="inline-flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }} role="tablist">
            <ViewToggleButton active={viewMode === "kanban"}   onClick={() => setViewMode("kanban")}   icon={LayoutGrid}   label="Kanban"     />
            <ViewToggleButton active={viewMode === "table"}    onClick={() => setViewMode("table")}    icon={List}         label="Tabela"     />
            <ViewToggleButton active={viewMode === "calendar"} onClick={() => setViewMode("calendar")} icon={CalendarDays} label="Calendário" />
          </div>
          {/* Editar etapas */}
          {canWrite && (
            <button
              onClick={() => setStageEditorOpen(true)}
              title="Editar etapas do Kanban"
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, fontWeight: 500, color: "var(--text-dim)", cursor: "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--text)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text-dim)"; }}
            >
              <Pencil size={13} />
              Editar etapas
            </button>
          )}
          {/* Export CSV */}
          <button
            onClick={() => exportCSV(filtered, kanbanStages)}
            title="Exportar CSV"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, fontWeight: 500, color: "var(--text-dim)", cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text-dim)"; }}
          >
            <Download size={13} />
            Exportar CSV
          </button>
          {/* Nova entrega */}
          {canWrite && viewMode === "kanban" && (
            <button
              onClick={() => setQuickAddStage("solicitacao")}
              className="flex items-center gap-1.5 font-semibold"
              style={{ background: "var(--accent)", color: "#FFFFFF", border: "none", borderRadius: 10, padding: "6px 16px", fontSize: 13, cursor: "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.filter = "brightness(0.9)"; }}
              onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
              aria-label="Criar nova entrega"
            >
              <Plus size={14} />
              Nova entrega
            </button>
          )}
        </div>
      </div>

      {/* Filter toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => setShowFilters(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, border: `1px solid ${showFilters || activeFilterCount > 0 ? "var(--accent)" : "var(--border)"}`, background: showFilters || activeFilterCount > 0 ? "var(--surface-alt)" : "var(--surface)", color: showFilters || activeFilterCount > 0 ? "var(--accent)" : "var(--text-dim)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
          <Filter size={12} />
          Filtros
          {activeFilterCount > 0 && (
            <span style={{ background: "var(--accent)", color: "#FFF", borderRadius: 99, fontSize: 9, fontWeight: 700, padding: "1px 5px", marginLeft: 2 }}>{activeFilterCount}</span>
          )}
        </button>

        {/* Chip do deep-link "Presas em revisão" (Painel de Marketing) —
            fica visível mesmo com o painel de filtros fechado. */}
        {stuckOnly && (
          <span style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 99, border: "1px solid #FED7AA", background: "#FFF7ED", color: "#D97706", fontSize: 11, fontWeight: 600 }}>
            Presas em revisão · +3 dias
            <button onClick={() => setStuckOnly(false)} style={{ display: "flex", color: "#D97706", background: "none", border: "none", cursor: "pointer", padding: 0 }} title="Limpar filtro">
              <X size={11} />
            </button>
          </span>
        )}

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
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 99, border: `1px solid ${starredOnly ? "#F59E0B" : "var(--border)"}`, background: starredOnly ? "#FFFBEB" : "var(--surface)", color: starredOnly ? "var(--warning)" : "var(--text-dim)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              <Star size={11} fill={starredOnly ? "#F59E0B" : "none"} />
              Favoritos
            </button>

            {activeFilterCount > 0 && (
              <button onClick={() => { setOwnerFilter(""); setCompanyFilter([]); setStarredOnly(false); setStuckOnly(false); }}
                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--danger)", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}>
                <X size={11} /> Limpar
              </button>
            )}
          </>
        )}
      </div>

      {(loading || loadingStages) && <div className="text-sm text-center py-8" style={{ color: "var(--text-dim)" }}>Carregando entregas…</div>}

      {!loading && !loadingStages && viewMode === "kanban" && (<>
        {/* Mobile kanban: vertical collapsible stages */}
        <div className="lg:hidden space-y-1.5 pb-24">
          {kanbanStages.map(stage => {
            const stageItems = filtered.filter(d => d.stage === stage.id);
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
                      <div className="text-center py-4 text-xs" style={{ color: "var(--text-dim)" }}>Nenhuma entrega nesta etapa</div>
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
                          onToggleStar={canWrite ? toggleStar : null}
                          completeness={getItemCompleteness(item)}
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
                        Nova entrega
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop kanban: horizontal scroll */}
        <div className="hidden lg:block relative">
          <div className="absolute right-0 top-0 bottom-4 w-16 pointer-events-none z-10"
            style={{ background: "linear-gradient(to left, var(--bg) 0%, transparent 100%)" }} />
          <div className="overflow-x-auto pb-4" style={{ scrollbarWidth: "thin" }}>
            <div className="flex gap-3" style={{ minWidth: `${kanbanStages.length * 284}px` }}>
              {kanbanStages.map(stage => {
                const stageItems = filtered.filter(d => d.stage === stage.id);
                const isOver     = dragOverStage === stage.id;

                return (
                  <div key={stage.id}
                    onDragOver={e => handleDragOver(e, stage.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={() => handleDrop(stage.id)}
                    className="flex flex-col rounded-xl border transition-all duration-150 overflow-hidden"
                    style={{ width: 272, minWidth: 272, background: isOver ? "var(--surface-alt)" : "var(--surface-alt)", borderColor: isOver ? stage.color + "70" : "var(--border)", boxShadow: isOver ? `0 0 0 2px ${stage.color}30` : "var(--shadow-card)", minHeight: 480, flexShrink: 0 }}>
                    <div style={{ height: 8, background: stage.color, flexShrink: 0 }} />
                    <div className="px-3.5 pt-3 pb-2.5 flex items-center justify-between gap-2"
                      style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold flex items-center gap-1.5"
                          style={{ color: "var(--text)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                          <span title={stage.name} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: "0 1 auto" }}>{stage.name}</span>
                          <span style={{ color: "var(--text-dim)", fontWeight: 500, flexShrink: 0 }}>({stageItems.length})</span>
                        </div>
                        {stage.sla && <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>SLA {stage.sla}d</div>}
                      </div>
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
                          title="Adicionar entrega">
                          <Plus size={14} />
                        </button>
                      )}
                    </div>

                    <div className="px-2 pt-2 pb-1 flex-1 overflow-y-auto" style={{ maxHeight: "62vh", minHeight: 80, display: "flex", flexDirection: "column", gap: 6 }}>
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
                              <span style={{ opacity: 0.5 }}>Nenhuma entrega nesta etapa</span>
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
                            onToggleStar={canWrite ? toggleStar : null}
                            completeness={getItemCompleteness(item)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </>)}

      {!loading && !loadingStages && viewMode === "table" && (
        <DeliverableTableView
          deliverables={filtered}
          stages={kanbanStages}
          usersById={usersById}
          campaignsById={campaignsById}
          onRowClick={setSelected}
        />
      )}

      {!loading && !loadingStages && viewMode === "calendar" && (
        <DeliverableCalendarView
          deliverables={filtered}
          stages={kanbanStages}
          onSelect={setSelected}
        />
      )}

      {!loading && !loadingStages && viewMode === "kanban" && deliverables.length > 0 && <AnalyticsPanel deliverables={deliverables} stages={kanbanStages} />}

      {!loading && !loadingStages && viewMode === "kanban" && (
        <p className="text-xs text-center mt-3" style={{ color: "var(--text-dim)" }}>
          Arraste para mover · "+" para criar · Clique para ver detalhes
        </p>
      )}
    </div>

    {quickAddStage && (
      <DeliverableCreateModal
        stageId={quickAddStage}
        currentUser={user}
        users={users}
        campaigns={campaigns}
        onAdd={handleQuickAdd}
        onClose={() => setQuickAddStage(null)}
      />
    )}

    {syncSelected && (
      <DeliverableDetailDrawer
        item={syncSelected}
        onClose={() => setSelected(null)}
        onStageMoved={reopenDeliverableAfterMove}
        onUpdate={handleUpdate}
        onMoveToStage={attemptStageChange}
        onDelete={handleDelete}
        users={Array.from(usersById.values())}
        canWrite={canWrite}
        userId={user?.id}
        currentUser={user}
        notifyMentions={notifyMentions}
      />
    )}

    {/* Editor de etapas do Kanban (rh_pipeline_stages, domain="marketing_deliverables") */}
    {canWrite && (
      <RHStageEditorModal
        open={stageEditorOpen}
        onClose={() => setStageEditorOpen(false)}
        domain="marketing_deliverables"
        domainLabel="Entregas de Marketing"
        records={deliverables}
        stageField="stage"
      />
    )}

    {/* Editor de campos customizados por etapa (rh_pipeline_stage_fields) */}
    {canWrite && (
      <RHStageFieldEditorModal
        open={!!fieldEditorStage}
        onClose={() => setFieldEditorStage(null)}
        domain="marketing_deliverables"
        stageKey={fieldEditorStage?.id}
        stageName={fieldEditorStage?.name}
      />
    )}

    </>
  );
}
