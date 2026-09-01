import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, X, TrendingUp, Settings, LayoutGrid, Calendar as CalendarIcon, Download, Upload, Bot, Pencil, List, ArrowUpDown, ArrowUp, ArrowDown, Star, AlertCircle, Mic } from "lucide-react";
import { Modal } from "../ui/Modal";
import { SalesCaseVoicePanel } from "../shared/SalesCaseVoicePanel";
import { PipelineChatPanel } from "../ai/PipelineChatPanel";
import { RHMobileKanbanAccordion } from "../rh-pipeline/RHMobileKanbanAccordion";
import { exportLeadsToCSV } from "../../utils/export-csv";
import { logExport } from "../../utils/log-export";
import { CurrencyInput } from "../ui/CurrencyInput";
import { COMPANIES, COMPANY_IDS } from "../../constants/companies";
import { DEFAULT_PIPELINE_STAGES } from "../../constants/pipelines";
import { CANONICAL_SECTORS } from "../../constants/taxonomy";
import { Combobox } from "../shared/Combobox";
import { KanbanColumnSortMenu } from "../shared/KanbanColumnSortMenu";
import { useKanbanColumnSort } from "../../hooks/use-kanban-sort";
import { sortKanbanItems } from "../../utils/kanban-sort";
import { LeadKanbanCard } from "../lead/LeadKanbanCard";
import { LeadCreateModal } from "../lead/LeadCreateModal";
import { LeadFormBuilder } from "../lead/LeadFormBuilder";
import { CRMStageFieldsPanel } from "../shared/stage-editor/CRMStageFieldsPanel";
import { ViewToggleButton } from "../shared/ViewToggleButton";
import { KanbanAnalyticsPanel } from "../shared/KanbanAnalyticsPanel";
import { PipelineStagesModal } from "../pipeline/PipelineStagesModal";
import { DynamicField, validateFields } from "../ui/DynamicField";
import { PipelineCalendarView } from "./PipelineCalendarView";
import { useUsersById } from "../../hooks/use-users-by-id";
import { useLeadFormConfig } from "../../hooks/use-lead-form-config";
import { useStageFields } from "../../hooks/use-stage-fields";
import { getMissingRequiredFields, getFieldCompleteness, isStageRegression } from "../../utils/field-conditions";
import { getInvalidFields } from "../../utils/field-validation";
import { evaluateConditionGroups } from "../../utils/condition-operators";
import { formatK, formatBRL } from "../../utils/currency";
import { useCRMDespesas } from "../../hooks/use-crm-despesas";
import { useAllLeadSamples } from "../../hooks/use-lead-samples";
import { sumTravelExpenses, sumSampleCosts, calculateCAC, cacFormulaHint, periodCutoff } from "../../utils/cac";
import { stageTextColor, stageTextColorStrong } from "../../utils/stage-colors";
import { AssigneeMultiSelect } from "../shared/AssigneeMultiSelect";
import { AvatarStack } from "../shared/AvatarStack";
import { AppToast } from "../shared/AppToast";
import { getLeadOwnerIds, computeFitScore } from "../../utils/pipeline-metrics";
import { useRecordViews } from "../../hooks/use-record-views";
import { hasUnreadLeadComment } from "../../lib/comment-badge";
import { useAvailableHeight } from "../../hooks/use-available-height";
import { KanbanFab } from "../shared/KanbanFab";
import { KanbanColumnHeader } from "../shared/KanbanColumnHeader";
import { KanbanBoardScrollArea } from "../shared/KanbanBoardScrollArea";
import { KanbanBoardHeader } from "../shared/KanbanBoardHeader";
import { FilterBar } from "../shared/FilterBar";
import { PageTitle } from "../shared/PageTitle";
import { semAcento } from "../../utils/text-search";
import { daysSince } from "../../utils/date";

const TERMINAL = new Set(["ganho", "perdido"]);

// Janela do CAC nesta tela (ver o useMemo `cac` mais abaixo). Esta tela não
// tem seletor de período; "all" é o mesmo padrão do Painel Executivo, que é o
// outro ponto que mostra o mesmo indicador. Valor de `period` de
// src/utils/cac.js (`periodCutoff`): "all" | "30d" | "60d" | "90d" | "ytd".
const CAC_PERIOD = "all";

// ── Quick-add form ────────────────────────────────────────────────────────────

const SELECT_STYLE = {
  borderColor: "var(--border-strong)",
  color: "var(--text)",
  background: "var(--surface)",
  padding: "6px 22px 6px 8px",
  appearance: "none",
  WebkitAppearance: "none",
  backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2.5'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 6px center",
  backgroundSize: "12px",
};

