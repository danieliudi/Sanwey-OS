import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, X, Megaphone, Star, ChevronDown, TrendingUp, Download, LayoutGrid, List, Calendar as CalendarIcon, Settings2, AlertCircle, GripVertical } from "lucide-react";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import {
  MARKETING_STAGES, MARKETING_CHANNELS, MARKETING_KPIS, CHANNEL_COLORS,
} from "../../constants/marketing-pipelines";
import { useMarketingCampaigns } from "../../hooks/use-marketing-campaigns";
import { supabase } from "../../lib/supabase";
import { useMarketingSuppliers } from "../../hooks/use-marketing-suppliers";
import { reopenAfterMove } from "../../utils/reopen-after-move";
import { usePersonalEvents } from "../../hooks/use-personal-events";
import { useRHStageFields } from "../../hooks/use-rh-stage-fields";
import { useRHPipelineStages } from "../../hooks/use-rh-pipeline-stages";
import { RHStageFieldsPanel } from "../shared/stage-editor/RHStageFieldsPanel";
import { StageColorPicker } from "../shared/stage-editor/StageColorPicker";
import { CampaignKanbanCard } from "../campaign/CampaignKanbanCard";
import { CampaignDetailDrawer } from "../campaign/CampaignDetailDrawer";
import { CampaignCalendar } from "../campaign/CampaignCalendar";
import { useUsersById } from "../../hooks/use-users-by-id";
import { formatK } from "../../utils/currency";
import { stageTextColor, stageTextColorStrong } from "../../utils/stage-colors";
import { formatDateBR, localDateInputToISOString } from "../../utils/date";
import { exportCampaignsToCSV } from "../../utils/export-csv";
import { useAvailableHeight } from "../../hooks/use-available-height";
import { KanbanFab } from "../shared/KanbanFab";
import { KanbanColumnHeader } from "../shared/KanbanColumnHeader";
import { ViewToggleButton } from "../shared/ViewToggleButton";
import { KanbanAnalyticsPanel } from "../shared/KanbanAnalyticsPanel";
import { KanbanBoardHeader } from "../shared/KanbanBoardHeader";
import { KanbanBoardScrollArea } from "../shared/KanbanBoardScrollArea";
import { resolveVisibleFields, getMissingRequiredFields, getFieldCompleteness } from "../../utils/field-conditions";
import { getInvalidFields } from "../../utils/field-validation";
import { RHStageFieldInput } from "../rh-pipeline/RHStageFieldInput";
import { Select } from "../ui/Select";
import { CurrencyInput } from "../ui/CurrencyInput";
import { AssigneeMultiSelect } from "../shared/AssigneeMultiSelect";
import { KanbanColumnSortMenu } from "../shared/KanbanColumnSortMenu";
import { useKanbanColumnSort } from "../../hooks/use-kanban-sort";
import { sortKanbanItems } from "../../utils/kanban-sort";
import { AvatarStack } from "../shared/AvatarStack";
import { MobileTableCards } from "../shared/MobileTableCards";
import { AppToast } from "../shared/AppToast";
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
    if (!name.trim()) { setError("Nome da campanha é obrigatório."); return; }
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
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
                      touched={Boolean(error)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full font-semibold py-2.5 rounded-xl text-sm"
            style={{ background: "var(--color-industria)", color: "#FFF", opacity: saving ? 0.5 : 1, border: "none", cursor: saving ? "default" : "pointer" }}
          >
            {saving ? "Criando…" : "Criar campanha"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Nova etapa (criação rápida a partir do fim do Kanban) ──────────────────
// "Editar etapas" (lista completa) saiu do header — criar uma etapa agora
// é isso aqui, ou "Opções Avançadas" dentro de "Editar campos desta etapa"
// pra renomear/recolorir/excluir uma já existente.
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

// ── Table view ────────────────────────────────────────────────────────────────

function CampaignTableView({ campaigns, stages, usersById, onRowClick }) {
  return (
    <>
    <MobileTableCards
      rows={campaigns}
      onRowClick={onRowClick}
      emptyMessage="Nenhuma campanha encontrada."
      title={(c) => c.name}
      chips={(c) => {
        const stage = (stages?.length ? stages : MARKETING_STAGES).find(s => s.id === c.stage);
        const color = stage?.color || "var(--text-dim)";
        return [{ label: stage?.name || c.stage, color }];
      }}
      right={(c) => (
        <span className="flex items-center gap-1.5">
          {c.starred && <Star size={12} style={{ color: "#F59E0B", fill: "#F59E0B" }} />}
          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{c.budget > 0 ? formatK(c.budget) : "—"}</span>
        </span>
      )}
      meta={(c) => {
        const companies = (c.companyIds || []).map(id => COMPANIES[id]?.short).filter(Boolean).join("/");
        return [companies, c.channel].filter(Boolean).join(" · ") || "—";
      }}
      metaRight={(c) => {
        const resolvedOwners = getCampaignOwnerIds(c).map(id => usersById.get(id)).filter(Boolean);
        return (
          <>
            {resolvedOwners.length > 0 && <AvatarStack users={resolvedOwners} size={18} max={2} />}
            <span>{c.launchDate ? formatDateBR(c.launchDate) : "—"}</span>
          </>
        );
      }}
    />
    <div className="hidden md:block rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
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
            const stage = (stages?.length ? stages : MARKETING_STAGES).find(s => s.id === c.stage);
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
                  <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: color + "18", color: stageTextColor(color), border: `1px solid ${color}40` }}>
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
    </>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function MarketingView({ user, users = [], evaluateAutomations, pushNotification, notifyMentions, initialSelectedCampaignId, onInitialCampaignConsumed }) {
  const {
    campaigns,
    loading,
    hasLoadedOnce,
    canWrite,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    duplicateCampaign,
    changeStage,
    toggleStar,
    updateChecklist,
  } = useMarketingCampaigns({ userId: user?.id, role: user?.role, roles: user?.roles });

  const stageFields = useRHStageFields("marketing");
  // trailingRef mede o painel de analytics + texto de dica que vêm depois do
  // board, pra sobrar espaço suficiente pra eles também caberem (ver
  // use-available-height.js).
  const trailingRef = useRef(null);
  const [boardRef, boardHeight] = useAvailableHeight(16, [], trailingRef);

  // Etapas vêm de rh_pipeline_stages (domain="marketing") — criar/reordenar
  // via "+ Nova etapa" e drag de coluna, excluir dentro de "Editar campos
  // desta etapa" (mesmo padrão de EntregasView.jsx). Normalizamos pro shape
  // que o resto do arquivo (colunas, badges, CampaignKanbanCard) já espera:
  // { id, name, color, sla, terminal }.
  const { stages: dbStages, loading: loadingStages, addStage, reorderStages } = useRHPipelineStages("marketing");
  const kanbanStages = useMemo(
    () => dbStages.map(s => ({ id: s.stageKey, name: s.name, color: s.color, sla: s.slaDays, terminal: s.terminal })),
    [dbStages]
  );
  // Etapas vivas (DB) quando disponíveis — MARKETING_STAGES é só o fallback
  // estático de antes da customização por etapa existir (mesma regra que já
  // valia dentro do AnalyticsPanel local, antes da extração pro shared).
  const analyticsStages = useMemo(() => {
    const src = kanbanStages.length ? kanbanStages : MARKETING_STAGES;
    return src.filter(s => !s.terminal).map(s => ({ key: s.id, name: s.name, color: s.color, slaDays: s.sla }));
  }, [kanbanStages]);
  const [fieldEditorStage, setFieldEditorStage] = useState(null);
  const [addingStage, setAddingStage] = useState(false);
  const [draggedColumnKey, setDraggedColumnKey] = useState(null);

  // Aplica o resultado das automações na campanha (antes os patches eram
  // descartados: a regra notificava mas mover/definir campo nunca acontecia).
  // Mesmo contrato do applyAutomationOutcome do App.jsx: só notifica sucesso
  // das regras cujo patch realmente gravou.
  const fireAutomations = useCallback(async (campaign, prev, eventType) => {
    if (!evaluateAutomations) return;
    const { patches, notifications, sideEffects } = evaluateAutomations(campaign, prev, eventType, "marketing");
    const failedRuleIds = new Set();
    for (const p of (patches || [])) {
      // `badges` (add_badge) não existe em marketing_campaigns — ação ignorada.
      // `stageChangedAt`/`lastActivity` são cuidados pelo changeStage do hook.
      const { stage: targetStage, stageChangedAt: _sc, lastActivity: _la, badges: _b, ...rest } = p.patch || {};
      try {
        if (targetStage && targetStage !== campaign.stage) {
          await changeStage(p.leadId, targetStage);
        }
        if (Object.keys(rest).length > 0) {
          await updateCampaign(p.leadId, rest);
        }
      } catch (err) {
        failedRuleIds.add(p.ruleId);
        console.error(`Automação "${p.ruleName}" falhou ao gravar:`, err);
      }
    }
    (notifications || []).forEach(n => {
      if (failedRuleIds.has(n.ruleId)) return;
      if (pushNotification) {
        pushNotification({
          type: "automation",
          title: `Automação: ${n.ruleName}`,
          body: n.message,
          // campaignId nunca foi um campo que createNotification desestrutura
          // (só leadId/companyId/link) — era descartado em silêncio. `link`
          // é o mecanismo genérico real, mesmo usado pelas notificações de
          // @menção de campanha (CampaignDetailDrawer.jsx).
          link: { module: "campaigns", id: campaign.id },
        });
      }
    });
    for (const effect of (sideEffects || [])) {
      try {
        if (effect.type === "create_deliverable") {
          // O motor monta companyIds a partir de lead.companyId (escalar) —
          // campanha usa companyIds (array), então cai no fallback abaixo.
          const companyIds = (effect.companyIds || []).filter(Boolean);
          await supabase.rpc("crm_create_cross_module_deliverable", {
            p_title: effect.title,
            p_company_ids: companyIds.length > 0 ? companyIds : (campaign.companyIds || []),
            p_description: effect.description,
            p_priority: effect.priority,
          });
        }
        // enrich_cnpj: campanha não tem CNPJ — ação não se aplica, ignorada.
      } catch {
        // Automação não deve travar o fluxo do board de Marketing.
      }
    }
  }, [evaluateAutomations, pushNotification, changeStage, updateCampaign]);

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

  // Vem do Cmd-K (App.jsx) — só consome quando o fetch local de campanhas já
  // resolveu ao menos uma vez. Não dá pra usar `loading` puro aqui: ele
  // começa `false` e só vira `true` depois que o effect do hook dispara
  // `fetchAll`, então no 1º commit deste componente (MarketingView acabou
  // de montar vindo do Cmd-K) `loading` ainda é `false` e `campaigns` ainda
  // `[]` — o guard não bloquearia e a campanha certa nunca abriria.
  useEffect(() => {
    if (!initialSelectedCampaignId || !hasLoadedOnce) return;
    const campaign = campaigns.find(c => c.id === initialSelectedCampaignId);
    if (campaign) setSelected(campaign);
    onInitialCampaignConsumed?.();
  }, [initialSelectedCampaignId, campaigns, hasLoadedOnce, onInitialCampaignConsumed]);

  const [draggedCampaign, setDraggedCampaign] = useState(null);
  const [dragOverStage, setDragOverStage]     = useState(null);
  const [stageError, setStageError]           = useState(null);
  const [quickAddStage, setQuickAddStage]     = useState(null);
  const [filterCompany, setFilterCompany]     = useState("all");
  const [filterChannel, setFilterChannel]     = useState("all");
  const [filterStarred, setFilterStarred]     = useState(false);
  const [ownerFilter, setOwnerFilter]         = useState("all");
  const [viewMode, setViewMode]               = useState("kanban"); // "kanban" | "table" | "calendar" | "analytics"
  const { getCriteria: getSortCriteria, setCriteria: setSortCriteria } = useKanbanColumnSort("marketing-campanhas");
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

  // Ordenar cards dentro de cada coluna do Kanban — cada etapa guarda seu
  // próprio critério agora (ver KanbanColumnSortMenu), então precisa de um
  // bucket por etapa em vez de ordenar a lista toda com um critério só.
  const campaignsByStage = useMemo(() => {
    const bucket = Object.create(null);
    for (const s of kanbanStages) bucket[s.id] = [];
    for (const c of filteredCampaigns) {
      if (bucket[c.stage]) bucket[c.stage].push(c);
    }
    for (const s of kanbanStages) {
      bucket[s.id] = sortKanbanItems(bucket[s.id], getSortCriteria(s.id), {
        deadline: c => c.launchDate,
        value: c => c.budget,
        name: c => c.name,
        createdAt: c => c.createdAt,
      });
    }
    return bucket;
  }, [filteredCampaigns, kanbanStages, getSortCriteria]);

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
    exportCampaignsToCSV(filteredCampaigns);
  }, [filteredCampaigns]);

  // Específico da aba Análise (KanbanAnalyticsPanel) — mesma conta que já
  // existia na antiga KpiBar; "Campanhas ativas" saiu por virar redundante
  // com o "Total de registros" genérico do painel.
  const campaignSpecificStats = useMemo(() => {
    const totalBudget = filteredCampaigns.reduce((s, c) => s + (c.budget || 0), 0);
    const urgent = filteredCampaigns.filter(c => {
      if (!c.launchDate) return false;
      const d = Math.floor((new Date(c.launchDate).getTime() - Date.now()) / 86400000);
      return d <= 7 && d >= 0 && !["ao_vivo", "encerrado", "revisao"].includes(c.stage);
    }).length;
    return [
      { label: "Orçamento Total", value: formatK(totalBudget) },
      { label: "Urgente", value: String(urgent), color: urgent > 0 ? "var(--danger)" : undefined },
    ];
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
  // do attemptStageChange do Kanban do Funil de Vendas (CRMView.jsx), mas lendo os
  // campos via useRHStageFields("marketing") — Marketing não usa a tabela
  // antiga pipeline_stage_fields. Banner não-bloqueante em vez de alert()
  // nativo — trava sessões automatizadas/headless (achado da auditoria de
  // fricção de 18/07).
  const attemptStageChange = useCallback(async (campaignId, toStage) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign) return false;
    const fields = stageFields.getFields(campaign.stage);
    const missing = getMissingRequiredFields(fields, campaign.customFields || {});
    if (missing.length > 0) {
      setStageError(`Não dá pra mover "${campaign.name}": preencha antes — ${missing.map(f => f.label).join(", ")}.`);
      return false;
    }
    setStageError(null);
    await handleStageChange(campaignId, toStage);
    return true;
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

  // Canal de drag separado do drag de card (draggedColumnKey vs
  // draggedCampaign) — arrastar o cabeçalho da coluna reordena etapas.
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

  const handleDuplicate = useCallback(async (id) => {
    if (!canWrite) return;
    const source = campaigns.find(c => c.id === id);
    if (!source) return;
    await duplicateCampaign(source);
  }, [canWrite, campaigns, duplicateCampaign]);

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
      <AppToast variant="danger" position="top-right" icon={AlertCircle} onDismiss={() => setStageError(null)}>
        {stageError}
      </AppToast>
    )}
    <div>
      {/* Toolbar: título + ações + view-toggle + filtros, dentro da barra de
          topo chapada e de ponta a ponta (ver KanbanBoardHeader.jsx). */}
      <KanbanBoardHeader className="mb-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 38, height: 38, borderRadius: 10, background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text)" }}
            >
              <Megaphone size={18} />
            </div>
            <h1 className="font-bold" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
              Marketing
            </h1>
          </div>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)", marginLeft: 48 }}>
            Kanban de campanhas {isAgencia ? "· acesso de visitante" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
              iconOnlyMobile
            />
            <ViewToggleButton
              active={viewMode === "table"}
              onClick={() => setViewMode("table")}
              icon={List}
              label="Tabela"
              iconOnlyMobile
            />
            <ViewToggleButton
              active={viewMode === "calendar"}
              onClick={() => setViewMode("calendar")}
              icon={CalendarIcon}
              label="Calendário"
              iconOnlyMobile
            />
            <ViewToggleButton
              active={viewMode === "analytics"}
              onClick={() => setViewMode("analytics")}
              icon={TrendingUp}
              label="Análise"
              iconOnlyMobile
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
                color: "var(--on-accent)",
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

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
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
      </KanbanBoardHeader>

      {viewMode === "kanban" && canWrite && (
        <KanbanFab label="Nova campanha" onClick={() => setQuickAddStage("briefing")} />
      )}

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
            const stageCampaigns = campaignsByStage[stage.id] || [];
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
                    <span className="font-bold text-sm" style={{ color: stageTextColor(stage.color) }}>{stage.name}</span>
                    {totalBudget > 0 && <span className="text-xs font-semibold" style={{ color: stageTextColorStrong(stage.color) }}>{formatK(totalBudget)}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm" style={{ color: stageTextColor(stage.color) }}>{stageCampaigns.length}</span>
                    <div onClick={e => e.stopPropagation()}>
                      <KanbanColumnSortMenu
                        criteria={getSortCriteria(stage.id)}
                        onChange={(v) => setSortCriteria(stage.id, v)}
                        options={["recent", "deadline", "value", "alpha"]}
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
                          onDuplicateCard={canWrite ? handleDuplicate : undefined}
                          completeness={getCampaignCompleteness(c)}
                          unread={getCampaignUnread(c)}
                        />
                      ))
                    )}
                    {canWrite && !stage.terminal && (
                      <button
                        onClick={() => setQuickAddStage(stage.id)}
                        className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                        style={{ background: stage.color + "18", color: stageTextColor(stage.color), border: `1px dashed ${stage.color}44` }}
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
            <div
              className="flex gap-2 h-full"
              style={{ minWidth: `${kanbanStages.length * 280}px` }}
            >
              {kanbanStages.map((stage, idx) => {
                const stageCampaigns = campaignsByStage[stage.id] || [];
                const count       = stageCampaigns.length;
                const totalBudget = stageCampaigns.reduce((s, c) => s + (c.budget || 0), 0);
                const isOver      = dragOverStage === stage.id;

                return (
                  <div
                    key={stage.id}
                    onDragOver={e => handleDragOver(e, stage.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={() => handleDrop(stage.id)}
                    className="flex flex-col rounded-lg transition-all duration-150"
                    style={{
                      width: 272,
                      minWidth: 272,
                      height: "100%",
                      overflow: "hidden",
                      borderRight: idx < kanbanStages.length - 1 ? "1px solid var(--border)" : "none",
                      background: "var(--surface-alt)",
                      boxShadow: isOver ? `0 0 0 2px ${stage.color}30` : "none",
                    }}
                  >
                    {/* Reordenar etapas — canal de drag separado do drag de
                        card (draggedColumnKey vs draggedCampaign). Antes o
                        cabeçalho INTEIRO era draggable, competindo com o
                        drag nativo dos cards pelo mesmo container que também
                        é drop-target de card — duas regiões draggable
                        sobrepostas no mesmo pai é instável em Chrome/Firefox
                        (achado BUG-02 da auditoria de QA: maioria das
                        tentativas de mover card falhava silenciosamente).
                        Fix: só a alcinha (GripVertical) abaixo é draggable;
                        o cabeçalho em si só aceita o drop de reordenação,
                        sem iniciar um drag próprio. */}
                    <div
                      onDragOver={e => { if (draggedColumnKey) { e.preventDefault(); e.stopPropagation(); } }}
                      onDrop={e => { if (draggedColumnKey && draggedColumnKey !== stage.id) { e.stopPropagation(); handleColumnDrop(stage.id); } }}
                    >
                      <KanbanColumnHeader
                        color={stage.color}
                        name={stage.name}
                        count={count}
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
                            options={["recent", "deadline", "value", "alpha"]}
                          />
                          {canWrite && (
                            <span
                              draggable
                              onDragStart={() => setDraggedColumnKey(stage.id)}
                              onDragEnd={handleColumnDragEnd}
                              title="Arrastar para reordenar etapa"
                              className="flex items-center justify-center rounded-md"
                              style={{ width: 20, height: 26, color: "var(--text-faint)", flexShrink: 0, cursor: "grab" }}
                            >
                              <GripVertical size={14} />
                            </span>
                          )}
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
                        </>}
                      >
                        <div className="text-xs mt-0.5 font-semibold" style={{ color: "var(--text-dim)" }}>
                          {totalBudget > 0 ? formatK(totalBudget) : "R$ 0"}
                          {stage.sla && <span style={{ fontWeight: 400, marginLeft: 6 }}>· SLA {stage.sla}d</span>}
                        </div>
                      </KanbanColumnHeader>
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
                            onDuplicateCard={canWrite ? handleDuplicate : undefined}
                            completeness={getCampaignCompleteness(c)}
                            unread={getCampaignUnread(c)}
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

      {/* Aba Análise — dashboard dos dados das campanhas. Saiu de baixo do
          board Kanban (acordeão) a pedido do Daniel, e virou visualização
          própria ao lado de "Calendário". */}
      {!loading && !loadingStages && viewMode === "analytics" && (
        <KanbanAnalyticsPanel
          stages={analyticsStages}
          records={filteredCampaigns}
          getStageKey={c => c.stage}
          getStageEnteredAt={c => c.stageChangedAt}
          specificStats={campaignSpecificStats}
          getOwnerIds={getCampaignOwnerIds}
          usersById={usersById}
        />
      )}

      {!loading && !loadingStages && viewMode === "kanban" && (
        <div ref={trailingRef}>
          <p className="text-xs text-center mt-3" style={{ color: "var(--text-dim)" }}>
            Arraste para mover · Use "+" no cabeçalho ou o botão flutuante para criar · Clique no card para ver detalhes
          </p>
        </div>
      )}

      {/* Detail drawer */}
      {syncSelected && (
        <CampaignDetailDrawer
          campaign={syncSelected}
          onClose={() => setSelected(null)}
          onStageMoved={reopenCampaignAfterMove}
          onUpdate={handleUpdate}
          onMoveToStage={attemptStageChange}
          onDelete={handleDelete}
          users={Array.from(usersById.values())}
          canWrite={canWrite}
          currentUser={user}
          notifyMentions={notifyMentions}
          stages={kanbanStages}
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
          domain="marketing"
          stageKey={fieldEditorStage?.id}
          stageName={fieldEditorStage?.name}
          records={campaigns}
          stageField="stage"
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
