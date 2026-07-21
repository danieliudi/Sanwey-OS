import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, X, Megaphone, Star, ChevronDown, TrendingUp, Download, LayoutGrid, List, Calendar as CalendarIcon, Pencil, Settings2, AlertCircle } from "lucide-react";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import {
  MARKETING_STAGES, MARKETING_CHANNELS, MARKETING_KPIS, CHANNEL_COLORS,
} from "../../constants/marketing-pipelines";
import { useMarketingCampaigns } from "../../hooks/use-marketing-campaigns";
import { useMarketingSuppliers } from "../../hooks/use-marketing-suppliers";
import { reopenAfterMove } from "../../utils/reopen-after-move";
import { usePersonalEvents } from "../../hooks/use-personal-events";
import { useRHStageFields } from "../../hooks/use-rh-stage-fields";
import { useRHPipelineStages } from "../../hooks/use-rh-pipeline-stages";
import { RHStageEditorModal } from "../rh-pipeline/RHStageEditorModal";
import { RHStageFieldEditorModal } from "../rh-pipeline/RHStageFieldEditorModal";
import { CampaignKanbanCard } from "../campaign/CampaignKanbanCard";
import { CampaignDetailDrawer } from "../campaign/CampaignDetailDrawer";
import { CampaignCalendar } from "../campaign/CampaignCalendar";
import { useUsersById } from "../../hooks/use-users-by-id";
import { formatK } from "../../utils/currency";
import { formatDateBR, localDateInputToISOString } from "../../utils/date";
import { useAvailableHeight } from "../../hooks/use-available-height";
import { KanbanFab } from "../shared/KanbanFab";
import { resolveVisibleFields, getMissingRequiredFields, getFieldCompleteness } from "../../utils/field-conditions";
import { getInvalidFields } from "../../utils/field-validation";
import { RHStageFieldInput } from "../rh-pipeline/RHStageFieldInput";
import { Select } from "../ui/Select";
import { CurrencyInput } from "../ui/CurrencyInput";
import { AssigneeMultiSelect } from "../shared/AssigneeMultiSelect";
import { AvatarStack } from "../shared/AvatarStack";
import { useRecordViews } from "../../hooks/use-record-views";
import { hasUnreadNotesComment } from "../../lib/comment-badge";

// FASE 5: mais de um responsável por campanha — resolve owner_ids (com
// fallback pro owner escalar em campanhas legadas), mesmo padrão de
// getLeadOwnerIds em CRMView.jsx.
function getCampaignOwnerIds(c) {
  return Array.isArray(c.ownerIds) && c.ownerIds.length ? c.ownerIds : (c.owner ? [c.owner] : []);
}

// ── Create modal ─────────────────────────────────────────────────────────────