function QuickAddForm({ stageId, stage, companyId, currentUser, users, usersById, onAdd, onCancel, customFieldsDef = [] }) {
  const [company, setCompany] = useState("");
  const [value, setValue] = useState("");
  const [ownerIds, setOwnerIds] = useState(currentUser?.id ? [currentUser.id] : []);
  const [sector, setSector] = useState(currentUser?.sectors?.[0] || "");
  const [customValues, setCustomValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const updateCustom = useCallback((key, val) => {
    setCustomValues(prev => ({ ...prev, [key]: val }));
  }, []);

  React.useEffect(() => { inputRef.current?.focus(); }, []);

  // Opções pro AssigneeMultiSelect — objetos de usuário crus (id/name/
  // avatarBg/initials), mesmo escopo de sempre (empresa do card + papéis
  // que podem ser responsáveis).
  const ownerOptions = useMemo(() => {
    return (users || []).filter(u =>
      u.companies?.includes(companyId) &&
      (u.role === "vendedor" || u.role === "gerente" || u.role === "admin")
    );
  }, [users, companyId]);

  // crypto.randomUUID isn't available in every browser/context (older Safari,
  // non-secure contexts). Fall back to a Math.random-based v4-ish id so the
  // "Novo card" flow keeps working everywhere.
  const newId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "lead_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!company.trim()) return;
    if (!sector) {
      setError("Selecione o setor.");
      return;
    }
    // Validar obrigatórios dos campos customizados antes do insert.
    const validationErrors = validateFields(customFieldsDef, customValues);
    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const now = new Date();
      const closeDate = new Date(now.getTime() + 30 * 86400000);
      const primaryOwner = ownerIds[0] || currentUser?.id || null;
      const lead = {
        id: newId(),
        company: company.trim(),
        companyId,
        stage: stageId,
        status: stageId,
        owner: primaryOwner,
        ownerIds: ownerIds.length ? ownerIds : (primaryOwner ? [primaryOwner] : []),
        sector,
        value: parseFloat(value) || 0,
        fitScore: 0,
        starred: false,
        notes: [],
        daysAgo: 0,
        dateDetected: now.toISOString(),
        createdAt: now.toISOString(),
        lastActivity: now.toISOString(),
        stageChangedAt: now.toISOString(),
        closeDate: closeDate.toISOString(),
        probability: Number.isFinite(stage?.probability) ? stage.probability : 10,
        decisionMaker: { name: "—", role: "—" },
        customFields: customValues,
      };
      await onAdd(lead);
      onCancel();
    } catch (err) {
      setError(err?.message || "Não foi possível criar o card.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-2 mb-2 rounded-xl border p-2.5 space-y-2"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <input
        ref={inputRef}
        type="text"
        placeholder="Nome da empresa *"
        value={company}
        onChange={e => setCompany(e.target.value)}
        className="w-full text-xs rounded-lg border px-2.5 py-1.5 outline-none"
        style={{ borderColor: "var(--border-strong)", color: "var(--text)" }}
        onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
        onBlur={e => { e.target.style.borderColor = "var(--border-strong)"; }}
      />
      <select
        value={sector}
        onChange={e => setSector(e.target.value)}
        className="w-full text-xs rounded-lg border outline-none"
        style={{
          ...SELECT_STYLE,
          borderColor: !sector ? "var(--accent)" : "var(--border-strong)",
          color: sector ? "var(--text)" : "var(--text-dim)",
        }}
        required
      >
        <option value="">Setor *</option>
        {CANONICAL_SECTORS.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <CurrencyInput
        value={value}
        onChange={setValue}
        className="w-full text-xs rounded-lg border px-2.5 py-1.5 outline-none"
        style={{ borderColor: "var(--border-strong)", color: "var(--text)" }}
        onFocus={e => { e.target.style.borderColor = "var(--accent)"; }}
        onBlur={e => { e.target.style.borderColor = "var(--border-strong)"; }}
      />
      {ownerOptions.length > 0 && (
        <AssigneeMultiSelect
          value={ownerIds}
          onChange={setOwnerIds}
          options={ownerOptions}
          placeholder="Responsável(is)"
        />
      )}
      {customFieldsDef.length > 0 && (
        <div className="space-y-2 pt-1 mt-1 border-t" style={{ borderColor: "var(--surface-alt)" }}>
          {customFieldsDef.map(f => (
            <DynamicField
              key={f.id}
              field={f}
              value={customValues[f.fieldKey]}
              onChange={(v) => updateCustom(f.fieldKey, v)}
              users={users}
            />
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <button
          type="submit"
          disabled={saving || !company.trim() || !sector}
          className="flex-1 text-xs font-semibold py-1.5 rounded-lg transition-opacity"
          style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: saving || !company.trim() || !sector ? 0.5 : 1 }}
          onMouseEnter={e => { if (!saving && company.trim() && sector) e.currentTarget.style.background = "var(--accent-hover)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "var(--accent)"; }}
        >
          {saving ? "Salvando…" : "Criar card"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-2.5 text-xs rounded-lg border"
          style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
        >
          <X size={12} />
        </button>
      </div>
      {error && (
        <div
          className="text-[11px] rounded-md px-2 py-1.5"
          style={{ background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)" }}
        >
          {error}
        </div>
      )}
    </form>
  );
}

// ── KPI bar ───────────────────────────────────────────────────────────────────

function KpiBar({ scopedLeads }) {
  const m = useMemo(() => {
    let total = 0, totalValue = 0, weightedValue = 0, won = 0, lost = 0;
    for (const l of scopedLeads) {
      if (l.stage === "ganho")   { won++;  continue; }
      if (l.stage === "perdido") { lost++; continue; }
      total++;
      totalValue += l.value;
      // Handle both 0–1 and 0–100 probability formats
      const p = l.probability > 1 ? l.probability / 100 : l.probability;
      weightedValue += l.value * p;
    }
    const ticketMedio = total > 0 ? totalValue / total : 0;
    const convRate    = (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : null;
    return { total, totalValue, weightedValue, ticketMedio, convRate, won, lost };
  }, [scopedLeads]);

  return (
    <div className="flex items-stretch gap-3 flex-wrap" style={{ marginBottom: 4 }}>
      <KpiCard label="Oportunidades"  value={String(m.total)} />
      <KpiCard label="Valor total"    value={formatK(m.totalValue)} />
      <KpiCard label="Valor ponderado" value={formatK(m.weightedValue)} />
      <KpiCard label="Ticket médio"   value={m.total > 0 ? formatK(m.ticketMedio) : "—"} />
      <KpiCard
        label="Tx. conversão"
        value={m.convRate !== null ? `${m.convRate}%` : "—"}
        sub={m.convRate !== null ? `${m.won}G · ${m.lost}P` : "sem dados fechados"}
      />
    </div>
  );
}

function KpiCard({ label, value, sub }) {
  return (
    <div
      className="rounded-xl border"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        padding: "12px 16px",
        boxShadow: "var(--shadow-card)",
        minWidth: 140,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "var(--text-dim)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: "var(--text)",
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 3 }}>{sub}</div>
      )}
    </div>
  );
}

// ── CRMView ───────────────────────────────────────────────────────────────────

export function CRMView({ user, activeCompany, accessibleCompanies, onCompanyChange, leads, pipelines, users, onLeadClick, onStageChange, onAddLead, onDeleteLead, onDuplicateLead, pipelineTransitions, onViewExistingLead, clients, onCreateClient, onCreateClientContact, autoOpenCreate, onAutoOpenHandled, onOpenImport, onReplacePipeline, onResetPipeline, onStarToggle, onUpdateStage }) {
  const isGroupView = activeCompany === "all";
  // roles[] cobre cargo adicional (ex: gerente como cargo secundário) —
  // user.role sozinho (cargo principal) fica só de fallback.
  const userRoleList = user.roles?.length ? user.roles : (user.role ? [user.role] : []);
  const isManager = userRoleList.includes("gerente") || userRoleList.includes("admin");
  // Mesmo predicado de current_user_can_manage_client (RLS de
  // client_contacts) — admin/gerente/vendedor, sem consultor. Gate do
  // bloco "Pessoa de contato" na criação do card (27/08/2026).
  const canAddContact = isManager || userRoleList.includes("vendedor");
  // Altura disponível até o rodapé da janela, medida ao vivo a partir do
  // topo do board — pra barra de scroll horizontal do Kanban nunca ficar
  // abaixo da dobra, em qualquer tamanho de janela (ver use-available-height.js).
  // Não há mais nada depois do board (a Análise do funil virou a própria view
  // "analise", e a dica de rodapé saiu em 01/09/2026 — ver comentário no lugar
  // dela, mais abaixo), então o hook não precisa mais do 3º argumento.
  // marginBottom = 16, o respiro do próprio KanbanBoardScrollArea (pb-4) —
  // sem isso a barra de scroll horizontal do board voltaria a vazar da tela.
  const [boardRef, boardHeight] = useAvailableHeight(16);

  // Mesma regra de permissão do botão de excluir dentro do LeadDetailDrawer
  // (canDelete) — reaproveitada aqui pro atalho de excluir direto no "..."
  // do card, sem precisar abrir o detalhe primeiro.
  const canDeleteLead = useCallback((lead) => Boolean(onDeleteLead && (
    isManager ||
    ((lead.ownerIds || []).includes(user.id) || lead.owner === user.id || lead.createdBy === user.id)
  )), [onDeleteLead, isManager, user.id]);

  // IDs of vendedores subordinados a este vendedor (supervisorId apontando pra ele)
  const subordinateIds = useMemo(() => {
    if (user.role !== "vendedor") return new Set();
    return new Set((users || []).filter(u => u.supervisorId === user.id).map(u => u.id));
  }, [users, user.id, user.role]);
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [starredOnly, setStarredOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("kanban"); // "kanban" | "calendar"
  const { getCriteria: getSortCriteria, setCriteria: setSortCriteria } = useKanbanColumnSort("crm-pipeline");
  const [draggedLead, setDraggedLead] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [blockedDrop, setBlockedDrop] = useState(null);
  const [stageError, setStageError] = useState(null);

  const usersById = useUsersById(users);
  const { formConfig, updateFormConfig } = useLeadFormConfig();
  const stageFields = useStageFields();
  const [createModalStage, setCreateModalStage] = useState(null); // { stageId, stage, companyId }
  // Aprendizado de venda (mockup "Registrar um Caso", aprovado 21/08/2026) —
  // pra prospect que ainda não é cliente formal, só digita/fala o nome.
  const [casoModalOpen, setCasoModalOpen] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [editingStage, setEditingStage] = useState(null); // { stage, companyId }
  const [stageManagerOpen, setStageManagerOpen] = useState(false);

  // user.companies may still contain legacy ids ("comercial") that the DB
  // check constraint rejects — pick the first one that's actually valid.
  const firstValidCompany = (user.companies || []).find(c => COMPANY_IDS.includes(c)) || "industria";
  const companyForPipeline = isGroupView ? firstValidCompany : activeCompany;
  // Todas as etapas configuradas do funil, sem filtro de preferência. Existia
  // aqui um filtro por `visibleStages` (Configurações → "Etapas visíveis no
  // Kanban"), removido na auditoria de 05/08/2026: a lista de preferência só
  // conhecia as 7 etapas da constante, então etapa criada pelo usuário no
  // editor do próprio Kanban caía fora do filtro e sumia do board. Quem
  // esconde coluna agora é só o editor de etapas.
  const stages = pipelines[companyForPipeline] || DEFAULT_PIPELINE_STAGES;

  const companyData = isGroupView ? null : COMPANIES[activeCompany];
  const accent = companyData?.primary || "#37352F";

  useEffect(() => {
    if (!autoOpenCreate) return;
    const firstStage = stages.find(s => !s.terminal);
    if (firstStage) setCreateModalStage({ stageId: firstStage.id, stage: firstStage, companyId: isGroupView ? firstValidCompany : activeCompany });
    onAutoOpenHandled?.();
  }, [autoOpenCreate]); // eslint-disable-line react-hooks/exhaustive-deps

  const companyScopedLeads = useMemo(() => {
    let s = leads;
    if (!isGroupView) s = s.filter(l => l.companyId === activeCompany);
    if (!isManager) {
      // Vendedor sees own leads + subordinates' leads
      s = s.filter(l => getLeadOwnerIds(l).some(id => id === user.id || subordinateIds.has(id)));
    }
    // Filtro por setor. ATENÇÃO: desde 10/08/2026 o setor é aplicado também na
    // RLS (`leads_select` + `current_user_sectors()`), então este filtro deixou
    // de ser a proteção e passou a ser só refinamento de tela — o servidor já
    // não manda negócio de outro setor. Não remova achando que é redundante:
    // ele ainda cobre o caso do gerente/admin, que recebe tudo do banco e usa
    // o seletor de setor do cabeçalho pra focar num time.
    if (user.sectors?.length && user.role === "vendedor") {
      s = s.filter(l => !l.sector || user.sectors.includes(l.sector));
    }
    return s;
  }, [leads, activeCompany, user.id, user.role, user.sectors, isGroupView, isManager, subordinateIds]);

  const scopedLeads = useMemo(() => {
    let s = companyScopedLeads;
    if (isManager && ownerFilter !== "all") {
      // FASE 5: filtro "mostrar leads do fulano" bate se fulano estiver em
      // QUALQUER posição de ownerIds, não só como owner (principal).
      s = s.filter(l => getLeadOwnerIds(l).includes(ownerFilter));
    }
    // Achado da 2ª auditoria: a estrela de favoritar existia na tabela mas
    // não filtrava nada — mesmo padrão "Só favoritos" já usado em
    // Entregas/Marketing.
    if (starredOnly) s = s.filter(l => l.starred);
    // Busca por último, DENTRO do fluxo já escopado (empresa → vendedor →
    // setor → responsável → favoritos): nunca sobre `leads` cru, senão a
    // busca devolveria negócio de outra empresa/vendedor. `scopedLeads` é o
    // array que as 4 views consomem (Kanban, Tabela, Calendário, Análise),
    // então a busca vale nas 4 de graça — CLAUDE.md, regra 11.
    //
    // Campos = os que o card mostra: nome da empresa, setor e o nome de quem
    // é responsável (AvatarStack do rodapé). Buscar em campo invisível faz o
    // usuário não entender por que o card casou.
    const termo = semAcento(search).trim();
    if (termo) {
      s = s.filter(l =>
        semAcento(l.company).includes(termo) ||
        semAcento(l.sector).includes(termo) ||
        getLeadOwnerIds(l).some(id => semAcento(usersById.get(id)?.name).includes(termo))
      );
    }
    return s;
  }, [companyScopedLeads, ownerFilter, isManager, starredOnly, search, usersById]);

  const byStage = useMemo(() => {
    const bucket = Object.create(null);
    for (const s of stages) bucket[s.id] = { leads: [], total: 0 };
    for (const l of scopedLeads) {
      if (bucket[l.stage]) {
        bucket[l.stage].leads.push(l);
        bucket[l.stage].total += l.value;
      }
    }
    // Item 6: ordenar cards dentro de cada coluna — antes só existia a ordem
    // de chegada (created_at desc), sem opção nenhuma de trocar.
    for (const s of stages) {
      bucket[s.id].leads = sortKanbanItems(bucket[s.id].leads, getSortCriteria(s.id), {
        deadline: l => l.closeDate,
        value: l => l.value,
        fit: l => computeFitScore(l),
        name: l => l.company,
        createdAt: l => l.negotiationStartedAt || l.createdAt,
      });
    }
    return bucket;
  }, [stages, scopedLeads, getSortCriteria]);

  // Roster de vendedores/gerentes/admin da empresa ativa — não
  // "donos dos leads já visíveis" (bug real: com poucos leads atribuídos,
  // o filtro listava só 1 vendedor mesmo com o time inteiro cadastrado).
  // Mesmo escopo de papel usado em QuickAddForm:ownerOptions (:75-80).
  const ownerOptions = useMemo(() => {
    const scoped = (users || [])
      .filter(u =>
        (isGroupView || u.companies?.includes(activeCompany)) &&
        (u.role === "vendedor" || u.role === "gerente" || u.role === "admin")
      )
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return [
      { value: "all", label: "Todos os vendedores" },
      ...scoped.map(u => ({ value: u.id, label: u.name || u.id })),
    ];
  }, [users, activeCompany, isGroupView]);

  const summary = useMemo(() => {
    let pipelineValue = 0, won = 0, lost = 0;
    for (const l of scopedLeads) {
      if (l.stage === "ganho") won++;
      else if (l.stage === "perdido") lost++;
      else pipelineValue += l.value;
    }
    return { pipelineValue, won, lost };
  }, [scopedLeads]);

  // CAC agregado (aba Análise) — despesas de viagem só carregam quando a
  // aba está aberta (evita listener/realtime extra na visão padrão de
  // Kanban, o caso mais comum desta tela). Ver src/utils/cac.js pra fórmula
  // e racional completo.
  const cacDataEnabled = viewMode === "analise";
  const { despesas: viagemDespesas } = useCRMDespesas({ userId: user?.id, enabled: cacDataEnabled });
  const { samples: allLeadSamples } = useAllLeadSamples({ enabled: cacDataEnabled });

  // Escopo de vendedor pro CAC = donos dos negócios já visíveis em
  // `scopedLeads` (mesmo filtro de vendedor/empresa que a tela já aplica —
  // com "Todos os vendedores" isso cobre o time inteiro em escopo; com um
  // vendedor específico selecionado, vira só ele). Decisão explícita: um
  // vendedor com despesa de viagem mas nenhum negócio na etapa atual não
  // entra no numerador — aceitável na fase 1 (agregado, não por negócio).
  const cacVendorIds = useMemo(() => {
    const s = new Set();
    for (const l of scopedLeads) for (const id of getLeadOwnerIds(l)) if (id) s.add(id);
    return s;
  }, [scopedLeads]);
  const cacLeadIds = useMemo(() => new Set(scopedLeads.map(l => l.id)), [scopedLeads]);

  // Numerador e denominador têm que cobrir a MESMA janela — o bug corrigido em
  // 10/08/2026 era exatamente este: as despesas/amostras entravam sem recorte
  // (2 anos acumulados) e o texto do hint prometia "no período". `CAC_PERIOD`
  // é o único lugar onde essa janela é decidida nesta tela; o Funil não tem
  // seletor de período, então usa o mesmo valor padrão do Painel Executivo
  // ("all") — assim os dois pontos batem — e o hint é gerado a partir dele
  // (`cacFormulaHint`), nunca escrito à mão. Mudar `CAC_PERIOD` aqui move os
  // dois lados juntos e o texto acompanha sozinho.
  const cac = useMemo(() => {
    if (!cacDataEnabled) return null;
    const periodStart = periodCutoff(CAC_PERIOD);
    const travelExpensesTotal = sumTravelExpenses(viagemDespesas, { vendorIds: cacVendorIds, periodStart });
    const sampleCostsTotal = sumSampleCosts(allLeadSamples, { leadIds: cacLeadIds, periodStart });
    const wonCount = periodStart == null
      ? summary.won
      : scopedLeads.filter(l => {
          if (l.stage !== "ganho") return false;
          const ts = new Date(l.stageChangedAt || l.createdAt).getTime();
          return !Number.isNaN(ts) && ts >= periodStart;
        }).length;
    return calculateCAC({ travelExpensesTotal, sampleCostsTotal, wonCount });
  }, [cacDataEnabled, viagemDespesas, allLeadSamples, cacVendorIds, cacLeadIds, summary.won, scopedLeads]);

  // Enforcement real: bloqueia sair da etapa atual com campo obrigatório
  // (estático ou condicional) vazio — vale tanto pro drag-and-drop quanto
  // pro "Mover para" do menu do card. Antes disso "required" era só o
  // asterisco visual, confirmado ao vivo que não travava nada (inclusive
  // corrompendo métricas do Painel Executivo com value/probability vazios).
  // Usa banner não-bloqueante em vez de alert() nativo — alert() trava
  // sessões automatizadas/headless sem handler de diálogo (achado da
  // auditoria de fricção de 18/07).
  const attemptStageChange = useCallback((leadId, targetStageId) => {
    const lead = scopedLeads.find(l => l.id === leadId) || leads.find(l => l.id === leadId);
    if (!lead) return;
    // Defesa em profundidade: o menu do card depende só da pré-filtragem de
    // targets — checar a matriz aqui garante que nenhum caminho fura a
    // configuração de transições, igual ao handleDrop.
    if (pipelineTransitions && !pipelineTransitions.isTransitionAllowed(lead.companyId, lead.stage, targetStageId)) {
      setStageError(`Não dá pra mover "${lead.company}": transição de etapa não permitida pela configuração do funil.`);
      return;
    }
    // Gate de etapa por valor (18/08/2026) — além de allowed/bloqueado, uma
    // transição pode exigir que um campo da etapa de origem tenha um valor
    // específico (ex.: "Certificação ANP = Aprovada"). Mesmo motor de
    // condições das automações (evaluateConditionGroups), aplicado contra
    // customFields do lead — field referencia field_key da etapa atual.
    const gateCondition = pipelineTransitions?.getTransitionCondition?.(lead.companyId, lead.stage, targetStageId);
    if (gateCondition && !evaluateConditionGroups(gateCondition, lead.customFields || {})) {
      setStageError(`Não dá pra mover "${lead.company}": esta transição exige uma condição específica de campo, ainda não atendida.`);
      return;
    }
    // Campo obrigatório trava AVANÇAR, não VOLTAR (ver isStageRegression) —
    // a matriz de transições acima continua valendo nas duas direções.
    const goingBack = isStageRegression(pipelines[lead.companyId] || stages, lead.stage, targetStageId);
    const fields = stageFields.getFields(lead.companyId, lead.stage);
    const missing = goingBack ? [] : getMissingRequiredFields(fields, lead.customFields || {});
    if (missing.length > 0) {
      setStageError(`Não dá pra mover "${lead.company}": preencha antes — ${missing.map(f => f.label).join(", ")}.`);
      return;
    }
    const invalid = goingBack ? [] : getInvalidFields(fields, lead.customFields || {});
    if (invalid.length > 0) {
      setStageError(`Não dá pra mover "${lead.company}": corrija antes — ${invalid.map(f => `${f.label} (${f.validationError})`).join(", ")}.`);
      return;
    }
    setStageError(null);
    Promise.resolve(onStageChange(leadId, targetStageId)).catch((e) => {
      setStageError(e?.message || "Não foi possível mover o negócio — tente novamente.");
    });
  }, [scopedLeads, leads, stageFields, stages, pipelines, onStageChange, pipelineTransitions]);

  // Badge "X/Y campos obrigatórios" no card (auditoria 10.3) — mesma fonte
  // de campos/valores do enforcement acima, só que sem bloquear nada.
  const getLeadCompleteness = useCallback((lead) => {
    const fields = stageFields.getFields(lead.companyId, lead.stage);
    return getFieldCompleteness(fields, lead.customFields || {});
  }, [stageFields]);

  const { viewedAt: leadViewedAt } = useRecordViews("leads", user?.id);
  const getLeadUnread = useCallback((lead) => hasUnreadLeadComment(lead, leadViewedAt, user?.id), [leadViewedAt, user?.id]);

  const handleDrop = useCallback((stageId, companyId) => {
    if (draggedLead && draggedLead.stage !== stageId) {
      if (pipelineTransitions) {
        const allowed = pipelineTransitions.isTransitionAllowed(companyId, draggedLead.stage, stageId);
        if (!allowed) {
          setBlockedDrop(stageId);
          setTimeout(() => setBlockedDrop(null), 1500);
          setDraggedLead(null);
          setDragOverStage(null);
          return;
        }
      }
      attemptStageChange(draggedLead.id, stageId);
    }
    setDraggedLead(null);
    setDragOverStage(null);
  }, [draggedLead, attemptStageChange, pipelineTransitions]);

  const handleDragStart  = useCallback((lead) => setDraggedLead(lead), []);
  const handleDragOver   = useCallback((e, stageId) => { e.preventDefault(); setDragOverStage(stageId); }, []);
  const handleDragLeave  = useCallback((e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStage(null); }, []);
  const handleDragEnd    = useCallback(() => { setDraggedLead(null); setDragOverStage(null); }, []);

  return (
    <>
    {stageError && (
      <AppToast variant="danger" position="top-right" icon={AlertCircle} onDismiss={() => setStageError(null)}>
        {stageError}
      </AppToast>
    )}
    <div className="space-y-5">
      {/* Toolbar: título + view-toggle + filtros + ações, dentro da barra de
          topo chapada e de ponta a ponta (ver KanbanBoardHeader.jsx) — o
          card arredondado com sombra que existia aqui foi rejeitado (não
          batia com a referência do Pipefy: barra plana, sem cantos, indo
          até a borda da janela a partir de `lg`). */}
      <KanbanBoardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Resumo AO VIVO (conta e valor mudam a cada filtro/busca) vai em
            `summary`, não em `description` — ver o cabeçalho de PageTitle.jsx.
            Esta tela não tem texto estático além dele, então não passa
            `description`. */}
        <PageTitle
          title="Funil de Vendas"
          summary={
            `${scopedLeads.length} oportunidades`
            + (summary.pipelineValue > 0 ? ` · ${formatK(summary.pipelineValue)} em aberto` : "")
            + (summary.won  > 0 ? ` · ${summary.won} ganho${summary.won !== 1 ? "s" : ""}` : "")
            + (summary.lost > 0 ? ` · ${summary.lost} perdido${summary.lost !== 1 ? "s" : ""}` : "")
          }
        />
        <div className="flex items-center gap-2 flex-wrap">
          {/* Busca sempre visível, fora do bloco condicional de `viewMode`
              (CLAUDE.md, regra 11) — vale igual em Kanban, Tabela, Calendário
              e Análise, porque as 4 consomem `scopedLeads`. */}
          <FilterBar
            search={{
              value: search,
              onChange: e => setSearch(e.target.value),
              placeholder: "Buscar negócio…",
              dataTour: "crm-busca-card",
            }}
          />
          {/* Importar CSV */}
          {isManager && onOpenImport && (
            <button
              onClick={onOpenImport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-dim)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--text)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text-dim)"; }}
              title="Importar leads via CSV ou Excel"
            >
              <Upload size={13} />
              <span className="hidden sm:inline">Importar</span>
            </button>
          )}
          {/* Exportar CSV */}
          <button
            onClick={() => { exportLeadsToCSV(scopedLeads, { usersById, pipelines }); logExport(user?.id, "leads_crm", scopedLeads.length); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              color: "var(--text-dim)",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "var(--surface-alt)";
              e.currentTarget.style.color = "var(--text)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "var(--surface)";
              e.currentTarget.style.color = "var(--text-dim)";
            }}
            title="Exportar leads filtrados como CSV"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>
          {/* Toggle Kanban / Calendário */}
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
              active={viewMode === "analise"}
              onClick={() => setViewMode("analise")}
              icon={TrendingUp}
              label="Análise"
              iconOnlyMobile
              dataTour="crm-view-analise"
            />
          </div>
          <button
            onClick={() => setStarredOnly(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 99, border: `1px solid ${starredOnly ? "var(--warning)" : "var(--border)"}`, background: starredOnly ? "var(--warning-bg)" : "var(--surface)", color: starredOnly ? "var(--warning)" : "var(--text-dim)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
          >
            <Star size={11} fill={starredOnly ? "var(--warning)" : "none"} />
            Só favoritos
          </button>
          {isManager && !isGroupView && (
            <button
              onClick={() => setStageManagerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
            >
              <Pencil size={13} />
              <span className="hidden sm:inline">Editar etapas</span>
            </button>
          )}
          {isManager && (
            <div className="flex gap-2 w-full sm:w-auto">
              <Combobox
                value={ownerFilter}
                onChange={setOwnerFilter}
                options={ownerOptions}
                className="flex-1 min-w-0 sm:w-44"
                size="sm"
              />
              {accessibleCompanies && accessibleCompanies.filter(id => id !== "all").length > 1 && (
                <Combobox
                  value={activeCompany}
                  onChange={onCompanyChange}
                  options={[
                    { value: "all", label: "Todas as empresas" },
                    ...accessibleCompanies.filter(id => id !== "all").map(id => ({
                      value: id,
                      label: COMPANIES[id]?.short || id,
                    })),
                  ]}
                  className="flex-1 min-w-0 sm:w-44"
                  size="sm"
                />
              )}
            </div>
          )}
          {!isGroupView && (
            <button
              onClick={() => setCasoModalOpen(true)}
              className="flex items-center gap-1.5 font-semibold"
              style={{
                background: "var(--surface)",
                color: "var(--text-dim)",
                border: "1px solid var(--border-strong)",
                borderRadius: 10,
                padding: "6px 14px",
                fontSize: 13,
                cursor: "pointer",
              }}
              data-tour="registrar-caso-header"
              aria-label="Registrar aprendizado de venda"
              title="Registrar caso de prospecção ainda sem cadastro formal"
            >
              <Mic size={13} />
              Registrar aprendizado
            </button>
          )}
          {onAddLead && stages.filter(s => !s.terminal).length > 0 && (
            <button
              onClick={() => {
                const firstStage = stages.find(s => !s.terminal);
                if (firstStage) setCreateModalStage({ stageId: firstStage.id, stage: firstStage, companyId: isGroupView ? firstValidCompany : activeCompany });
              }}
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
              aria-label="Criar novo card"
            >
              <Plus size={14} />
              Novo card
            </button>
          )}
        </div>
        </div>

        <Modal open={casoModalOpen} onClose={() => setCasoModalOpen(false)} title="Registrar aprendizado de venda" width={640}>
          <div className="p-4">
            <SalesCaseVoicePanel
              mode="prospect"
              companyId={isGroupView ? firstValidCompany : activeCompany}
              currentUser={user}
              onSaved={() => setCasoModalOpen(false)}
            />
          </div>
        </Modal>
      </KanbanBoardHeader>

      {onAddLead && stages.filter(s => !s.terminal).length > 0 && (
        <KanbanFab
          label="Nova oportunidade"
          flush
          dataTour="crm-nova-oportunidade"
          onClick={() => {
            const firstStage = stages.find(s => !s.terminal);
            if (firstStage) setCreateModalStage({ stageId: firstStage.id, stage: firstStage, companyId: isGroupView ? firstValidCompany : activeCompany });
          }}
        />
      )}

      {viewMode === "calendar" ? (
        <PipelineCalendarView
          leads={scopedLeads}
          onLeadClick={onLeadClick}
        />
      ) : viewMode === "table" ? (
        <LeadTableView
          leads={scopedLeads}
          stages={stages}
          users={usersById}
          onLeadClick={onLeadClick}
          onStarToggle={onStarToggle}
          isGroupView={isGroupView}
        />
      ) : viewMode === "analise" ? (
        <div className="flex flex-col gap-3">
          {/* "Perguntar à IA" mora AQUI, dentro da Análise — não flutuando
              sobre o Kanban. Decidido com o Daniel 01/09/2026: o botão
              flutuante aparecia em toda view, competia com o FAB de criar
              negócio e não dizia sobre o que ele responde. A IA deste painel
              interpreta o AGREGADO do funil (total, por etapa, por
              responsável) — é a mesma pergunta que a Análise já responde em
              gráfico, então é aqui que ela pertence. Controle específico de
              uma view fica dentro do conteúdo daquela view, nunca no header
              compartilhado (regra 11 do CLAUDE.md). */}
          <div className="flex justify-end">
            <button
              data-tour="pipeline-ai-chat"
              onClick={() => setShowAIChat(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-dim)", cursor: "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--text)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text-dim)"; }}
              title="Perguntar à IA sobre os números do funil"
            >
              <Bot size={13} />
              Perguntar à IA
            </button>
          </div>
          <KanbanAnalyticsPanel
            stages={stages.filter(s => !s.terminal).map(s => ({ key: s.id, name: s.name, color: s.color, slaDays: s.slaDays }))}
            records={scopedLeads}
            getStageKey={l => l.stage}
            getStageEnteredAt={l => l.stageChangedAt}
            getOwnerIds={getLeadOwnerIds}
            usersById={usersById}
            specificStats={[
              { label: "CAC médio", value: cac != null ? formatBRL(cac) : "—", title: cacFormulaHint(CAC_PERIOD) },
            ]}
          />
        </div>
      ) : (<>
      {/* Mobile kanban: vertical collapsible stages — via RHMobileKanbanAccordion
          (shared/rh-pipeline), consolidação de 08/08/2026. Este arquivo é a
          "cópia original" citada no topo do componente compartilhado — a
          instância aqui só passa a chave da etapa como `stage.id` em vez de
          `stage.stageKey`, o componente aceita as duas (ver comentário lá). */}
      <RHMobileKanbanAccordion
        stages={stages}
        itemsByStage={Object.fromEntries(stages.map(s => [s.id, (byStage[s.id]?.leads) || []]))}
        getSortCriteria={getSortCriteria}
        setSortCriteria={setSortCriteria}
        sortOptions={["recent", "deadline", "value", "alpha"]}
        initialExpandedKey="prospeccao"
        addLabel="Nova oportunidade"
        emptyLabel="Nenhum negócio nesta etapa"
        onAdd={onAddLead ? (stageKey) => {
          const stage = stages.find(s => s.id === stageKey);
          if (stage) setCreateModalStage({ stageId: stage.id, stage, companyId: isGroupView ? firstValidCompany : activeCompany });
        } : undefined}
        renderStageBadge={(stage) => {
          const total = byStage[stage.id]?.total || 0;
          return total > 0 ? <span className="text-xs font-semibold" style={{ color: stageTextColorStrong(stage.color) }}>{formatK(total)}</span> : null;
        }}
        renderCard={(lead) => (
          <LeadKanbanCard
            key={lead.id}
            lead={lead}
            users={users}
            showOwnerFooter={isGroupView || isManager}
            isGroupView={isGroupView}
            onClick={onLeadClick}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            stages={stages}
            onMoveToStage={attemptStageChange}
            onDeleteCard={canDeleteLead(lead) ? () => onDeleteLead(lead.id) : undefined}
            onDuplicateCard={onDuplicateLead ? () => onDuplicateLead(lead.id) : undefined}
            completeness={getLeadCompleteness(lead)}
            unread={getLeadUnread(lead)}
            pipelineTransitions={pipelineTransitions}
          />
        )}
      />

      {/* Desktop kanban: horizontal scroll */}
      <div className="hidden lg:block">
        <KanbanBoardScrollArea scrollRef={boardRef} height={boardHeight}>
        <div
          className="flex gap-2 h-full"
          style={{ minWidth: `${stages.length * 280}px` }}
        >
          {stages.map((stage, idx) => {
            const bucket = byStage[stage.id] || { leads: [], total: 0 };
            const isOver    = dragOverStage === stage.id;
            const isBlocked = blockedDrop === stage.id;
            const colCompanyId = isGroupView ? firstValidCompany : activeCompany;
            const canAccept = !draggedLead || !pipelineTransitions
              ? true
              : pipelineTransitions.isTransitionAllowed(colCompanyId, draggedLead?.stage, stage.id);

            return (
              <div
                key={stage.id}
                onDragOver={e => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDrop(stage.id, colCompanyId)}
                className="flex flex-col rounded-lg transition-all duration-150"
                style={{
                  width: 272,
                  minWidth: 272,
                  height: "100%",
                  overflow: "hidden",
                  borderRight: idx < stages.length - 1 ? "1px solid var(--border)" : "none",
                  background: isBlocked ? "var(--danger-bg)" : isOver && canAccept ? stage.color + "14" : "var(--surface-alt)",
                  boxShadow: isBlocked ? "0 0 0 2px color-mix(in srgb, var(--danger) 20%, transparent)" : isOver && canAccept ? `0 0 0 2px ${stage.color}40` : isOver && !canAccept ? "0 0 0 2px color-mix(in srgb, var(--danger) 35%, transparent)" : "none",
                }}
              >
                {/* Cabeçalho encostado no topo da coluna, sem gap/sombra
                    (Redesign v2) — cor do nome vira a própria cor da etapa,
                    igual ao acordeão mobile, seguindo os prints do Pipefy. */}
                <KanbanColumnHeader
                  color={stage.color}
                  name={stage.name}
                  count={bucket.leads.length}
                  bandHeight={4}
                  letterSpacing="normal"
                  nameFontSize={14}
                  nameFontWeight={700}
                  uppercase={false}
                  countFontSize={12}
                  actions={(
                    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <KanbanColumnSortMenu
                        criteria={getSortCriteria(stage.id)}
                        onChange={(v) => setSortCriteria(stage.id, v)}
                        options={["recent", "deadline", "value", "fit", "alpha"]}
                      />
                      {isManager && (
                        <button
                          onClick={() => setEditingStage({ stage, companyId: colCompanyId })}
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
                  )}
                >
                  {isBlocked ? (
                    <div className="text-xs mt-1 font-semibold" style={{ color: "var(--danger)" }}>
                      Transição bloqueada
                    </div>
                  ) : (
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)", fontWeight: 600 }}>
                      {bucket.total > 0 ? formatK(bucket.total) : "R$ 0"}
                    </div>
                  )}
                </KanbanColumnHeader>

                {/* Cards */}
                <div
                  className="px-2 pt-2 pb-1 flex-1 overflow-y-auto"
                  style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 0 }}
                >
                  {bucket.leads.length === 0 ? (
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
                          <span style={{ opacity: 0.5 }}>Nenhum negócio nesta etapa</span>
                          {!stage.terminal && <span style={{ opacity: 0.4, fontSize: 10 }}>Arraste um card aqui ou crie um novo</span>}
                        </>
                      )}
                    </div>
                  ) : (
                    bucket.leads.map(lead => (
                      <LeadKanbanCard
                        key={lead.id}
                        lead={lead}
                        users={users}
                        showOwnerFooter={isGroupView || isManager}
                        isGroupView={isGroupView}
                        onClick={onLeadClick}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        stages={stages}
                        onMoveToStage={attemptStageChange}
                        onDeleteCard={canDeleteLead(lead) ? () => onDeleteLead(lead.id) : undefined}
                        onDuplicateCard={onDuplicateLead ? () => onDuplicateLead(lead.id) : undefined}
                        completeness={getLeadCompleteness(lead)}
                        unread={getLeadUnread(lead)}
                        pipelineTransitions={pipelineTransitions}
                        showMoveOptions={false}
                      />
                    ))
                  )}
                  {onAddLead && !stage.terminal && (
                    <button
                      onClick={() => setCreateModalStage({ stageId: stage.id, stage, companyId: isGroupView ? firstValidCompany : activeCompany })}
                      className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                      style={{ background: stage.color + "18", color: stageTextColor(stage.color), border: `1px dashed ${stage.color}44` }}
                    >
                      <Plus size={12} />
                      Nova oportunidade
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </KanbanBoardScrollArea>
      </div>
      </>)}

      {/* A dica "Arraste para mover · '+' para criar · Clique para ver
          detalhes" vivia aqui, no rodapé do board. Removida 01/09/2026 a
          pedido do Daniel: as três ações são descobertas no primeiro uso e o
          texto custava uma faixa de altura em TODA sessão, pra sempre. Com
          ela foi junto o `trailingRef` — existia só pra medir essa faixa e
          descontá-la do `useAvailableHeight`; sem conteúdo depois do board,
          não há o que descontar. Se um dia voltar a existir conteúdo abaixo
          do board, é o `trailingRef` que precisa voltar (3º argumento de
          useAvailableHeight), não um valor fixo chutado. */}

      {viewMode === "table" && (
        <p className="text-xs text-center" style={{ color: "var(--text-dim)" }}>
          Clique numa linha para ver detalhes · Clique no cabeçalho para ordenar
        </p>
      )}

      {/* Lead create modal */}
      <LeadCreateModal
        open={Boolean(createModalStage)}
        onClose={() => setCreateModalStage(null)}
        stageId={createModalStage?.stageId}
        stage={createModalStage?.stage}
        companyId={createModalStage?.companyId}
        currentUser={user}
        users={users}
        onAdd={onAddLead}
        isManager={isManager}
        formConfig={formConfig}
        onUpdateFormConfig={updateFormConfig}
        existingLeads={leads}
        onViewExisting={(lead) => {
          if (onLeadClick) onLeadClick(lead);
          setCreateModalStage(null);
        }}
        clients={clients}
        createClient={onCreateClient}
        createClientContact={onCreateClientContact}
        canAddContact={canAddContact}
      />

      {/* Form builder — acessível pelo modal de criação */}
      {showFormBuilder && (
        <LeadFormBuilder
          formConfig={formConfig}
          onSave={updateFormConfig}
          onClose={() => setShowFormBuilder(false)}
        />
      )}

      {/* Editor de fase (campos + opções avançadas, estilo Pipefy) */}
      <CRMStageFieldsPanel
        open={Boolean(editingStage)}
        onClose={() => setEditingStage(null)}
        stage={editingStage?.stage}
        companyId={editingStage?.companyId}
        stageFields={stageFields}
        onUpdateStage={onUpdateStage}
      />

      {/* Editor de etapas + matriz de transições (ex-PipelineBuilderView) */}
      <PipelineStagesModal
        open={stageManagerOpen}
        onClose={() => setStageManagerOpen(false)}
        companyId={companyForPipeline}
        stages={stages}
        transitions={pipelineTransitions}
        leads={leads}
        onReplacePipeline={onReplacePipeline}
        onResetPipeline={onResetPipeline}
      />
    </div>

    <PipelineChatPanel
      leads={scopedLeads}
      users={users}
      stages={stages}
      currentUser={user}
      isOpen={showAIChat}
      onClose={() => setShowAIChat(false)}
    />

    </>
  );
}

// ── Lead Table View ───────────────────────────────────────────────────────────

const TABLE_COLS = [
  { id: "starred",   label: "",             width: 36,  sortable: false },
  { id: "company",   label: "Empresa",      width: null, sortable: true },
  { id: "stage",     label: "Etapa",        width: 140,  sortable: true },
  { id: "value",     label: "Valor",        width: 110,  sortable: true },
  { id: "fitScore",  label: "Fit",          width: 70,   sortable: true },
  { id: "sector",    label: "Setor",        width: 140,  sortable: true },
  { id: "owner",     label: "Responsável",  width: 140,  sortable: true },
  { id: "stageChangedAt", label: "Última mov.", width: 120, sortable: true },
  { id: "timeInStage", label: "Tempo na etapa", width: 110, sortable: true },
  { id: "timeInPipe",  label: "Tempo no pipe",  width: 110, sortable: true },
];

// Mesmo vocabulário de urgência do badge de SLA no card Kanban (LeadKanbanCard
// agingStyle), só que com tokens theme-aware em vez de hex fixos.
function stageTimeStyle(days, slaDays) {
  if (!slaDays) return { color: "var(--text-dim)" };
  const ratio = days / slaDays;
  if (ratio >= 1)   return { color: "var(--danger)" };
  if (ratio >= 0.7) return { color: "var(--amber)" };
  return { color: "var(--text-dim)" };
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <ArrowUpDown size={11} style={{ color: "var(--border-strong)", flexShrink: 0 }} />;
  return sortDir === "asc"
    ? <ArrowUp size={11} style={{ color: "var(--accent)", flexShrink: 0 }} />
    : <ArrowDown size={11} style={{ color: "var(--accent)", flexShrink: 0 }} />;
}

function LeadTableView({ leads, stages, users, onLeadClick, onStarToggle, isGroupView }) {
  const [sortCol, setSortCol] = useState("stageChangedAt");
  const [sortDir, setSortDir] = useState("desc");
  const [hoveredRow, setHoveredRow] = useState(null);

  const stageMap = useMemo(() => {
    const m = {};
    (stages || []).forEach(s => { m[s.id] = s; });
    return m;
  }, [stages]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const sorted = useMemo(() => {
    const arr = [...leads];
    arr.sort((a, b) => {
      let va, vb;
      switch (sortCol) {
        case "company":   va = a.company?.toLowerCase() || ""; vb = b.company?.toLowerCase() || ""; break;
        case "stage":     va = stageMap[a.stage]?.name || a.stage || ""; vb = stageMap[b.stage]?.name || b.stage || ""; break;
        case "value":     va = a.value || 0; vb = b.value || 0; break;
        case "fitScore":  va = computeFitScore(a) || 0; vb = computeFitScore(b) || 0; break;
        case "sector":    va = a.sector?.toLowerCase() || ""; vb = b.sector?.toLowerCase() || ""; break;
        case "owner": {
          // `users` é um Map (useUsersById) — ordena pelo primeiro responsável
          // (FASE 5: owner_ids pode ter mais de um, mantém critério simples).
          const aId = getLeadOwnerIds(a)[0];
          const bId = getLeadOwnerIds(b)[0];
          va = users?.get?.(aId)?.name?.toLowerCase() || "";
          vb = users?.get?.(bId)?.name?.toLowerCase() || "";
          break;
        }
        case "stageChangedAt": va = a.stageChangedAt || a.negotiationStartedAt || a.createdAt || ""; vb = b.stageChangedAt || b.negotiationStartedAt || b.createdAt || ""; break;
        case "timeInStage": va = daysSince(a.stageChangedAt || a.negotiationStartedAt || a.createdAt); vb = daysSince(b.stageChangedAt || b.negotiationStartedAt || b.createdAt); break;
        case "timeInPipe":  va = daysSince(a.negotiationStartedAt || a.createdAt || a.dateDetected); vb = daysSince(b.negotiationStartedAt || b.createdAt || b.dateDetected); break;
        default:          va = ""; vb = "";
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [leads, sortCol, sortDir, stageMap, users, stages]);

  const fmt = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  };

  // Achado do Daniel (12/08/2026): antes disto, uma busca/filtro sem
  // resultado escondia a tabela inteira (cabeçalhos de coluna incluídos)
  // atrás de uma mensagem central — parecia bug, não "nenhum resultado".
  // Cabeçalhos ficam sempre visíveis agora; só o corpo mostra a mensagem
  // (mesmo padrão de PosVendaTableView.jsx).
  return (
    <>
    {/* Mobile: cards empilhados (abaixo de md a tabela de 8 colunas cortava
        Responsável/Última mov. pra fora da tela) */}
    <div className="md:hidden space-y-2">
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2" style={{ color: "var(--text-dim)" }}>
          <List size={28} strokeWidth={1} />
          <span className="text-xs">Nenhum lead encontrado</span>
        </div>
      ) : sorted.map(lead => {
        const stage = stageMap[lead.stage];
        const resolvedOwners = getLeadOwnerIds(lead).map(id => users?.get?.(id)).filter(Boolean);
        const companyInfo = isGroupView ? COMPANIES[lead.companyId] : null;
        const fitScore = computeFitScore(lead);
        return (
          <div
            key={lead.id}
            onClick={() => onLeadClick?.(lead)}
            className="rounded-xl border p-3 cursor-pointer"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {companyInfo && (
                  <span
                    style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                      background: companyInfo.primary, color: "#FFF",
                      fontSize: 9, fontWeight: 800,
                    }}
                  >
                    {companyInfo.short?.[0] || "?"}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate" style={{ color: "var(--text)" }}>{lead.company}</div>
                  {stage && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: stage.color, flexShrink: 0 }} />
                      <span style={{ color: stage.color, fontWeight: 600, fontSize: 11 }}>{stage.name}</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-semibold text-sm" style={{ color: lead.value > 0 ? "var(--success)" : "var(--text-dim)" }}>
                  {lead.value > 0 ? formatK(lead.value) : "—"}
                </span>
                {onStarToggle && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onStarToggle(lead.id); }}
                    style={{ display: "flex", background: "transparent", border: "none", cursor: "pointer", padding: 2 }}
                    title={lead.starred ? "Remover dos favoritos" : "Marcar como favorito"}
                  >
                    <Star size={13} fill={lead.starred ? "#F59E0B" : "none"} color={lead.starred ? "#F59E0B" : "var(--text-dim)"} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 mt-2 text-xs" style={{ color: "var(--text-dim)" }}>
              <div className="flex items-center gap-2 min-w-0">
                {fitScore > 0 && (
                  <span
                    style={{
                      padding: "1px 5px",
                      borderRadius: 4,
                      fontWeight: 700,
                      background: fitScore >= 80 ? "var(--success-bg)" : fitScore >= 50 ? "var(--warning-bg)" : "var(--danger-bg)",
                      color: fitScore >= 80 ? "var(--success)" : fitScore >= 50 ? "var(--warning)" : "var(--danger)",
                    }}
                  >
                    {fitScore}
                  </span>
                )}
                <span className="truncate">{lead.sector || "—"}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {resolvedOwners.length > 0 && <AvatarStack users={resolvedOwners} size={18} max={2} />}
                <span>{fmt(lead.stageChangedAt || lead.negotiationStartedAt || lead.createdAt)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>

    {/* md+: tabela completa */}
    <div className="hidden md:block overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
            {TABLE_COLS.map(col => (
              <th
                key={col.id}
                style={{
                  width: col.width || undefined,
                  padding: col.id === "starred" ? "10px 8px 10px 12px" : "10px 12px",
                  textAlign: "left",
                  fontWeight: 600,
                  fontSize: 11,
                  color: "var(--text-dim)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  cursor: col.sortable ? "pointer" : "default",
                  userSelect: "none",
                  whiteSpace: "nowrap",
                }}
                onClick={col.sortable ? () => handleSort(col.id) : undefined}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {col.label}
                  {col.sortable && <SortIcon col={col.id} sortCol={sortCol} sortDir={sortDir} />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={TABLE_COLS.length} style={{ padding: "32px 12px", textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
                Nenhum lead encontrado
              </td>
            </tr>
          ) : sorted.map((lead, idx) => {
            const stage = stageMap[lead.stage];
            // FASE 5: resolve todos os responsáveis (owner_ids, com fallback
            // pro owner escalar) contra o Map de usuários pro AvatarStack.
            const resolvedOwners = getLeadOwnerIds(lead).map(id => users?.get?.(id)).filter(Boolean);
            const isHovered = hoveredRow === lead.id;
            const companyInfo = isGroupView ? COMPANIES[lead.companyId] : null;
            const fitScore = computeFitScore(lead);
            return (
              <tr
                key={lead.id}
                onClick={() => onLeadClick?.(lead)}
                onMouseEnter={() => setHoveredRow(lead.id)}
                onMouseLeave={() => setHoveredRow(null)}
                style={{
                  borderBottom: idx < sorted.length - 1 ? "1px solid var(--surface-alt)" : "none",
                  background: isHovered ? "var(--surface-alt)" : "transparent",
                  cursor: "pointer",
                  transition: "background 100ms",
                }}
              >
                {/* Star — clicável (achado da 2ª auditoria: célula era só leitura) */}
                <td style={{ padding: "10px 4px 10px 12px", width: 36 }}>
                  {onStarToggle ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); onStarToggle(lead.id); }}
                      style={{ display: "flex", background: "transparent", border: "none", cursor: "pointer", padding: 2 }}
                      title={lead.starred ? "Remover dos favoritos" : "Marcar como favorito"}
                    >
                      <Star size={13} fill={lead.starred ? "#F59E0B" : "none"} color={lead.starred ? "#F59E0B" : "var(--text-dim)"} />
                    </button>
                  ) : (
                    lead.starred && <Star size={13} fill="#F59E0B" color="#F59E0B" />
                  )}
                </td>
                {/* Company */}
                <td style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    {companyInfo && (
                      <span
                        style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                          background: companyInfo.primary, color: "#FFF",
                          fontSize: 9, fontWeight: 800,
                        }}
                      >
                        {companyInfo.short?.[0] || "?"}
                      </span>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>
                        {lead.company}
                      </div>
                      {lead.sector && (
                        <div style={{ fontSize: 11, color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {lead.sector}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                {/* Stage */}
                <td style={{ padding: "10px 12px" }}>
                  {stage ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color, flexShrink: 0 }} />
                      <span style={{ color: stage.color, fontWeight: 600, fontSize: 12 }}>{stage.name}</span>
                    </span>
                  ) : <span style={{ color: "var(--text-dim)" }}>—</span>}
                </td>
                {/* Value */}
                <td style={{ padding: "10px 12px", fontWeight: 600, color: lead.value > 0 ? "var(--success)" : "var(--text-dim)" }}>
                  {lead.value > 0 ? formatK(lead.value) : "—"}
                </td>
                {/* Fit Score */}
                <td style={{ padding: "10px 12px" }}>
                  {fitScore > 0 ? (
                    <span style={{
                      display: "inline-block",
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      background: fitScore >= 80 ? "var(--success-bg)" : fitScore >= 50 ? "var(--warning-bg)" : "var(--danger-bg)",
                      color: fitScore >= 80 ? "var(--success)" : fitScore >= 50 ? "var(--warning)" : "var(--danger)",
                    }}>
                      {fitScore}
                    </span>
                  ) : <span style={{ color: "var(--text-dim)" }}>—</span>}
                </td>
                {/* Sector */}
                <td style={{ padding: "10px 12px", color: "var(--text-dim)", maxWidth: 140 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                    {lead.sector || "—"}
                  </span>
                </td>
                {/* Owner(s) */}
                <td style={{ padding: "10px 12px" }}>
                  {resolvedOwners.length > 0 ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <AvatarStack users={resolvedOwners} size={24} max={3} />
                      <span style={{ color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>
                        {resolvedOwners[0].name}
                      </span>
                    </span>
                  ) : <span style={{ color: "var(--text-dim)" }}>—</span>}
                </td>
                {/* Last move */}
                <td style={{ padding: "10px 12px", color: "var(--text-dim)", fontSize: 12 }}>
                  {fmt(lead.stageChangedAt || lead.negotiationStartedAt || lead.createdAt)}
                </td>
                {/* SLA: tempo na etapa atual, colorido pelo slaDays da etapa */}
                <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 600, ...stageTimeStyle(daysSince(lead.stageChangedAt || lead.negotiationStartedAt || lead.createdAt), stage?.slaDays) }}>
                  {daysSince(lead.stageChangedAt || lead.negotiationStartedAt || lead.createdAt)}d
                </td>
                {/* SLA: tempo total desde que o lead entrou no pipe */}
                <td style={{ padding: "10px 12px", color: "var(--text-dim)", fontSize: 12 }}>
                  {daysSince(lead.negotiationStartedAt || lead.createdAt || lead.dateDetected)}d
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

export default CRMView;
