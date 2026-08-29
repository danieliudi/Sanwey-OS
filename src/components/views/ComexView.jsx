import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Package, Globe2, Plus, X, Settings2, LayoutGrid, List, TrendingUp,
  Calculator, AlertCircle, Check, DollarSign, CalendarDays, ChevronLeft, ChevronRight, Download,
} from "lucide-react";
import { isSupabaseConfigured } from "../../lib/supabase";
import { exportComexOperationsToCSV } from "../../utils/export-csv";
import { useComexImportOperations } from "../../hooks/use-comex-import-operations";
import { useComexExportOperations } from "../../hooks/use-comex-export-operations";
import { useRHPipelineStages } from "../../hooks/use-rh-pipeline-stages";
import { useRHStageFields } from "../../hooks/use-rh-stage-fields";
import { RHStageFieldsPanel } from "../shared/stage-editor/RHStageFieldsPanel";
import { StageColorPicker } from "../shared/stage-editor/StageColorPicker";
import { RHStageFieldInput } from "../rh-pipeline/RHStageFieldInput";
import { RHKanbanCard } from "../rh-pipeline/RHKanbanCard";
import { RHMobileKanbanAccordion } from "../rh-pipeline/RHMobileKanbanAccordion";
import { RHDetailDrawerShell, RHDetailComments } from "../rh-pipeline/RHDetailDrawerShell";
import { StageNavigator } from "../shared/StageNavigator";
import { SplitPanelDrawer } from "../shared/SplitPanelDrawer";
import { useRecordViews } from "../../hooks/use-record-views";
import { hasUnreadRHComment } from "../../lib/comment-badge";
import { resolveVisibleFields, getMissingRequiredFields, getFieldCompleteness, isStageRegression } from "../../utils/field-conditions";
import { getInvalidFields } from "../../utils/field-validation";
import { reopenAfterMove } from "../../utils/reopen-after-move";
import { getMentionableUsers } from "../../utils/mentionable-users";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { useAvailableHeight } from "../../hooks/use-available-height";
import { KanbanFab } from "../shared/KanbanFab";
import { KanbanColumnHeader } from "../shared/KanbanColumnHeader";
import { KanbanColumnSortMenu } from "../shared/KanbanColumnSortMenu";
import { useKanbanColumnSort } from "../../hooks/use-kanban-sort";
import { sortKanbanItems } from "../../utils/kanban-sort";
import { KanbanBoardHeader } from "../shared/KanbanBoardHeader";
import { KanbanBoardScrollArea } from "../shared/KanbanBoardScrollArea";
import { AppToast } from "../shared/AppToast";
import { ViewToggleButton } from "../shared/ViewToggleButton";
import { KanbanAnalyticsPanel } from "../shared/KanbanAnalyticsPanel";
import { AssigneeMultiSelect } from "../shared/AssigneeMultiSelect";
import { AvatarStack } from "../shared/AvatarStack";
import { MobileTableCards } from "../shared/MobileTableCards";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import { formatBRL, formatK, formatCurrency, calculateLandedCost } from "../../utils/currency";
import { stageTextColor } from "../../utils/stage-colors";

// ── helpers genéricos (compartilhados pelos 2 boards) ───────────────────────

function findStage(stages, stageKey) {
  return stages.find((s) => s.stageKey === stageKey) || stages[0] || { name: "—", color: "#8A8680", stageKey };
}

function daysInStage(dateStr) {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function isThisMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function ownerAvatars(op, users) {
  return (op.ownerIds || []).map((id) => users.find((u) => u.id === id)).filter(Boolean);
}

const labelSt = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };
const inputSt = { borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)", fontSize: 13 };
const miniLabelSt = { fontSize: 11, color: "var(--text-dim)", marginBottom: 3, display: "block" };

// ── Nova etapa (local ao arquivo — mesmo molde de RHFeriasView.jsx) ─────────

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
            <input autoFocus type="text" placeholder="Ex.: Em análise"
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

// ── Modal de criação de operação (mínima — resto se preenche no drawer) ────