function CampaignCreateModal({ stageId, currentUser, users, onAdd, onClose, stages }) {
  const effectiveStages = stages?.length ? stages : MARKETING_STAGES;
  const stage = effectiveStages.find(s => s.id === stageId);
  const stageFields = useRHStageFields("marketing");

  const [name, setName]             = useState("");
  const [channel, setChannel]       = useState("");
  const [kpi, setKpi]               = useState("");
  const [companyIds, setCompanyIds] = useState(
    currentUser?.companies?.length > 0 ? [currentUser.companies[0]] : []
  );
  const [budget, setBudget]         = useState("");
  const [ownerIds, setOwnerIds]     = useState(currentUser?.id ? [currentUser.id] : []);
  const [launchDate, setLaunchDate] = useState("");
  const [endDate, setEndDate]       = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState(null);
  const [customValues, setCustomValues] = useState({});

  // Vínculo opcional a um fornecedor de marketing cadastrado (categoria
  // "agência") — quando preenchido, escopa quem tem role="agencia" e um
  // fornecedor vinculado ao próprio login a só enxergar esta campanha se for
  // a mesma agência (ver 20260718_marketing_agencia_supplier_scoping.sql).
  // Hoje é opcional porque só existe uma agência cadastrada.
  const { suppliers } = useMarketingSuppliers({});
  const agencySuppliers = useMemo(() => suppliers.filter(s => s.category === "agencia" && s.isActive), [suppliers]);

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
    if (!name.trim()) return;
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
    setSaving(true);
    setError(null);
    try {
      const primaryOwner = ownerIds[0] || null;
      await onAdd({
        name:           name.trim(),
        channel:        channel || null,
        kpi:            kpi || null,
        budget:         parseFloat(budget) || 0,
        companyIds,
        stage:          stageId,
        stageChangedAt: new Date().toISOString(),
        owner:          primaryOwner,
        ownerIds:       ownerIds.length ? ownerIds : (primaryOwner ? [primaryOwner] : []),
        launchDate:     localDateInputToISOString(launchDate),
        endDate:        localDateInputToISOString(endDate),
        agencyName:     agencyName.trim() || null,
        supplierId:     supplierId || null,
        createdBy:      currentUser?.id || null,
        notes:          [],
        activities:     [],
        starred:        false,
        approvalChecklist: [],
        customFields:   customValues,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao criar campanha.");
    } finally {
      setSaving(false);
    }
  };

  const focusBlue = e => { e.target.style.borderColor = "var(--accent)"; };
  const blurGray  = e => { e.target.style.borderColor = "var(--border-strong)"; };
  const labelSt   = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, display: "block" };
  const inputSt   = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)" };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "var(--shadow-pop)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--surface-alt)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", letterSpacing: "-0.01em" }}>
              Nova campanha
            </div>
            {stage && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color, flexShrink: 0, display: "inline-block" }} />
                <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500 }}>{stage.name}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 6, borderRadius: 8, display: "flex", alignItems: "center" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px" }}>
          {/* Nome */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>Nome da campanha <span style={{ color: "var(--danger)" }}>*</span></label>
            <input
              autoFocus
              type="text"
              placeholder="Ex: Campanha de Verão 2026"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
              style={inputSt}
              onFocus={focusBlue}
              onBlur={blurGray}
            />
          </div>

          {/* Empresa */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>Empresa <span style={{ color: "var(--danger)" }}>*</span></label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {COMPANY_IDS.map(id => {
                const co = COMPANIES[id];
                const sel = companyIds.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleCompany(id)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 99,
                      fontSize: 11,
                      fontWeight: 600,
                      border: `1px solid ${sel ? co.primary : "var(--border)"}`,
                      background: sel ? co.primary + "22" : "var(--surface)",
                      color: sel ? co.primary : "var(--text-dim)",
                      cursor: "pointer",
                      transition: "all 0.1s",
                    }}
                  >
                    {co.short}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Canal + KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelSt}>Canal</label>
              <select
                value={channel}
                onChange={e => setChannel(e.target.value)}
                className="w-full text-sm rounded-xl border outline-none px-3 py-2"
                style={{ ...inputSt, color: channel ? "var(--text)" : "var(--text-dim)" }}
              >
                <option value="">Selecionar</option>
                {MARKETING_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelSt}>KPI principal</label>
              <select
                value={kpi}
                onChange={e => setKpi(e.target.value)}
                className="w-full text-sm rounded-xl border outline-none px-3 py-2"
                style={{ ...inputSt, color: kpi ? "var(--text)" : "var(--text-dim)" }}
              >
                <option value="">Selecionar</option>
                {MARKETING_KPIS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          </div>

          {/* Orçamento */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>Orçamento (R$)</label>
            <CurrencyInput
              prefix={null}
              placeholder="0,00"
              value={budget}
              onChange={setBudget}
              className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
              style={inputSt}
              onFocus={focusBlue}
              onBlur={blurGray}
            />
          </div>

          {/* Responsável(is) */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>Responsável(is)</label>
            <AssigneeMultiSelect
              value={ownerIds}
              onChange={setOwnerIds}
              options={users}
              placeholder="Selecionar responsáveis…"
            />
          </div>

          {/* Lançamento + Encerramento */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelSt}>Data de lançamento</label>
              <input
                type="date"
                value={launchDate}
                onChange={e => setLaunchDate(e.target.value)}
                className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                style={inputSt}
                onFocus={focusBlue}
                onBlur={blurGray}
              />
            </div>
            <div>
              <label style={labelSt}>Encerramento</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                style={inputSt}
                onFocus={focusBlue}
                onBlur={blurGray}
              />
            </div>
          </div>

          {/* Agência */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelSt}>Agência (opcional)</label>
            <input
              type="text"
              placeholder="Nome da agência"
              value={agencyName}
              onChange={e => setAgencyName(e.target.value)}
              className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
              style={inputSt}
              onFocus={focusBlue}
              onBlur={blurGray}
            />
            {agencySuppliers.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <label style={labelSt}>Fornecedor vinculado (opcional)</label>
                <select
                  value={supplierId}
                  onChange={e => setSupplierId(e.target.value)}
                  className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                  style={inputSt}
                >
                  <option value="">Nenhum</option>
                  {agencySuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
                  Vincula a campanha a um fornecedor cadastrado — só passa a restringir o acesso quando essa agência também estiver vinculada a um login específico em Configurações → Usuários.
                </div>
              </div>
            )}
          </div>

          {visibleFields.length > 0 && (
            <div style={{ marginBottom: 20, paddingTop: 16, borderTop: "1px solid var(--surface-alt)" }}>
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
            <div style={{ background: "#FEF2F2", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="w-full font-semibold py-2.5 rounded-xl text-sm"
            style={{ background: "var(--color-industria)", color: "#FFF", opacity: saving || !name.trim() ? 0.5 : 1, border: "none", cursor: saving || !name.trim() ? "default" : "pointer" }}
          >
            {saving ? "Criando…" : "Criar campanha"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── KPI cards ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, red }) {
  return (
    <div
      className="rounded-xl border"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        padding: "8px 10px",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: "var(--text-dim)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 3,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: red ? "var(--danger)" : "var(--text)",
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function KpiBar({ campaigns }) {
  const active      = campaigns.filter(c => !["encerrado"].includes(c.stage)).length;
  const totalBudget = campaigns.reduce((s, c) => s + (c.budget || 0), 0);
  const urgent      = campaigns.filter(c => {
    if (!c.launchDate) return false;
    const d = Math.floor((new Date(c.launchDate).getTime() - Date.now()) / 86400000);
    return d <= 7 && d >= 0 && !["ao_vivo", "encerrado", "revisao"].includes(c.stage);
  }).length;

  return (
    <div className="grid grid-cols-3 gap-2 mb-3">
      <KpiCard label="Campanhas ativas" value={String(active)} />
      <KpiCard label="Orçamento total"     value={formatK(totalBudget)} />
      <KpiCard label="Urgente"          value={String(urgent)} red={urgent > 0} />
    </div>
  );
}

// ── Analytics panel (collapsible) ────────────────────────────────────────────

function AnalyticsPanel({ campaigns, stages }) {
  const [open, setOpen] = useState(false);

  const stageStats = useMemo(() => {
    // Etapas vivas (DB, editáveis) quando disponíveis — MARKETING_STAGES é só
    // o fallback estático de antes da customização por etapa existir. Sem
    // isso, renomear/criar/excluir uma etapa via "Editar etapas" deixava a
    // Análise mostrando o conjunto antigo de etapas, com dado errado.
    const nonTerminal = (stages || MARKETING_STAGES).filter(s => !s.terminal);
    return nonTerminal.map(stage => {
      const stageCampaigns = campaigns.filter(c => c.stage === stage.id);
      const count       = stageCampaigns.length;
      const totalBudget = stageCampaigns.reduce((sum, c) => sum + (c.budget || 0), 0);
      const daysArr = stageCampaigns
        .filter(c => c.stageChangedAt)
        .map(c => Math.floor((Date.now() - new Date(c.stageChangedAt).getTime()) / (1000 * 60 * 60 * 24)));
      const avgDays = daysArr.length > 0
        ? Math.round(daysArr.reduce((a, b) => a + b, 0) / daysArr.length)
        : null;
      return { stage, count, totalBudget, avgDays };
    });
  }, [campaigns, stages]);

  const maxCount  = Math.max(...stageStats.map(s => s.count), 1);
  const maxBudget = Math.max(...stageStats.map(s => s.totalBudget), 1);

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs font-medium transition-colors duration-150"
        style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}
        onMouseEnter={e => { e.currentTarget.style.color = "var(--text)"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "var(--text-dim)"; }}
      >
        <TrendingUp size={13} strokeWidth={2} />
        <span>Análise das campanhas</span>
        <ChevronDown
          size={13}
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        />
      </button>

      {open && (
        <div
          className="rounded-2xl border mt-3 p-5"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="text-xs font-semibold mb-4" style={{ color: "var(--text-dim)" }}>
            Distribuição por etapa
          </div>
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
          >
            {stageStats.map(({ stage, count, totalBudget, avgDays }) => (
              <div key={stage.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div
                    className="text-xs font-semibold flex items-center gap-1.5"
                    style={{ color: "var(--text)" }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: stage.color,
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />
                    {stage.name}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-dim)" }}>
                    {count} · {formatK(totalBudget)}
                  </div>
                </div>

                <div
                  style={{
                    height: 6,
                    background: "#F1F3F5",
                    borderRadius: 3,
                    overflow: "hidden",
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(count / maxCount) * 100}%`,
                      background: stage.color,
                      borderRadius: 3,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>

                <div
                  style={{
                    height: 3,
                    background: "#F1F3F5",
                    borderRadius: 3,
                    overflow: "hidden",
                    marginBottom: 5,
                    opacity: 0.7,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(totalBudget / maxBudget) * 100}%`,
                      background: stage.color,
                      borderRadius: 3,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>

                <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
                  {avgDays !== null
                    ? `Média ${avgDays}d nesta etapa`
                    : count > 0 ? "Sem tempo registrado" : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── View toggle button ────────────────────────────────────────────────────────

function ViewToggleButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
      style={{
        background: active ? "var(--accent)" : "var(--surface)",
        color: active ? "#FFFFFF" : "var(--text-dim)",
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--surface-alt)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "var(--surface)"; }}
    >
      <Icon size={13} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// ── Table view ────────────────────────────────────────────────────────────────

function CampaignTableView({ campaigns, stages, usersById, onRowClick }) {
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
            {["Campanha", "Empresa(s)", "Canal", "Etapa", "Responsável", "Orçamento", "Lançamento"].map(h => (
              <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {campaigns.length === 0 && (
            <tr><td colSpan={7} className="text-center py-10 text-sm" style={{ color: "var(--text-dim)" }}>Nenhuma campanha encontrada.</td></tr>
          )}
          {campaigns.map(c => {
            const stage = (stages || MARKETING_STAGES).find(s => s.id === c.stage);
            const color = stage?.color || "var(--text-dim)";
            // FASE 5: resolve todos os responsáveis (owner_ids, com fallback
            // pro owner escalar) contra o Map de usuários pro AvatarStack.
            const resolvedOwners = getCampaignOwnerIds(c).map(id => usersById.get(id)).filter(Boolean);
            return (
              <tr key={c.id} onClick={() => onRowClick(c)} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                <td className="px-4 py-3 text-sm font-medium" style={{ color: "var(--text)", maxWidth: 220 }}>
                  <div className="flex items-center gap-1.5">
                    <div className="truncate">{c.name}</div>
                    {c.starred && <Star size={12} style={{ color: "#F59E0B", fill: "#F59E0B", flexShrink: 0 }} />}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(c.companyIds || []).map(id => {
                      const co = COMPANIES[id];
                      if (!co) return null;
                      return (
                        <span key={id} className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: co.primary + "22", color: co.primary }}>
                          {co.short}
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{c.channel || "—"}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: color + "18", color, border: `1px solid ${color}40` }}>
                    {stage?.name || c.stage}
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
                <td className="px-4 py-3 text-sm font-semibold" style={{ color: "var(--text)" }}>{c.budget > 0 ? formatK(c.budget) : "—"}</td>
                <td className="px-4 py-3 text-xs" style={{ color: "var(--text-dim)" }}>{c.launchDate ? formatDateBR(c.launchDate) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function MarketingView({ user, users = [], evaluateAutomations, pushNotification, notifyMentions }) {
  const {
    campaigns,
    loading,
    canWrite,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    changeStage,
    toggleStar,
    updateChecklist,
  } = useMarketingCampaigns({ userId: user?.id, role: user?.role, roles: user?.roles });

  const stageFields = useRHStageFields("marketing");
  const [boardRef, boardHeight] = useAvailableHeight(16);

  // Etapas vêm de rh_pipeline_stages (domain="marketing"), editáveis via
  // RHStageEditorModal — mesmo padrão do RHOnboardingView. Normalizamos pro
  // shape que o resto do arquivo (colunas, badges, CampaignKanbanCard) já
  // espera: { id, name, color, sla, terminal }.
  const { stages: dbStages, loading: loadingStages } = useRHPipelineStages("marketing");
  const kanbanStages = useMemo(
    () => dbStages.map(s => ({ id: s.stageKey, name: s.name, color: s.color, sla: s.slaDays, terminal: s.terminal })),
    [dbStages]
  );
  const [stageEditorOpen, setStageEditorOpen] = useState(false);
  const [fieldEditorStage, setFieldEditorStage] = useState(null);

  const fireAutomations = useCallback((campaign, prev, eventType) => {
    if (!evaluateAutomations) return;
    const { patches: _p, notifications } = evaluateAutomations(campaign, prev, eventType, "marketing");
    notifications.forEach(n => {
      if (pushNotification) {
        pushNotification({
          type: "automation",
          title: `Automação: ${n.ruleName}`,
          body: n.message,
          campaignId: campaign.id,
        });
      }
    });
  }, [evaluateAutomations, pushNotification]);

  const {
    events:        personalEvents,
    createEvent:   createPersonalEvent,
    updateEvent:   updatePersonalEvent,
    deleteEvent:   deletePersonalEvent,
  } = usePersonalEvents({ userId: user?.id });

  const usersById = useUsersById(users);

  // roles[] cobre cargo adicional (ex: gerente_marketing como cargo
  // secundário) — user.role sozinho (cargo principal) fica só de fallback.
  // Achado da 2ª auditoria (esta view ficou de fora do fix a28bfb5).
  const userRoleList = user?.roles?.length ? user.roles : (user?.role ? [user.role] : []);
  const isManager  = userRoleList.includes("gerente_marketing") || userRoleList.includes("admin");
  const isAgencia  = userRoleList.includes("agencia");

  const [selected, setSelected]               = useState(null);
  const [draggedCampaign, setDraggedCampaign] = useState(null);
  const [dragOverStage, setDragOverStage]     = useState(null);
  const [stageError, setStageError]           = useState(null);
  const [quickAddStage, setQuickAddStage]     = useState(null);
  const [filterCompany, setFilterCompany]     = useState("all");
  const [filterChannel, setFilterChannel]     = useState("all");
  const [filterStarred, setFilterStarred]     = useState(false);
  const [ownerFilter, setOwnerFilter]         = useState("all");
  const [viewMode, setViewMode]               = useState("kanban"); // "kanban" | "table" | "calendar"
  const [expandedMobileStages, setExpandedMobileStages] = useState(() => new Set(["briefing"]));
  const toggleMobileStage = (id) => setExpandedMobileStages(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      if (filterCompany !== "all" && !(c.companyIds || []).includes(filterCompany)) return false;
      if (filterChannel !== "all" && c.channel !== filterChannel) return false;
      if (filterStarred && !c.starred) return false;
      if (isManager && ownerFilter !== "all" && !getCampaignOwnerIds(c).includes(ownerFilter)) return false;
      return true;
    });
  }, [campaigns, filterCompany, filterChannel, filterStarred, ownerFilter, isManager]);

  const ownerOptions = useMemo(() => {
    const idSet = new Set();
    for (const c of filteredCampaigns) {
      for (const id of getCampaignOwnerIds(c)) idSet.add(id);
    }
    return [
      { value: "all", label: "Todos os responsáveis" },
      ...Array.from(idSet).map(id => ({ value: id, label: usersById.get(id)?.name || id })),
    ];
  }, [filteredCampaigns, usersById]);

  const exportCampaignsCSV = useCallback(() => {
    const rows = [
      ["Nome", "Canal", "Orçamento", "KPI", "Etapa", "Empresas", "Lançamento"].join(","),
      ...filteredCampaigns.map(c => [
        `"${c.name}"`, c.channel || "", c.budget, c.kpi || "",
        c.stage, (c.companyIds || []).join(";"),
        c.launchDate ? c.launchDate.slice(0, 10) : "",
      ].join(","))
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "campanhas.csv"; a.click();
    URL.revokeObjectURL(url);
  }, [filteredCampaigns]);

  const handleDragStart = useCallback((campaign) => setDraggedCampaign(campaign), []);
  const handleDragOver  = useCallback((e, stageId) => { e.preventDefault(); setDragOverStage(stageId); }, []);
  const handleDragLeave = useCallback((e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStage(null); }, []);
  const handleDragEnd   = useCallback(() => { setDraggedCampaign(null); setDragOverStage(null); }, []);

  const handleStageChange = useCallback(async (campaignId, toStage) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    const prev = campaign ? { ...campaign } : null;
    await changeStage(campaignId, toStage);
    if (campaign) {
      fireAutomations({ ...campaign, stage: toStage }, prev, "stage_change");
    }
  }, [campaigns, changeStage, fireAutomations]);

  // Enforcement real: bloqueia sair da etapa atual com campo obrigatório
  // (estático ou condicional) vazio — vale tanto pro drag-and-drop quanto
  // pro "Mover para" do menu do card. Antes disso "required" era só o
  // asterisco visual, confirmado ao vivo que não travava nada. Mesmo padrão
  // do attemptStageChange do Pipeline de CRM (CRMView.jsx), mas lendo os
  // campos via useRHStageFields("marketing") — Marketing não usa a tabela
  // antiga pipeline_stage_fields. Banner não-bloqueante em vez de alert()
  // nativo — trava sessões automatizadas/headless (achado da auditoria de
  // fricção de 18/07).
  const attemptStageChange = useCallback(async (campaignId, toStage) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign) return;
    const fields = stageFields.getFields(campaign.stage);
    const missing = getMissingRequiredFields(fields, campaign.customFields || {});
    if (missing.length > 0) {
      setStageError(`Não dá pra mover "${campaign.name}": preencha antes — ${missing.map(f => f.label).join(", ")}.`);
      return;
    }
    setStageError(null);
    await handleStageChange(campaignId, toStage);
  }, [campaigns, stageFields, handleStageChange]);

  // Badge "X/Y campos obrigatórios" no card (auditoria 10.3).
  const getCampaignCompleteness = useCallback((campaign) => {
    const fields = stageFields.getFields(campaign.stage);
    return getFieldCompleteness(fields, campaign.customFields || {});
  }, [stageFields]);

  const { viewedAt: campaignViewedAt, markViewed: markCampaignViewed } = useRecordViews("campaigns", user?.id);
  const getCampaignUnread = useCallback((campaign) => hasUnreadNotesComment(campaign, campaignViewedAt, user?.id), [campaignViewedAt, user?.id]);
  useEffect(() => { if (selected?.id) markCampaignViewed(selected.id); }, [selected?.id]);

  const handleDrop = useCallback(async (toStage) => {
    if (!draggedCampaign || !canWrite) return;
    if (draggedCampaign.stage !== toStage) {
      await attemptStageChange(draggedCampaign.id, toStage);
    }
    setDraggedCampaign(null);
    setDragOverStage(null);
  }, [draggedCampaign, canWrite, attemptStageChange]);

  const handleUpdate = useCallback(async (id, patch) => {
    if (isAgencia && Object.keys(patch).length === 1 && "approvalChecklist" in patch) {
      await updateChecklist(id, patch.approvalChecklist);
      if (selected?.id === id) setSelected(prev => ({ ...prev, ...patch }));
      return;
    }
    if (!canWrite) return;
    const current = campaigns.find(c => c.id === id);
    await updateCampaign(id, patch);
    if (selected?.id === id) setSelected(prev => ({ ...prev, ...patch }));
    if (current && patch.stage && patch.stage !== current.stage) {
      fireAutomations({ ...current, ...patch }, current, "stage_change");
    } else if (current && patch.budget !== undefined) {
      fireAutomations({ ...current, ...patch }, current, "field_value");
    }
  }, [canWrite, isAgencia, updateCampaign, updateChecklist, selected, campaigns, fireAutomations]);

  const handleDelete = useCallback(async (id) => {
    if (!canWrite) return;
    await deleteCampaign(id);
  }, [canWrite, deleteCampaign]);

  const handleQuickAdd = useCallback(async (campaign) => {
    const created = await createCampaign(campaign);
    if (created) {
      fireAutomations(created, null, "lead_created");
      fireAutomations(created, null, "field_value");
    }
  }, [createCampaign, fireAutomations]);

  const syncSelected = useMemo(() => {
    if (!selected) return null;
    return campaigns.find(c => c.id === selected.id) || selected;
  }, [campaigns, selected]);

  // Ver src/utils/reopen-after-move.js — fecha o drawer e reabre já na
  // etapa nova, em vez de só trocar o conteúdo por baixo do drawer aberto.
  const campaignsRef = useRef(campaigns);
  useEffect(() => { campaignsRef.current = campaigns; }, [campaigns]);
  const reopenCampaignAfterMove = useCallback((campaignId) => {
    reopenAfterMove(setSelected, () => campaignsRef.current.find(c => c.id === campaignId) || null);
  }, []);

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
            <Megaphone size={22} style={{ color: "var(--text)" }} />
            <h1 className="font-bold" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
              Marketing
            </h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
            Kanban de campanhas {isAgencia ? "· acesso de visitante" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canWrite && (
            <button
              onClick={() => setStageEditorOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-dim)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--text)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text-dim)"; }}
              title="Editar etapas do Kanban"
            >
              <Pencil size={13} />
              <span className="hidden sm:inline">Editar etapas</span>
            </button>
          )}
          <button
            onClick={exportCampaignsCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-dim)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text-dim)"; }}
            title="Exportar campanhas como CSV"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>
          <div
            className="inline-flex rounded-lg border overflow-hidden"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            role="tablist"
          >
            <ViewToggleButton
              active={viewMode === "kanban"}
              onClick={() => setViewMode("kanban")}
              icon={LayoutGrid}
              label="Kanban"
            />
            <ViewToggleButton
              active={viewMode === "table"}
              onClick={() => setViewMode("table")}
              icon={List}
              label="Tabela"
            />
            <ViewToggleButton
              active={viewMode === "calendar"}
              onClick={() => setViewMode("calendar")}
              icon={CalendarIcon}
              label="Calendário"
            />
          </div>
          {isManager && (
            <Select
              value={ownerFilter}
              onChange={e => setOwnerFilter(e.target.value)}
              options={ownerOptions}
              className="w-full sm:w-48"
            />
          )}
          {viewMode === "kanban" && canWrite && (
            <button
              onClick={() => setQuickAddStage("briefing")}
              className="flex items-center gap-1.5 font-semibold"
              style={{
                background: "var(--accent)",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 10,
                padding: "6px 16px",
                fontSize: 13,
                cursor: "pointer",
              }}
              onMouseEnter={e => { e.currentTarget.style.filter = "brightness(0.9)"; }}
              onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
              aria-label="Criar nova campanha"
            >
              <Plus size={14} />
              Nova campanha
            </button>
          )}
        </div>
      </div>

      {viewMode === "kanban" && canWrite && (
        <KanbanFab label="Nova campanha" onClick={() => setQuickAddStage("briefing")} />
      )}

      {/* KPI bar */}
      {viewMode === "kanban" && <KpiBar campaigns={filteredCampaigns} />}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <select
          value={filterCompany}
          onChange={e => setFilterCompany(e.target.value)}
          className="text-xs rounded-xl border px-3 py-1.5 outline-none"
          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
        >
          <option value="all">Todas as empresas</option>
          {COMPANY_IDS.map(id => (
            <option key={id} value={id}>{COMPANIES[id]?.short}</option>
          ))}
        </select>
        <select
          value={filterChannel}
          onChange={e => setFilterChannel(e.target.value)}
          className="text-xs rounded-xl border px-3 py-1.5 outline-none"
          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
        >
          <option value="all">Todos os canais</option>
          {MARKETING_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={() => setFilterStarred(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl border transition-colors"
          style={{
            borderColor: filterStarred ? "#F59E0B" : "var(--border)",
            background:  filterStarred ? "var(--amber-bg)" : "var(--surface)",
            color:       filterStarred ? "var(--warning)" : "var(--text-dim)",
            cursor:      "pointer",
          }}
        >
          <Star size={11} fill={filterStarred ? "#F59E0B" : "none"} />
          Destaques
        </button>
      </div>

      {/* Loading state */}
      {(loading || loadingStages) && (
        <div className="text-sm text-center py-8" style={{ color: "var(--text-dim)" }}>
          Carregando campanhas…
        </div>
      )}

      {/* Calendar view */}
      {!loading && !loadingStages && viewMode === "calendar" && (
        <CampaignCalendar
          campaigns={filteredCampaigns}
          personalEvents={personalEvents}
          usersById={usersById}
          onSelectCampaign={setSelected}
          onCreatePersonalEvent={createPersonalEvent}
          onUpdatePersonalEvent={updatePersonalEvent}
          onDeletePersonalEvent={deletePersonalEvent}
          canWrite={canWrite || userRoleList.some(r => r !== "agencia")}
          calendarToken={user?.calendarToken ?? null}
          supabaseUrl={import.meta.env.VITE_SUPABASE_URL ?? null}
          stages={kanbanStages}
        />
      )}

      {/* Table view */}
      {!loading && !loadingStages && viewMode === "table" && (
        <CampaignTableView
          campaigns={filteredCampaigns}
          stages={kanbanStages}
          usersById={usersById}
          onRowClick={setSelected}
        />
      )}

      {/* Kanban board */}
      {!loading && !loadingStages && viewMode === "kanban" && (<>
        {/* Mobile kanban: vertical collapsible stages */}
        <div className="lg:hidden space-y-1.5 pb-24">
          {kanbanStages.map(stage => {
            const stageCampaigns = filteredCampaigns.filter(c => c.stage === stage.id);
            const expanded = expandedMobileStages.has(stage.id);
            const totalBudget = stageCampaigns.reduce((s, c) => s + (c.budget || 0), 0);
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
                    {totalBudget > 0 && <span className="text-xs font-semibold" style={{ color: stage.color + "99" }}>{formatK(totalBudget)}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm" style={{ color: stage.color }}>{stageCampaigns.length}</span>
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
                  <div className="p-2.5 space-y-2" style={{ background: "var(--surface)" }}>
                    {stageCampaigns.length === 0 ? (
                      <div className="text-center py-4 text-xs" style={{ color: "var(--text-dim)" }}>Nenhuma campanha nesta etapa</div>
                    ) : (
                      stageCampaigns.map(c => (
                        <CampaignKanbanCard
                          key={c.id}
                          campaign={c}
                          users={users}
                          onClick={setSelected}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          stages={kanbanStages}
                          onMoveToStage={attemptStageChange}
                          onDeleteCard={canWrite ? handleDelete : undefined}
                          completeness={getCampaignCompleteness(c)}
                          unread={getCampaignUnread(c)}
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
                        Nova campanha
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
          <div
            className="absolute right-0 top-0 bottom-4 w-16 pointer-events-none z-10"
            style={{ background: "linear-gradient(to left, var(--bg) 0%, transparent 100%)" }}
          />
          <div ref={boardRef} className="overflow-x-auto pb-4" style={{ scrollbarWidth: "thin", height: boardHeight }}>
            <div
              className="flex gap-3 h-full"
              style={{ minWidth: `${kanbanStages.length * 284}px` }}
            >
              {kanbanStages.map(stage => {
                const stageCampaigns = filteredCampaigns.filter(c => c.stage === stage.id);
                const count       = stageCampaigns.length;
                const totalBudget = stageCampaigns.reduce((s, c) => s + (c.budget || 0), 0);
                const isOver      = dragOverStage === stage.id;

                return (
                  <div
                    key={stage.id}
                    onDragOver={e => handleDragOver(e, stage.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={() => handleDrop(stage.id)}
                    className="flex flex-col rounded-xl border transition-all duration-150 overflow-hidden"
                    style={{
                      width: 272,
                      minWidth: 272,
                      background: isOver ? "var(--surface-alt)" : "var(--surface-alt)",
                      borderColor: isOver ? stage.color + "70" : "var(--border)",
                      boxShadow: isOver ? `0 0 0 2px ${stage.color}30` : "var(--shadow-card)",
                      height: "100%",
                      flexShrink: 0,
                    }}
                  >
                    {/* Top color band — mais grosso pra dar mais peso visual */}
                    <div style={{ height: 8, background: stage.color, flexShrink: 0 }} />

                    {/* Column header */}
                    <div
                      className="px-3.5 pt-3 pb-2.5 flex items-center justify-between gap-2"
                      style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
                    >
                      <div className="min-w-0 flex-1">
                        <div
                          className="font-semibold flex items-center gap-1.5"
                          style={{
                            color: "var(--text)",
                            fontSize: 11,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                          }}
                        >
                          <span title={stage.name} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: "0 1 auto" }}>{stage.name}</span>
                          <span style={{ color: "var(--text-dim)", fontWeight: 500, flexShrink: 0 }}>({count})</span>
                        </div>
                        <div className="text-xs mt-0.5 font-semibold" style={{ color: "var(--text-dim)" }}>
                          {totalBudget > 0 ? formatK(totalBudget) : "R$ 0"}
                          {stage.sla && <span style={{ fontWeight: 400, marginLeft: 6 }}>· SLA {stage.sla}d</span>}
                        </div>
                      </div>
                      {canWrite && !stage.terminal && (
                        <button
                          onClick={() => setQuickAddStage(stage.id)}
                          title="Nova campanha nesta etapa"
                          className="flex items-center justify-center rounded-md transition-colors"
                          style={{ width: 26, height: 26, color: "var(--text-dim)", background: "transparent", border: "none", cursor: "pointer", flexShrink: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--text)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
                        >
                          <Plus size={14} />
                        </button>
                      )}
                      {canWrite && (
                        <button
                          onClick={() => setFieldEditorStage(stage)}
                          title="Editar campos desta etapa"
                          className="flex items-center justify-center rounded-md transition-colors"
                          style={{ width: 26, height: 26, color: "var(--text-dim)", background: "transparent", border: "none", cursor: "pointer", flexShrink: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--text)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
                        >
                          <Settings2 size={13} />
                        </button>
                      )}
                    </div>

                    {/* Cards */}
                    <div
                      className="px-2 pb-1 flex-1 overflow-y-auto"
                      style={{ minHeight: 0, paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}
                    >
                      {stageCampaigns.length === 0 ? (
                        <div
                          className="flex flex-col items-center justify-center py-8 mx-1 rounded-lg border-2 border-dashed text-xs gap-1"
                          style={{ borderColor: isOver ? stage.color + "40" : "var(--border)", color: "var(--text-dim)" }}
                        >
                          {isOver ? (
                            <>
                              <Plus size={16} style={{ opacity: 0.5 }} />
                              <span>Soltar aqui</span>
                            </>
                          ) : (
                            <>
                              <span style={{ opacity: 0.5 }}>Nenhuma campanha nesta etapa</span>
                              {!stage.terminal && canWrite && (
                                <span style={{ opacity: 0.4, fontSize: 10 }}>Arraste um card aqui ou crie um novo</span>
                              )}
                            </>
                          )}
                        </div>
                      ) : (
                        stageCampaigns.map(c => (
                          <CampaignKanbanCard
                            key={c.id}
                            campaign={c}
                            users={users}
                            onClick={setSelected}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            stages={kanbanStages}
                            onMoveToStage={attemptStageChange}
                            onDeleteCard={canWrite ? handleDelete : undefined}
                            completeness={getCampaignCompleteness(c)}
                            unread={getCampaignUnread(c)}
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

      {/* Analytics panel */}
      {!loading && !loadingStages && viewMode === "kanban" && filteredCampaigns.length > 0 && (
        <AnalyticsPanel campaigns={filteredCampaigns} stages={kanbanStages} />
      )}

      {!loading && !loadingStages && viewMode === "kanban" && (
        <p className="text-xs text-center mt-3" style={{ color: "var(--text-dim)" }}>
          Arraste para mover · Use "+" no cabeçalho ou o botão flutuante para criar · Clique no card para ver detalhes
        </p>
      )}

      {/* Detail drawer */}
      {syncSelected && (
        <CampaignDetailDrawer
          campaign={syncSelected}
          onClose={() => setSelected(null)}
          onStageMoved={reopenCampaignAfterMove}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          users={Array.from(usersById.values())}
          canWrite={canWrite}
          currentUser={user}
          notifyMentions={notifyMentions}
          stages={kanbanStages}
        />
      )}

      {/* Editor de etapas do Kanban (rh_pipeline_stages, domain="marketing") */}
      {canWrite && (
        <RHStageEditorModal
          open={stageEditorOpen}
          onClose={() => setStageEditorOpen(false)}
          domain="marketing"
          domainLabel="Marketing"
          records={campaigns}
          stageField="stage"
        />
      )}

      {/* Editor de campos customizados por etapa (rh_pipeline_stage_fields) */}
      {canWrite && (
        <RHStageFieldEditorModal
          open={!!fieldEditorStage}
          onClose={() => setFieldEditorStage(null)}
          domain="marketing"
          stageKey={fieldEditorStage?.id}
          stageName={fieldEditorStage?.name}
        />
      )}
    </div>

    {/* Create modal */}
    {quickAddStage && (
      <CampaignCreateModal
        stageId={quickAddStage}
        currentUser={user}
        users={users}
        onAdd={handleQuickAdd}
        onClose={() => setQuickAddStage(null)}
        stages={kanbanStages}
      />
    )}
    </>
  );
}