function CreateOperationModal({ title, fields, users, onSave, onClose }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map(f => [f.key, ""])));
  const [companyIds, setCompanyIds] = useState([]);
  const [ownerIds, setOwnerIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Junta todos os campos faltando de uma vez (padrão RH Vaga), em vez de
    // parar no primeiro — achado da spec de melhoria do form.
    const missingLabels = [
      ...fields.filter(f => f.required && !String(values[f.key] || "").trim()).map(f => f.label),
      ...(companyIds.length === 0 ? ["Empresa"] : []),
      ...(ownerIds.length === 0 ? ["Responsáveis"] : []),
    ];
    if (missingLabels.length > 0) { setError(`Informe: ${missingLabels.join(", ")}.`); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({ ...values, companyIds, ownerIds });
      onClose();
    } catch (err) {
      setError(err?.message || "Erro ao criar operação.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "var(--shadow-pop)" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{title}</div>
          <button type="button" onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 6, borderRadius: 8, display: "flex" }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {fields.map((f, i) => (
            <div key={f.key}>
              <label style={labelSt}>{f.label}{f.required ? " *" : ""}</label>
              <input
                autoFocus={i === 0}
                type="text"
                value={values[f.key]}
                onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full text-sm rounded-xl border px-3 py-2 outline-none"
                style={inputSt}
              />
            </div>
          ))}
          <div>
            <label style={labelSt}>Empresa *</label>
            <CompanyPillSelect value={companyIds} onChange={setCompanyIds} />
          </div>
          <div>
            <label style={labelSt}>Responsáveis *</label>
            <AssigneeMultiSelect value={ownerIds} onChange={setOwnerIds} options={users} placeholder="Selecionar responsáveis…" />
          </div>
          {error && (
            <div style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>{error}</div>
          )}
          <button type="submit" disabled={saving} style={{ background: "var(--accent)", color: "var(--on-accent)", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, border: "none", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Criando…" : "Criar operação"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Seletor de empresa (pills — mesmo padrão inline de MarketingTarefasView,
// não existe componente compartilhado dedicado hoje) ────────────────────────

function CompanyPillSelect({ value = [], onChange, disabled }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {COMPANY_IDS.map((id) => {
        const co = COMPANIES[id];
        const sel = value.includes(id);
        return (
          <button
            key={id} type="button" disabled={disabled}
            onClick={() => onChange(sel ? value.filter(v => v !== id) : [...value, id])}
            style={{ padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, border: `1px solid ${sel ? co.primary : "var(--border)"}`, background: sel ? co.primary + "22" : "var(--surface)", color: sel ? co.primary : "var(--text-dim)", cursor: disabled ? "default" : "pointer" }}
          >
            {co.short}
          </button>
        );
      })}
    </div>
  );
}

// ── Campos base — Importação (ficam no painel esquerdo do drawer; o "Form"
// central é reservado pros campos por etapa + calculadora, ver spec) ───────

function ImportSupplierField({ op, onSave, disabled }) {
  const [draft, setDraft] = useState(op.supplierName ?? "");
  useEffect(() => { setDraft(op.supplierName ?? ""); }, [op.supplierName]);
  return (
    <div>
      <div style={labelSt}>Fornecedor</div>
      <input
        disabled={disabled} type="text" value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { if (draft !== (op.supplierName ?? "")) onSave({ supplierName: draft || null }); }}
        placeholder="Nome do fornecedor"
        className="w-full text-sm rounded-lg border px-3 py-2 outline-none"
        style={inputSt}
      />
    </div>
  );
}

function ImportCurrencyField({ op, onSave, disabled }) {
  return (
    <div>
      <div style={labelSt}>Moeda</div>
      <select disabled={disabled} value={op.currency || "USD"} onChange={e => onSave({ currency: e.target.value })}
        className="w-full text-sm rounded-lg border px-3 py-2 outline-none" style={inputSt}>
        <option value="USD">USD</option>
        <option value="EUR">EUR</option>
        <option value="JPY">JPY</option>
      </select>
    </div>
  );
}

// ── Calculadora de Landed Cost (só Importação — Exportação não fecha custo
// nacionalizado, fecha preço de venda; ver docs/design-spec-comex.md §5) ───

function LandedCostCalculator({ op, onSave, disabled }) {
  const [draft, setDraft] = useState({});
  useEffect(() => { setDraft({}); }, [op.id]);

  const val = (key) => (key in draft ? draft[key] : (op[key] ?? ""));
  const handleChange = (key, raw) => setDraft(prev => ({ ...prev, [key]: raw }));
  const handleBlur = (key) => {
    const raw = val(key);
    const num = raw === "" ? null : Number(raw);
    onSave({ [key]: Number.isFinite(num) ? num : null });
  };

  const merged = {
    fobValue:           draft.fobValue ?? op.fobValue,
    freightValue:       draft.freightValue ?? op.freightValue,
    insuranceValue:     draft.insuranceValue ?? op.insuranceValue,
    ptaxRate:           draft.ptaxRate ?? op.ptaxRate,
    estimatedTaxesBrl:  draft.estimatedTaxesBrl ?? op.estimatedTaxesBrl,
    estimatedFeesBrl:   draft.estimatedFeesBrl ?? op.estimatedFeesBrl,
  };
  const { cifValueForeign, cifValueBrl, totalTaxesFeesBrl, landedCostBrl } = calculateLandedCost(merged);

  const fieldsCfg = [
    { key: "fobValue",          label: `FOB / FCA (${op.currency})` },
    { key: "freightValue",      label: `Frete internacional (${op.currency})` },
    { key: "insuranceValue",    label: `Seguro internacional (${op.currency})` },
    { key: "ptaxRate",          label: "PTAX do dia" },
    { key: "estimatedTaxesBrl", label: "Impostos estimados (BRL)" },
    { key: "estimatedFeesBrl",  label: "Taxas/despesas estimadas (BRL)" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Calculator size={13} style={{ color: "var(--text-dim)" }} />
        <div style={{ ...labelSt, marginBottom: 0 }}>Calculadora de Landed Cost</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        {fieldsCfg.map(f => (
          <div key={f.key}>
            <label style={miniLabelSt}>{f.label}</label>
            <input
              type="number" step="0.0001" disabled={disabled}
              value={val(f.key)}
              onChange={e => handleChange(f.key, e.target.value)}
              onBlur={() => handleBlur(f.key)}
              placeholder="0,00"
              className="w-full text-sm rounded-lg border px-3 py-2 outline-none"
              style={inputSt}
            />
          </div>
        ))}
      </div>
      <div style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-dim)" }}>
          <span>CIF ({op.currency})</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(cifValueForeign, op.currency)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-dim)" }}>
          <span>CIF em BRL (PTAX)</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatBRL(cifValueBrl)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-dim)" }}>
          <span>Impostos + taxas (BRL)</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatBRL(totalTaxesFeesBrl)}</span>
        </div>
        <div style={{ height: 1, background: "var(--border)", margin: "2px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>Landed Cost total</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
            {formatBRL(landedCostBrl)}
          </span>
        </div>
      </div>
      <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 6 }}>
        PTAX do dia — digite manualmente (sem integração automática nesta fase).
      </div>
    </div>
  );
}

// ── Dados da venda (só Exportação — sem calculadora de Landed Cost, ver spec) ─

function ExportSaleFields({ op, onSave, disabled }) {
  const [draft, setDraft] = useState({});
  useEffect(() => { setDraft({}); }, [op.id]);

  const val = (key) => (key in draft ? draft[key] : (op[key] ?? ""));
  const handleChange = (key, raw) => setDraft(prev => ({ ...prev, [key]: raw }));
  const commitText = (key) => onSave({ [key]: val(key) === "" ? null : val(key) });
  const commitNumber = (key) => {
    const raw = val(key);
    const num = raw === "" ? null : Number(raw);
    onSave({ [key]: Number.isFinite(num) ? num : null });
  };

  const saleValue = val("saleValue");
  const ptaxRate = val("ptaxRate");
  const saleValueBrl = (saleValue !== "" && ptaxRate !== "" && Number.isFinite(Number(saleValue)) && Number.isFinite(Number(ptaxRate)))
    ? Number(saleValue) * Number(ptaxRate)
    : null;

  return (
    <div>
      <div style={labelSt}>Dados da venda</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <label style={miniLabelSt}>Comprador</label>
          <input disabled={disabled} type="text" value={val("buyerName")} onChange={e => handleChange("buyerName", e.target.value)} onBlur={() => commitText("buyerName")}
            className="w-full text-sm rounded-lg border px-3 py-2 outline-none" style={inputSt} />
        </div>
        <div>
          <label style={miniLabelSt}>País do comprador</label>
          <input disabled={disabled} type="text" value={val("buyerCountry")} onChange={e => handleChange("buyerCountry", e.target.value)} onBlur={() => commitText("buyerCountry")}
            className="w-full text-sm rounded-lg border px-3 py-2 outline-none" style={inputSt} />
        </div>
        <div>
          <label style={miniLabelSt}>Moeda</label>
          <select disabled={disabled} value={op.currency || "USD"} onChange={e => onSave({ currency: e.target.value })}
            className="w-full text-sm rounded-lg border px-3 py-2 outline-none" style={inputSt}>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="JPY">JPY</option>
          </select>
        </div>
        <div>
          <label style={miniLabelSt}>Valor da venda ({op.currency})</label>
          <input disabled={disabled} type="number" step="0.01" value={val("saleValue")} onChange={e => handleChange("saleValue", e.target.value)} onBlur={() => commitNumber("saleValue")}
            placeholder="0,00" className="w-full text-sm rounded-lg border px-3 py-2 outline-none" style={inputSt} />
        </div>
        <div>
          <label style={miniLabelSt}>PTAX do dia</label>
          <input disabled={disabled} type="number" step="0.0001" value={val("ptaxRate")} onChange={e => handleChange("ptaxRate", e.target.value)} onBlur={() => commitNumber("ptaxRate")}
            placeholder="0,00" className="w-full text-sm rounded-lg border px-3 py-2 outline-none" style={inputSt} />
        </div>
      </div>
      {saleValueBrl !== null && (
        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
          Equivalente em BRL: <b style={{ color: "var(--text)" }}>{formatBRL(saleValueBrl)}</b>
        </div>
      )}
    </div>
  );
}

// ── Corpo do card do Kanban ──────────────────────────────────────────────────

function ImportCardBody({ op, users }) {
  const hasCalc = Boolean(op.ptaxRate) && Boolean(op.fobValue || op.freightValue || op.insuranceValue);
  const { landedCostBrl } = calculateLandedCost(op);
  const owners = ownerAvatars(op, users);
  return (
    <>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{op.title}</div>
      {op.supplierName && (
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{op.supplierName}</div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
          <span style={{ padding: "1px 6px", borderRadius: 99, background: "var(--surface-alt)", color: "var(--text-dim)", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{op.currency}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
            {hasCalc ? formatBRL(landedCostBrl) : formatCurrency(op.fobValue, op.currency)}
          </span>
        </div>
        {owners.length > 0 && <AvatarStack users={owners} size={18} max={3} />}
      </div>
      <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 2 }}>{hasCalc ? "Landed Cost estimado" : "FOB"}</div>
    </>
  );
}

function ExportCardBody({ op, users }) {
  const owners = ownerAvatars(op, users);
  return (
    <>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{op.title}</div>
      {(op.buyerName || op.buyerCountry) && (
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {[op.buyerName, op.buyerCountry].filter(Boolean).join(" · ")}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
          <span style={{ padding: "1px 6px", borderRadius: 99, background: "var(--surface-alt)", color: "var(--text-dim)", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{op.currency}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(op.saleValue, op.currency)}</span>
        </div>
        {owners.length > 0 && <AvatarStack users={owners} size={18} max={3} />}
      </div>
    </>
  );
}

// ── Coluna do Kanban (genérica — parametrizada por renderCardBody) ──────────

function ComexKanbanColumn({
  stage, stages, opList, onCardClick, onDragStart, onDragEnd, onMoveToStage, onDeleteOperation, onDuplicateOperation,
  isDragOver, onColumnDragOver, onColumnDragLeave, onColumnDrop,
  canWrite, onEditFields, getCompleteness, getUnread,
  draggedColumnKey, onColumnHeaderDragStart, onColumnHeaderDragEnd, onColumnHeaderDrop,
  renderCardBody, getSortCriteria, setSortCriteria,
}) {
  return (
    <div
      onDragOver={(e) => onColumnDragOver(e, stage.stageKey)}
      onDragLeave={onColumnDragLeave}
      onDrop={() => onColumnDrop(stage.stageKey)}
      className="flex flex-col rounded-lg transition-all duration-150"
      style={{ width: 272, minWidth: 272, height: "100%", overflow: "hidden", borderRight: stage.stageKey !== stages[stages.length - 1]?.stageKey ? "1px solid var(--border)" : "none", background: isDragOver ? stage.color + "14" : "var(--surface-alt)", boxShadow: isDragOver ? `0 0 0 2px ${stage.color}40` : "none" }}
    >
      <div
        draggable={canWrite}
        onDragStart={() => canWrite && onColumnHeaderDragStart(stage.stageKey)}
        onDragEnd={onColumnHeaderDragEnd}
        onDragOver={e => { if (draggedColumnKey) { e.preventDefault(); e.stopPropagation(); } }}
        onDrop={e => { if (draggedColumnKey && draggedColumnKey !== stage.stageKey) { e.stopPropagation(); onColumnHeaderDrop(stage.stageKey); } }}
        style={{ cursor: canWrite ? "grab" : "default" }}
      >
        <KanbanColumnHeader
          color={stage.color}
          name={stage.name}
          count={opList.length}
          bandHeight={4}
          letterSpacing="normal"
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
              {canWrite && (
                <button onClick={() => onEditFields(stage)} title="Editar campos desta etapa" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 2, display: "flex", flexShrink: 0 }}>
                  <Settings2 size={13} />
                </button>
              )}
            </div>
          }
        />
      </div>
      <div style={{ padding: 8, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {opList.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 8px", color: "var(--text-dim)", fontSize: 11, opacity: 0.5, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ opacity: 0.5 }}>Nenhuma operação nesta etapa</span>
            {!stage.terminal && <span style={{ opacity: 0.4, fontSize: 10 }}>Arraste um card aqui ou crie um novo</span>}
          </div>
        ) : (
          opList.map((op) => (
            <RHKanbanCard
              key={op.id}
              id={op.id}
              stage={op.stage}
              stages={stages}
              onClick={() => onCardClick(op)}
              onDragStart={canWrite ? onDragStart : undefined}
              onDragEnd={canWrite ? onDragEnd : undefined}
              onMoveToStage={canWrite ? onMoveToStage : undefined}
              onDeleteCard={canWrite ? onDeleteOperation : undefined}
              onDuplicateCard={canWrite ? onDuplicateOperation : undefined}
              showMoveOptions={false}
              agingDays={daysInStage(op.stageChangedAt)}
              completeness={getCompleteness?.(op)}
              unread={getUnread?.(op)}
            >
              {renderCardBody(op)}
            </RHKanbanCard>
          ))
        )}
      </div>
    </div>
  );
}

// ── Tabela ────────────────────────────────────────────────────────────────

function ComexTableView({ operations, stages, columns, onRowClick }) {
  const valueCol = columns.find(c => c.key === "value");
  const metaCols = columns.slice(1).filter(c => c.key !== "value");
  return (
    <>
    <MobileTableCards
      rows={operations}
      onRowClick={onRowClick}
      emptyMessage="Nenhuma operação encontrada."
      title={(op) => op[columns[0].key] || "—"}
      chips={(op) => {
        const st = findStage(stages, op.stage);
        return [{ label: st.name, color: st.color }];
      }}
      right={valueCol ? (op) => (
        <span className="text-sm font-semibold" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
          {valueCol.render ? valueCol.render(op) : (op[valueCol.key] ?? "—")}
        </span>
      ) : undefined}
      meta={(op) => metaCols.map(c => op[c.key]).filter(Boolean).join(" · ") || "—"}
    />
    <div className="hidden md:block rounded-2xl border overflow-x-auto" style={{ borderColor: "var(--border)" }}>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
            {columns.map(c => (
              <th key={c.key} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>{c.label}</th>
            ))}
            <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Etapa</th>
          </tr>
        </thead>
        <tbody>
          {operations.length === 0 && (
            <tr><td colSpan={columns.length + 1} className="text-center py-10 text-sm" style={{ color: "var(--text-dim)" }}>Nenhuma operação encontrada.</td></tr>
          )}
          {operations.map((op) => {
            const st = findStage(stages, op.stage);
            return (
              <tr key={op.id} onClick={() => onRowClick(op)} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                {columns.map((c, i) => (
                  <td key={c.key} className="px-4 py-3 text-xs" style={{ color: i === 0 ? "var(--text)" : "var(--text-dim)", fontWeight: i === 0 ? 600 : 400 }}>
                    {c.render ? c.render(op) : (op[c.key] ?? "—")}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: st.color + "18", color: stageTextColor(st.color), border: `1px solid ${st.color}40` }}>
                    {st.name}
                  </span>
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

// ── Calendário (mesmo molde de DeliverableCalendarView em EntregasView.jsx —
// Comex não tem data-limite própria hoje, então cada operação é posicionada
// no dia em que entrou na etapa atual, stageChangedAt) ─────────────────────

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

function ComexCalendarView({ operations, stages, onSelect }) {
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
    operations.forEach(op => {
      if (!op.stageChangedAt) { noDate++; return; }
      const key = calDayKey(calStartOfDay(new Date(op.stageChangedAt)));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(op);
    });
    return { byDay: map, noDateCount: noDate };
  }, [operations]);

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
                    {visible.map(op => {
                      const stage = findStage(stages, op.stage);
                      const color = stage.color;
                      return (
                        <button
                          key={op.id}
                          onClick={() => onSelect(op)}
                          title={op.title}
                          className="text-left truncate text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: color + "18", color: stageTextColor(color), border: `1px solid ${color}40`, cursor: "pointer" }}
                        >
                          {op.title}
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
          <div key={s.id} className="flex items-center gap-1.5">
            <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
            <span className="text-xs" style={{ color: "var(--text-dim)" }}>{s.name}</span>
          </div>
        ))}
      </div>

      {noDateCount > 0 && (
        <p className="text-xs mt-2" style={{ color: "var(--text-dim)" }}>
          {noDateCount} operaç{noDateCount > 1 ? "ões" : "ão"} sem data de mudança de etapa não {noDateCount > 1 ? "aparecem" : "aparece"} nesta visão — confira na Tabela ou no Kanban.
        </p>
      )}
    </div>
  );
}

// ── Drawer de detalhe (genérico — parametrizado por renderLeftFields/
// renderFormExtra, únicos pontos onde import/export realmente divergem) ────

function ComexDrawer({
  op, canWrite, stages, users, currentUser,
  stageFieldsHook, fieldsDomain, onUpdateOperation, onMoveToStage, onAddActivity, onUpdateActivity,
  onClose, onMoved, busy, notifyMentions, onDelete, onEditFields,
  renderLeftFields, renderFormExtra, moduleKey, entityLabel,
}) {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const customDefs = stageFieldsHook.getFields(op.stage);
  const [customDraft, setCustomDraft] = useState({});
  const [moveError, setMoveError] = useState(null);

  useEffect(() => { setCustomDraft({}); setMoveError(null); }, [op.id]);

  const handleCustomChange = (fieldKey, value) => {
    setCustomDraft((prev) => ({ ...prev, [fieldKey]: value }));
    const merged = { ...(op.customFields || {}), [fieldKey]: value };
    onUpdateOperation({ customFields: merged });
  };

  const getCustomValue = (fieldKey) =>
    fieldKey in customDraft ? customDraft[fieldKey] : (op.customFields?.[fieldKey] ?? "");

  const customValuesByKey = { ...(op.customFields || {}), ...customDraft };
  const visibleCustomDefs = resolveVisibleFields(customDefs, customValuesByKey);

  const st = findStage(stages, op.stage);
  const moveTargets = stages.filter((s) => s.stageKey !== op.stage);

  const handleMoveClick = async (stageKey) => {
    const ok = await onMoveToStage(op, stageKey, { onBlocked: setMoveError });
    if (ok) { setMoveError(null); onMoved(op.id); }
  };

  const header = (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{op.title}</div>
      <div style={{ marginTop: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${st.color}18`, color: stageTextColor(st.color), borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.color, display: "inline-block" }} /> {st.name}
        </span>
      </div>
    </div>
  );

  // "Campos desta etapa" vira o centro fixo do drawer (padrão platform-wide,
  // CLAUDE.md regra 3/item 2, rodada de 07/08/2026) — não faz mais parte do
  // formContent junto do conteúdo específico de Comex (LandedCostCalculator/
  // ExportSaleFields, que continuam em renderFormExtra).
  const center = visibleCustomDefs.length === 0 ? (
    <button
      onClick={() => onEditFields?.(st)}
      className="text-xs text-center cursor-pointer"
      style={{ background: "none", border: "none", color: "var(--text-dim)", lineHeight: 1.6, padding: "16px 0", textAlign: "center", width: "100%" }}
    >
      Nenhum campo nessa fase. <span style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "underline" }}>Clique aqui para editar essa etapa.</span>
    </button>
  ) : (
    <div>
      <div style={labelSt}>Campos desta etapa</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {visibleCustomDefs.map((f) => (
          <div key={f.id}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
              {f.effectiveRequired && <span style={{ color: "var(--danger)", marginRight: 4 }}>*</span>}
              {f.label}
            </label>
            {f.helpText && <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>{f.helpText}</div>}
            <RHStageFieldInput field={f} value={getCustomValue(f.fieldKey)} onChange={(val) => handleCustomChange(f.fieldKey, val)} users={users} touched={Boolean(moveError)} />
          </div>
        ))}
      </div>
    </div>
  );

  const formContent = renderFormExtra ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {renderFormExtra(op, (patch) => onUpdateOperation(patch), !canWrite)}
    </div>
  ) : null;

  const left = (
    <>
      <div>
        <div style={labelSt}>Empresa(s)</div>
        <CompanyPillSelect value={op.companyIds || []} onChange={(ids) => onUpdateOperation({ companyIds: ids })} disabled={!canWrite} />
      </div>
      <div>
        <div style={labelSt}>Responsáveis</div>
        <AssigneeMultiSelect value={op.ownerIds || []} onChange={(ids) => onUpdateOperation({ ownerIds: ids })} options={users} disabled={!canWrite} placeholder="Selecionar responsáveis…" />
      </div>
      {renderLeftFields && renderLeftFields(op, (patch) => onUpdateOperation(patch), !canWrite)}

      <div style={{ borderTop: "1px solid var(--border)", margin: "12px 0" }} />

      <RHDetailDrawerShell
        domain="comex"
        recordId={op.id}
        activities={op.activities || []}
        onAddActivity={onAddActivity}
        currentUser={currentUser}
        users={users}
        stages={stages}
        formContent={formContent}
        record={op}
        recordTitle={op.title}
        domainLabel="Comex"
        fieldsDomain={fieldsDomain}
      />
    </>
  );

  const right = (
    <>
      {canWrite && moveError && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "var(--danger-bg)", color: "var(--danger)", borderRadius: 10, padding: "8px 12px", fontSize: 12 }}>
          <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          {moveError}
        </div>
      )}

      {canWrite && moveTargets.length > 0 && (
        <div>
          <div style={labelSt}>Mover para</div>
          <StageNavigator targets={moveTargets} onMove={handleMoveClick} getKey={(s) => s.stageKey} disabled={busy} currentStageKey={op.stage} allStages={stages} />
        </div>
      )}

      <RHDetailComments
        activities={op.activities || []}
        onAddActivity={onAddActivity}
        onUpdateActivity={onUpdateActivity ? (activityId, patch) => onUpdateActivity(op.id, activityId, patch) : undefined}
        currentUser={currentUser}
        users={users}
        mentionableUsers={getMentionableUsers(users, { domain: "comex" })}
        notifyMentions={notifyMentions}
        mentionLink={{ module: moduleKey, id: op.id }}
        mentionContextLabel={op.title}
      />

      {canWrite && onEditFields && (
        <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); onEditFields(st); }}
            className="flex items-center gap-2 text-xs"
            style={{ color: "var(--text-dim)", textDecoration: "none" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-dim)"; }}
          >
            <Settings2 size={12} />
            Editar campos desta etapa
          </a>
        </div>
      )}
    </>
  );

  return (
    <SplitPanelDrawer
      onClose={onClose}
      header={header}
      left={left}
      center={center}
      right={right}
      onDelete={canWrite && onDelete ? () => onDelete(op.id) : undefined}
      deleteLabel={`Excluir operação de ${entityLabel}`}
    />
  );
}

// ── Configuração por variante (import/export) — únicos pontos que realmente
// divergem entre os 2 boards, ver docs/design-spec-comex.md ─────────────────

const IMPORT_CONFIG = {
  domain: "comex_importacao",
  label: "Importação",
  icon: Package,
  useOperationsHook: useComexImportOperations,
  moduleKey: "comex_import_operations",
  entityLabel: "importação",
  createTitle: "Nova Operação de Importação",
  createFields: [
    { key: "title", label: "Título", required: true, placeholder: "Ex.: PO #123 — Fornecedor XYZ" },
    { key: "supplierName", label: "Fornecedor", placeholder: "Nome do fornecedor" },
  ],
  buildCreatePayload: (values) => ({ title: values.title.trim(), supplierName: values.supplierName?.trim() || null, companyIds: values.companyIds, ownerIds: values.ownerIds }),
  renderCardBody: (op, users) => <ImportCardBody op={op} users={users} />,
  tableColumns: [
    { key: "title", label: "Título" },
    { key: "supplierName", label: "Fornecedor" },
    { key: "currency", label: "Moeda" },
    {
      key: "value", label: "Valor", render: (op) => {
        const hasCalc = Boolean(op.ptaxRate) && Boolean(op.fobValue || op.freightValue || op.insuranceValue);
        const { landedCostBrl } = calculateLandedCost(op);
        return hasCalc ? formatBRL(landedCostBrl) : formatCurrency(op.fobValue, op.currency);
      },
    },
  ],
  renderLeftFields: (op, onSave, disabled) => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <ImportSupplierField op={op} onSave={onSave} disabled={disabled} />
      <ImportCurrencyField op={op} onSave={onSave} disabled={disabled} />
    </div>
  ),
  renderFormExtra: (op, onSave, disabled) => <LandedCostCalculator op={op} onSave={onSave} disabled={disabled} />,
  buildStats: (operations, stages) => {
    const total = operations.length;
    const wonStage = stages.find(s => s.terminal && s.won);
    const recebidasMes = wonStage ? operations.filter(o => o.stage === wonStage.stageKey && isThisMonth(o.stageChangedAt)).length : 0;
    const landedTotal = operations.reduce((sum, o) => (o.ptaxRate ? sum + calculateLandedCost(o).landedCostBrl : sum), 0);
    return [
      { label: "Operações",                     value: total,              icon: <Package size={14} style={{ color: "var(--text)" }} /> },
      { label: "Recebidas este mês",             value: recebidasMes,       icon: <Check size={14} style={{ color: "var(--success)" }} /> },
      { label: "Landed Cost total estimado",     value: formatK(landedTotal), icon: <Calculator size={14} style={{ color: "var(--accent)" }} /> },
    ];
  },
  buildSpecificStats: (operations) => {
    const withCalc = operations.filter(o => o.ptaxRate);
    const avg = withCalc.length > 0 ? withCalc.reduce((s, o) => s + calculateLandedCost(o).landedCostBrl, 0) / withCalc.length : 0;
    const vermelho = operations.filter(o => o.customFields?.rfb_channel === "Vermelho").length;
    return [
      { label: "Landed Cost médio",    value: withCalc.length > 0 ? formatBRL(avg) : "—" },
      { label: "Canal RFB Vermelho",   value: String(vermelho) },
    ];
  },
};

const EXPORT_CONFIG = {
  domain: "comex_exportacao",
  label: "Exportação",
  icon: Globe2,
  useOperationsHook: useComexExportOperations,
  moduleKey: "comex_export_operations",
  entityLabel: "exportação",
  createTitle: "Nova Operação de Exportação",
  createFields: [
    { key: "title", label: "Título", required: true, placeholder: "Ex.: PI #456 — Comprador ABC (México)" },
    { key: "buyerName", label: "Comprador", placeholder: "Nome do comprador" },
  ],
  buildCreatePayload: (values) => ({ title: values.title.trim(), buyerName: values.buyerName?.trim() || null, companyIds: values.companyIds, ownerIds: values.ownerIds }),
  renderCardBody: (op, users) => <ExportCardBody op={op} users={users} />,
  tableColumns: [
    { key: "title", label: "Título" },
    { key: "buyerName", label: "Comprador" },
    { key: "buyerCountry", label: "País" },
    { key: "value", label: "Valor", render: (op) => formatCurrency(op.saleValue, op.currency) },
  ],
  renderLeftFields: null,
  renderFormExtra: (op, onSave, disabled) => <ExportSaleFields op={op} onSave={onSave} disabled={disabled} />,
  buildStats: (operations, stages) => {
    const total = operations.length;
    const wonStage = stages.find(s => s.terminal && s.won);
    const liquidadasMes = wonStage ? operations.filter(o => o.stage === wonStage.stageKey && isThisMonth(o.stageChangedAt)).length : 0;
    const totalBrl = operations.reduce((sum, o) => (o.saleValue && o.ptaxRate ? sum + Number(o.saleValue) * Number(o.ptaxRate) : sum), 0);
    return [
      { label: "Operações",              value: total,          icon: <Globe2 size={14} style={{ color: "var(--text)" }} /> },
      { label: "Liquidadas este mês",    value: liquidadasMes,  icon: <Check size={14} style={{ color: "var(--success)" }} /> },
      { label: "Valor total em vendas",  value: formatK(totalBrl), icon: <DollarSign size={14} style={{ color: "var(--accent)" }} /> },
    ];
  },
  buildSpecificStats: (operations) => {
    const withSale = operations.filter(o => o.saleValue);
    const avg = withSale.length > 0 ? withSale.reduce((s, o) => s + Number(o.saleValue), 0) / withSale.length : 0;
    const countries = new Set(operations.map(o => o.buyerCountry).filter(Boolean));
    return [
      { label: "Valor médio por operação", value: withSale.length > 0 ? formatCurrency(avg, "USD") : "—" },
      { label: "Países atendidos",          value: String(countries.size) },
    ];
  },
};

// ── Board (genérico — instanciado 1x por variante, chamado por ComexView) ──

function ComexBoard({ config, currentUser, users, canWrite, notifyMentions, headerExtra }) {
  const { operations, loading: loadingOps, createOperation, updateOperation, deleteOperation, duplicateOperation, changeStage } =
    config.useOperationsHook({ userId: currentUser?.id, role: currentUser?.role, roles: currentUser?.roles });
  const { stages, loading: loadingStages, addStage, reorderStages } = useRHPipelineStages(config.domain);
  const stageFieldsHook = useRHStageFields(config.domain);

  const [viewMode, setViewMode]     = useState("kanban"); // "kanban" | "table" | "calendar" | "analytics"
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId]         = useState(null);
  const [boardError, setBoardError] = useState(null);
  const [drawerOpId, setDrawerOpId] = useState(null);
  const [fieldEditorStage, setFieldEditorStage] = useState(null);
  const [addingStage, setAddingStage]     = useState(false);
  const [draggedColumnKey, setDraggedColumnKey] = useState(null);
  const [draggedId, setDraggedId]         = useState(null);
  const [dragOverStageKey, setDragOverStageKey] = useState(null);
  const [boardRef, boardHeight] = useAvailableHeight(16, [viewMode, loadingOps, loadingStages]);

  const { viewedAt, markViewed } = useRecordViews(config.moduleKey, currentUser?.id);
  useEffect(() => { if (drawerOpId) markViewed(drawerOpId); }, [drawerOpId]);

  const loading = loadingOps || loadingStages;

  // Campo obrigatório trava AVANÇAR, não VOLTAR — voltar não conclui a etapa,
  // então não cobra o formulário dela (ver isStageRegression).
  const getStageBlockMessage = useCallback((op, toStage) => {
    if (isStageRegression(stages, op.stage, toStage)) return null;
    const fields = stageFieldsHook.getFields(op.stage);
    const missing = getMissingRequiredFields(fields, op.customFields || {});
    if (missing.length > 0) {
      return `Não dá pra mover: preencha antes — ${missing.map(f => f.label).join(", ")}.`;
    }
    const invalid = getInvalidFields(fields, op.customFields || {});
    if (invalid.length > 0) {
      return `Não dá pra mover: corrija antes — ${invalid.map(f => `${f.label} (${f.validationError})`).join(", ")}.`;
    }
    return null;
  }, [stageFieldsHook, stages]);

  const handleMoveToStageGeneric = useCallback(async (op, stageKey, { onBlocked } = {}) => {
    const blockMsg = getStageBlockMessage(op, stageKey);
    if (blockMsg) { (onBlocked || setBoardError)(blockMsg); return false; }
    setBusyId(op.id);
    try {
      await changeStage(op.id, stageKey);
      return true;
    } catch (e) {
      setBoardError(e?.message || "Não foi possível mover — tente novamente.");
      return false;
    } finally {
      setBusyId(null);
    }
  }, [changeStage, getStageBlockMessage]);

  const handleMoveToStage = useCallback((id, stageKey) => {
    const op = operations.find(o => o.id === id);
    if (!op) return;
    handleMoveToStageGeneric(op, stageKey);
  }, [operations, handleMoveToStageGeneric]);

  const handleDuplicateOperation = useCallback(async (id) => {
    const source = operations.find(o => o.id === id);
    if (!source) return;
    const firstStage = stages.find(s => !s.terminal) || stages[0];
    await duplicateOperation(source, firstStage?.stageKey);
  }, [operations, stages, duplicateOperation]);

  const handleColumnDrop = useCallback((stageKey) => {
    if (draggedId) {
      const op = operations.find(o => o.id === draggedId);
      if (op && op.stage !== stageKey) handleMoveToStageGeneric(op, stageKey);
    }
    setDraggedId(null);
    setDragOverStageKey(null);
  }, [draggedId, operations, handleMoveToStageGeneric]);

  const handleStageReorderDragEnd = useCallback(() => setDraggedColumnKey(null), []);
  const handleStageReorderDrop = useCallback((targetStageKey) => {
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

  const handleAddActivity = useCallback(async (id, entry) => {
    const current = operations.find(o => o.id === id);
    if (!current) return;
    const nextActivities = [...(Array.isArray(current.activities) ? current.activities : []), entry];
    await updateOperation(id, { activities: nextActivities });
  }, [operations, updateOperation]);

  const handleUpdateActivity = useCallback(async (id, activityId, patch) => {
    const current = operations.find(o => o.id === id);
    if (!current) return;
    const nextActivities = (Array.isArray(current.activities) ? current.activities : [])
      .map(a => (a.id === activityId ? { ...a, ...patch } : a));
    await updateOperation(id, { activities: nextActivities });
  }, [operations, updateOperation]);

  const handleCreate = useCallback(async (values) => {
    await createOperation(config.buildCreatePayload(values));
  }, [createOperation, config]);

  const getOpCompleteness = useCallback(
    (op) => getFieldCompleteness(stageFieldsHook.getFields(op.stage), op.customFields || {}),
    [stageFieldsHook]
  );

  const stats = useMemo(() => config.buildStats(operations, stages), [operations, stages, config]);
  const specificStats = useMemo(() => config.buildSpecificStats(operations), [operations, config]);

  const { getCriteria: getSortCriteria, setCriteria: setSortCriteria } = useKanbanColumnSort(`comex-${config.domain}`);
  const opsByStage = useMemo(() => {
    const map = {};
    const defaultStageKey = stages[0]?.stageKey;
    stages.forEach(s => {
      const list = operations.filter(o => (o.stage || defaultStageKey) === s.stageKey);
      map[s.stageKey] = sortKanbanItems(list, getSortCriteria(s.stageKey), {
        value: o => o.saleValue,
        name: o => o.title,
        createdAt: o => o.createdAt,
      });
    });
    return map;
  }, [operations, stages, getSortCriteria]);

  const drawerOp = drawerOpId ? operations.find(o => o.id === drawerOpId) : null;

  const analyticsStages = useMemo(
    () => stages.filter(s => !s.terminal).map(s => ({ key: s.stageKey, name: s.name, color: s.color, slaDays: s.slaDays })),
    [stages]
  );

  const usersById = useMemo(() => new Map((users || []).map(u => [u.id, u])), [users]);

  const Icon = config.icon;

  return (
    <div>
      {boardError && (
        <AppToast variant="danger" position="top-right" icon={AlertCircle} onDismiss={() => setBoardError(null)}>
          {boardError}
        </AppToast>
      )}

      <KanbanBoardHeader className="mb-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Icon size={22} style={{ color: "var(--text)" }} />
                <h1 style={{ fontWeight: 700, fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>Comex</h1>
              </div>
              {headerExtra}
            </div>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
              {config.label} Direta · {operations.length} operaç{operations.length !== 1 ? "ões" : "ão"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }} role="tablist">
              <ViewToggleButton active={viewMode === "kanban"}    onClick={() => setViewMode("kanban")}    icon={LayoutGrid}    label="Kanban" iconOnlyMobile />
              <ViewToggleButton active={viewMode === "table"}     onClick={() => setViewMode("table")}     icon={List}          label="Tabela" iconOnlyMobile />
              <ViewToggleButton active={viewMode === "calendar"}  onClick={() => setViewMode("calendar")}  icon={CalendarDays}  label="Calendário" iconOnlyMobile />
              <ViewToggleButton active={viewMode === "analytics"} onClick={() => setViewMode("analytics")} icon={TrendingUp}    label="Análise" iconOnlyMobile />
            </div>
            <Button size="sm" variant="secondary" icon={Download} onClick={() => exportComexOperationsToCSV(operations, { stages })}>Exportar CSV</Button>
            {canWrite && <Button size="sm" icon={Plus} onClick={() => setShowCreate(true)}>Nova operação</Button>}
          </div>
        </div>
      </KanbanBoardHeader>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border transition-shadow duration-150"
            style={{ background: "var(--surface)", borderColor: "var(--border)", padding: "12px 16px", boxShadow: "var(--shadow-card)" }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-pop)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-card)"; e.currentTarget.style.borderColor = "var(--border)"; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
              {s.icon}
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)", fontSize: 13 }}>Carregando…</div>
      ) : !isSupabaseConfigured ? (
        <EmptyState icon={Icon} title="Supabase não configurado" description="Configure as variáveis de ambiente para usar este módulo." />
      ) : viewMode === "table" ? (
        <ComexTableView operations={operations} stages={stages} columns={config.tableColumns} onRowClick={(o) => setDrawerOpId(o.id)} />
      ) : viewMode === "calendar" ? (
        <ComexCalendarView operations={operations} stages={stages} onSelect={(o) => setDrawerOpId(o.id)} />
      ) : viewMode === "analytics" ? (
        <KanbanAnalyticsPanel
          stages={analyticsStages}
          records={operations}
          getStageKey={(o) => o.stage}
          getStageEnteredAt={(o) => o.stageChangedAt}
          specificStats={specificStats}
          getOwnerIds={(o) => o.ownerIds || []}
          usersById={usersById}
        />
      ) : (
        <>
          <RHMobileKanbanAccordion
            stages={stages}
            itemsByStage={opsByStage}
            getSortCriteria={getSortCriteria}
            setSortCriteria={setSortCriteria}
            sortOptions={["recent", "value", "alpha"]}
            renderCard={(op) => (
              <RHKanbanCard
                key={op.id}
                id={op.id}
                stage={op.stage}
                stages={stages}
                onClick={() => setDrawerOpId(op.id)}
                onDragStart={canWrite ? setDraggedId : undefined}
                onDragEnd={canWrite ? () => { setDraggedId(null); setDragOverStageKey(null); } : undefined}
                onMoveToStage={canWrite ? handleMoveToStage : undefined}
                onDeleteCard={canWrite ? deleteOperation : undefined}
                onDuplicateCard={canWrite ? handleDuplicateOperation : undefined}
                agingDays={daysInStage(op.stageChangedAt)}
                completeness={getOpCompleteness(op)}
                unread={hasUnreadRHComment(op, viewedAt, currentUser?.id)}
              >
                {config.renderCardBody(op, users)}
              </RHKanbanCard>
            )}
            emptyLabel="Nada aqui"
          />
          {canWrite && (
            <button
              onClick={() => setAddingStage(true)}
              className="lg:hidden w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 border-dashed text-xs font-semibold"
              style={{ borderColor: "var(--border-strong)", color: "var(--text-dim)", background: "var(--surface)", cursor: "pointer" }}
            >
              <Plus size={13} />
              Nova etapa
            </button>
          )}
          <div className="hidden lg:block">
            <KanbanBoardScrollArea scrollRef={boardRef} height={boardHeight}>
              <div className="flex gap-2 h-full" style={{ minWidth: `${stages.length * 280}px` }}>
                {stages.map((stage) => (
                  <ComexKanbanColumn
                    key={stage.id}
                    stage={stage}
                    stages={stages}
                    opList={opsByStage[stage.stageKey] || []}
                    onCardClick={(o) => setDrawerOpId(o.id)}
                    onDragStart={setDraggedId}
                    onDragEnd={() => { setDraggedId(null); setDragOverStageKey(null); }}
                    onMoveToStage={handleMoveToStage}
                    onDeleteOperation={canWrite ? deleteOperation : undefined}
                    onDuplicateOperation={canWrite ? handleDuplicateOperation : undefined}
                    isDragOver={dragOverStageKey === stage.stageKey}
                    onColumnDragOver={(e, key) => { e.preventDefault(); setDragOverStageKey(key); }}
                    onColumnDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStageKey(null); }}
                    onColumnDrop={handleColumnDrop}
                    canWrite={canWrite}
                    onEditFields={setFieldEditorStage}
                    getCompleteness={getOpCompleteness}
                    getUnread={(o) => hasUnreadRHComment(o, viewedAt, currentUser?.id)}
                    draggedColumnKey={draggedColumnKey}
                    onColumnHeaderDragStart={setDraggedColumnKey}
                    onColumnHeaderDragEnd={handleStageReorderDragEnd}
                    onColumnHeaderDrop={handleStageReorderDrop}
                    renderCardBody={(op) => config.renderCardBody(op, users)}
                    getSortCriteria={getSortCriteria}
                    setSortCriteria={setSortCriteria}
                  />
                ))}
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
        </>
      )}

      {!loading && isSupabaseConfigured && (
        <KanbanFab label="Nova operação" onClick={canWrite ? () => setShowCreate(true) : undefined} />
      )}

      {showCreate && (
        <CreateOperationModal
          title={config.createTitle}
          fields={config.createFields}
          users={users}
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}

      {drawerOp && (
        <ComexDrawer
          op={drawerOp}
          canWrite={canWrite}
          stages={stages}
          users={users}
          currentUser={currentUser}
          stageFieldsHook={stageFieldsHook}
          fieldsDomain={config.domain}
          onUpdateOperation={(patch) => updateOperation(drawerOp.id, patch).catch((e) => setBoardError(e?.message || "Erro ao salvar."))}
          onMoveToStage={handleMoveToStageGeneric}
          onAddActivity={(entry) => handleAddActivity(drawerOp.id, entry)}
          onUpdateActivity={handleUpdateActivity}
          onClose={() => setDrawerOpId(null)}
          onMoved={(id) => { setDrawerOpId(null); reopenAfterMove(setDrawerOpId, id); }}
          busy={busyId === drawerOp.id}
          notifyMentions={notifyMentions}
          onDelete={deleteOperation}
          onEditFields={setFieldEditorStage}
          renderLeftFields={config.renderLeftFields}
          renderFormExtra={config.renderFormExtra}
          moduleKey={config.moduleKey}
          entityLabel={config.entityLabel}
        />
      )}

      {canWrite && (
        <RHStageFieldsPanel
          open={!!fieldEditorStage}
          onClose={() => setFieldEditorStage(null)}
          domain={config.domain}
          stageKey={fieldEditorStage?.stageKey}
          stageName={fieldEditorStage?.name}
          records={operations}
          stageField="stage"
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
    </div>
  );
}

// ── View principal — toggle Importação/Exportação (mesma ideia do toggle
// Vagas/Candidatos de RHRecrutamentoView.jsx) ───────────────────────────────

export function ComexView({ currentUser, users = [], canWrite, notifyMentions }) {
  const [subView, setSubView] = useState("importacao"); // "importacao" | "exportacao"

  const subViewToggle = (
    <div style={{ display: "flex", gap: 4, background: "var(--surface-alt)", borderRadius: 10, padding: 3 }}>
      <button
        onClick={() => setSubView("importacao")}
        style={{ background: subView === "importacao" ? "var(--surface)" : "transparent", color: subView === "importacao" ? "var(--text)" : "var(--text-dim)", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: subView === "importacao" ? "0 1px 2px rgba(0,0,0,0.08)" : "none" }}
      >
        Importação
      </button>
      <button
        onClick={() => setSubView("exportacao")}
        style={{ background: subView === "exportacao" ? "var(--surface)" : "transparent", color: subView === "exportacao" ? "var(--text)" : "var(--text-dim)", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: subView === "exportacao" ? "0 1px 2px rgba(0,0,0,0.08)" : "none" }}
      >
        Exportação
      </button>
    </div>
  );

  return subView === "importacao" ? (
    <ComexBoard key="comex-importacao" config={IMPORT_CONFIG} currentUser={currentUser} users={users} canWrite={canWrite} notifyMentions={notifyMentions} headerExtra={subViewToggle} />
  ) : (
    <ComexBoard key="comex-exportacao" config={EXPORT_CONFIG} currentUser={currentUser} users={users} canWrite={canWrite} notifyMentions={notifyMentions} headerExtra={subViewToggle} />
  );
}

export default ComexView;
