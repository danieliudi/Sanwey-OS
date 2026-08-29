import { useMemo } from "react";
import {
  AlertTriangle, Clock, Layers, Megaphone, Package, ShoppingCart, Truck,
  Inbox, CalendarClock, MessageSquareText, BriefcaseBusiness, Users, Gift,
  Handshake, ListTodo, Ship, ListChecks,
} from "lucide-react";
import { useLeads } from "./use-leads";
import { usePipelines } from "./use-pipelines";
import { usePosvenda } from "./use-posvenda";
import { useRHPipelineStages } from "./use-rh-pipeline-stages";
import { useMarketingCampaigns } from "./use-marketing-campaigns";
import { useMarketingDeliverables } from "./use-marketing-deliverables";
import { useMarketingPurchaseRequests, PURCHASE_STAGES } from "./use-marketing-purchase-requests";
import { useMarketingQuotes } from "./use-marketing-quotes";
import { useMarketingRequests } from "./use-marketing-requests";
import { useMarketingTasks } from "./use-marketing-tasks";
import { useComexExportOperations } from "./use-comex-export-operations";
import { useComexImportOperations } from "./use-comex-import-operations";
import { usePersonalTasks } from "./use-personal-tasks";
import { usePersonalTaskStages } from "./use-personal-task-stages";
import { STATUS_COLUMNS as PERSONAL_TASK_STATUS_COLUMNS } from "../constants/personal-tasks";
import { useRHFeedback } from "./use-rh-feedback";
import { useRHFeriasRequests } from "./use-rh-ferias-requests";
import { useRHRecrutamento } from "./use-rh-recrutamento";
import { useRHColaboradores } from "./use-rh-colaboradores";
import { useRHBeneficios } from "./use-rh-beneficios";
import { useRHTreinamentos } from "./use-rh-treinamentos";
import {
  periodoExperienciaInfo, asoDiasParaVencer, contratoDiasParaFim,
  diasParaAniversario, diasParaBodasEmpresa,
  aprendizDiasParaFim, treinamentoDiasParaVencer, avaliacaoDiasParaVencer,
} from "../utils/rh-compliance-dates";
import { isStale, daysIdle } from "../utils/pipeline-metrics";
import { DEFAULT_PIPELINE_STAGES } from "../constants/pipelines";
import { MARKETING_STAGES, DELIVERABLE_STAGES, DELIVERABLE_PRIORITIES } from "../constants/marketing-pipelines";
import { RH_LEAVE_TYPES } from "../constants/rh-config";
import { formatK } from "../utils/currency";
import { formatDateBR, parseDateInput } from "../utils/date";

// Same convention used throughout FASE 5: prefer the `_ids` array, fall back
// to the legacy scalar field wrapped in an array.
function idsOf(ids, scalar) {
  return Array.isArray(ids) && ids.length ? ids : (scalar ? [scalar] : []);
}

// `urgencyRank` — used by MinhasTarefasView to sort each module's items
// before slicing to the top N shown, lower = more urgent. Overdue dates
// come out negative, so a severely late item naturally outranks one
// that's merely due soon; items with no relevant date get `Infinity` so
// they fall to the end instead of faking an urgency they don't have.
function daysUntil(dateStr, hoje = Date.now()) {
  if (!dateStr) return Infinity;
  // parseDateInput (não new Date() cru) — achado real de QA (Fase 4,
  // 27/08/2026): uma coluna `date` pura ("AAAA-MM-DD", ex. personal_tasks.
  // due_date/marketing_purchase_requests.due_date) vira meia-noite UTC com
  // `new Date()`, não meia-noite local — em UTC-3 isso classificava uma
  // tarefa "atrasada" horas antes do prazo real vencer. Mesmo fix que
  // formatDateBR/daysSince já usam (src/utils/date.js).
  const ts = parseDateInput(dateStr).getTime();
  return Number.isNaN(ts) ? Infinity : (ts - hoje) / 86400000;
}

// App.jsx can't be imported from here (it imports the views that will
// eventually render this hook's output) — small local re-implementation of
// the same role-flag helper described in App.jsx:116-130.
function hasAnyRole(user, roles) {
  const userRoles = user?.roles?.length ? user.roles : (user?.role ? [user.role] : []);
  return roles.some(r => userRoles.includes(r));
}

const LEAD_STAGE_LABELS = Object.fromEntries(DEFAULT_PIPELINE_STAGES.map(s => [s.id, s.name]));
const CAMPAIGN_STAGE_LABELS = Object.fromEntries(MARKETING_STAGES.map(s => [s.id, s.name]));
const DELIVERABLE_STAGE_LABELS = Object.fromEntries(DELIVERABLE_STAGES.map(s => [s.id, s.name]));
const PURCHASE_STAGE_LABELS = Object.fromEntries(PURCHASE_STAGES.map(s => [s.id, s.name]));
const PRIORITY_LABELS = Object.fromEntries(DELIVERABLE_PRIORITIES.map(p => [p.id, p.label]));

function leadStageLabel(companyStages, stage) {
  return companyStages?.find(s => s.id === stage)?.name || LEAD_STAGE_LABELS[stage] || stage;
}

// Aggregates everything relevant to the current user, across every module,
// into three flat buckets: things they own ("responsibility"), things
// waiting on their sign-off ("approval"), and live stale/overdue/compliance
// conditions ("alert") that today only ever fire as one-shot push
// notifications elsewhere (see App.jsx's several `pushNotification` effects).
// This hook recomputes the CURRENT state every render — it's a persistent
// list, not a "newly happened" feed, so thresholds are windows (`<= Nd`)
// rather than the exact day-boundaries the one-shot notifications use.
//
// Casing contract (audit P2.8): every task object's own top-level fields —
// id/bucket/module/moduleLabel/icon/title/subtitle/badge/badgeTone/
// urgencyRank/section/lead — are always camelCase; that part IS consistent
// and is the only shape `MinhasTarefasView` (the sole consumer) reads from.
// The `raw` field (and `lead`, for lead items) is a passthrough of whatever
// the ORIGINATING hook returns, and those disagree on casing today:
// useLeads/useMarketingCampaigns/useMarketingDeliverables/
// useMarketingPurchaseRequests/useMarketingQuotes/useMarketingRequests
// already normalize to camelCase, while useRHFeedback/useRHRecrutamento/
// useRHTreinamentos hand back raw `select("*")` rows (snake_case: user_id,
// evaluator_id, period_end, responsible_ids, treinamento_id, etc.). Fixing
// that means normalizing inside those 3 hooks, not here — remapping the
// fields on this end would just duplicate that normalization on an object
// nothing currently reads (`raw` has zero consumers today), so it's
// intentionally left as a documented passthrough instead of invented here.
export function useMyTasks({ currentUser, personalTasksEnabled = true } = {}) {
  const userId = currentUser?.id;
  const role = currentUser?.role;
  const roles = currentUser?.roles;
  const companies = currentUser?.companies;

  const { leads, loading: leadsLoading } = useLeads({ userId, role, companies });
  // usePipelines() takes no args and is cheap (single fetch + realtime
  // channel) — reused as-is rather than approximating staleness, since the
  // real per-company SLA config was readily available here.
  const { pipelines } = usePipelines();
  const { cases: posvendaCases, loading: posvendaLoading } = usePosvenda({ userId, role, roles });
  const { stages: posvendaStages } = useRHPipelineStages("posvenda");
  const { campaigns, loading: campaignsLoading } = useMarketingCampaigns({ userId, role, roles });
  const { deliverables, loading: deliverablesLoading } = useMarketingDeliverables({ userId, role, roles });
  const { purchases, loading: purchasesLoading, rejectPurchase } = useMarketingPurchaseRequests({});
  const { quotes, loading: quotesLoading } = useMarketingQuotes({ userId, role, roles });
  const { requests: marketingRequests, loading: marketingRequestsLoading, rejectRequest } = useMarketingRequests({ userId, role, roles });
  const { feedbacks, loading: feedbacksLoading } = useRHFeedback({ userId });
  const { requests: feriasRequests, loading: feriasLoading } = useRHFeriasRequests({});
  const { vagas, loading: recrutamentoLoading } = useRHRecrutamento({ userId });
  const { colaboradores, loading: colaboradoresLoading } = useRHColaboradores({ userId });
  const { colaboradorBeneficios, loading: beneficiosLoading } = useRHBeneficios({ userId });
  const { treinamentos, atribuicoes, loading: treinamentosLoading, reciclarAtribuicao } = useRHTreinamentos({ userId });
  // FASE 4 (cobertura de domínios, 27/08/2026): Tarefas de Marketing, Comex
  // (Exportação + Importação) e Meu To-do — os 3 domínios que faltavam no
  // agregador. Nenhum dos 3 tinha alerta/notificação pré-existente pra
  // espelhar (levantamento confirmou); a regra de urgência abaixo (prazo
  // vencido, ou aging vs. SLA da etapa) segue o mesmo espírito já usado pra
  // Leads/Pós-venda, não inventa um conceito novo.
  const { tasks: marketingTasksList, loading: marketingTasksLoading } = useMarketingTasks({ userId, role, roles });
  const { stages: marketingTaskStages } = useRHPipelineStages("marketing_tasks");
  const { operations: comexExportOps, loading: comexExportLoading } = useComexExportOperations({ userId, role, roles });
  const { operations: comexImportOps, loading: comexImportLoading } = useComexImportOperations({ userId, role, roles });
  const { stages: comexExportStages } = useRHPipelineStages("comex_exportacao");
  const { stages: comexImportStages } = useRHPipelineStages("comex_importacao");
  // Meu To-do é pessoal (RLS já filtra por user_id) — sem conceito de
  // responsável, e só entra como ALERTA quando atrasada (uma responsibility
  // pra CADA tarefa pessoal aberta inflaria a fila com itens que já têm o
  // próprio board "Meu To-do" pra viver; ver decisão em CLAUDE.md-adjacent
  // no commit desta mudança). `enabled` respeita o mesmo opt-out de
  // Configurações que a própria tela usa — hook fica inerte se desligado.
  const { tasks: personalTasksList, loading: personalTasksLoading } = usePersonalTasks({ userId, enabled: personalTasksEnabled });
  const { stages: personalTaskStagesRaw, loading: personalTaskStagesLoading } = usePersonalTaskStages(personalTasksEnabled ? userId : null);

  const loading = leadsLoading || campaignsLoading || deliverablesLoading || purchasesLoading
    || quotesLoading || marketingRequestsLoading || feedbacksLoading || feriasLoading
    || recrutamentoLoading || colaboradoresLoading || beneficiosLoading || treinamentosLoading
    || posvendaLoading || marketingTasksLoading || comexExportLoading || comexImportLoading
    || (personalTasksEnabled && (personalTasksLoading || personalTaskStagesLoading));

  const posvendaStagesByKey = useMemo(
    () => new Map((posvendaStages || []).map(s => [s.stageKey, s])),
    [posvendaStages],
  );
  const marketingTaskStagesByKey = useMemo(
    () => new Map((marketingTaskStages || []).map(s => [s.stageKey, s])),
    [marketingTaskStages],
  );
  const comexExportStagesByKey = useMemo(
    () => new Map((comexExportStages || []).map(s => [s.stageKey, s])),
    [comexExportStages],
  );
  const comexImportStagesByKey = useMemo(
    () => new Map((comexImportStages || []).map(s => [s.stageKey, s])),
    [comexImportStages],
  );
  // Mesmo padrão de PersonalTasksView.jsx (não usa o catálogo fixo isolado —
  // etapas são customizáveis por usuário, cai pro catálogo só quando a
  // pessoa nunca abriu o editor).
  const personalTaskTerminalKeys = useMemo(() => {
    const columns = (personalTaskStagesRaw || []).length > 0
      ? personalTaskStagesRaw
      : PERSONAL_TASK_STATUS_COLUMNS.map(c => ({ stageKey: c.id, terminal: c.terminal }));
    return new Set(columns.filter(c => c.terminal).map(c => c.stageKey));
  }, [personalTaskStagesRaw]);

  const isRHManagerUser = hasAnyRole(currentUser, ["admin", "gerente_rh"]);

  const colaboradoresById = useMemo(() => {
    const map = new Map();
    for (const c of (colaboradores || [])) map.set(c.id, c);
    return map;
  }, [colaboradores]);

  // The current user's own rh_colaboradores row (if any) — used for the
  // personal "autoavaliação" alert, matched by profile_id like App.jsx does.
  const meuColaborador = useMemo(
    () => (colaboradores || []).find(c => c.profileId === userId) || null,
    [colaboradores, userId],
  );

  const tasks = useMemo(() => {
    if (!userId) return [];
    const out = [];

    // ── Responsabilidades ────────────────────────────────────────────────
    for (const lead of (leads || [])) {
      if (lead.stage === "ganho" || lead.stage === "perdido") continue;
      if (!idsOf(lead.ownerIds, lead.owner).includes(userId)) continue;
      const companyStages = pipelines?.[lead.companyId];
      out.push({
        id: `resp-lead-${lead.id}`,
        bucket: "responsibility",
        module: "leads",
        moduleLabel: "Leads",
        icon: Layers,
        title: lead.company,
        subtitle: `${leadStageLabel(companyStages, lead.stage)} · ${formatK(lead.value)}`,
        badge: lead.closeDate ? formatDateBR(lead.closeDate) : "Sem previsão",
        badgeTone: "var(--text-dim)",
        urgencyRank: daysUntil(lead.closeDate),
        section: "crm",
        lead,
        raw: lead,
      });
    }

    for (const c of (campaigns || [])) {
      if (c.stage === "encerrado") continue;
      if (!idsOf(c.ownerIds, c.owner).includes(userId)) continue;
      out.push({
        id: `resp-campaign-${c.id}`,
        bucket: "responsibility",
        module: "campaigns",
        moduleLabel: "Campanhas",
        icon: Megaphone,
        title: c.name,
        subtitle: CAMPAIGN_STAGE_LABELS[c.stage] || c.stage,
        badge: c.endDate ? formatDateBR(c.endDate) : formatK(c.budget),
        badgeTone: "var(--text-dim)",
        urgencyRank: daysUntil(c.endDate),
        section: "marketing",
        raw: c,
      });
    }

    for (const d of (deliverables || [])) {
      if (d.stage === "entregue") continue;
      if (!idsOf(d.assigneeIds, d.assignee).includes(userId)) continue;
      out.push({
        id: `resp-deliverable-${d.id}`,
        bucket: "responsibility",
        module: "deliverables",
        moduleLabel: "Entregas",
        icon: Package,
        title: d.title,
        subtitle: DELIVERABLE_STAGE_LABELS[d.stage] || d.stage,
        badge: d.deadline ? formatDateBR(d.deadline) : "Sem prazo",
        badgeTone: "var(--text-dim)",
        urgencyRank: daysUntil(d.deadline),
        section: "marketing-entregas",
        raw: d,
      });
    }

    for (const p of (purchases || [])) {
      // "pago" (terminal, from PURCHASE_STAGES config) and "rejeitado" (only
      // reachable via reject_purchase_request, not a kanban column) are both
      // done — nothing left for the responsible person to act on.
      if (p.stage === "pago" || p.stage === "rejeitado") continue;
      if (!idsOf(p.responsibleIds, p.responsibleId).includes(userId)) continue;
      out.push({
        id: `resp-purchase-${p.id}`,
        bucket: "responsibility",
        module: "purchases",
        moduleLabel: "Compras",
        icon: ShoppingCart,
        title: p.itemName,
        subtitle: PURCHASE_STAGE_LABELS[p.stage] || p.stage,
        badge: formatK(p.totalValue || 0),
        badgeTone: "var(--text-dim)",
        urgencyRank: daysUntil(p.dueDate),
        section: "marketing-compras",
        raw: p,
      });
    }

    for (const f of (feedbacks || [])) {
      if (f.status === "concluido") continue;
      if (!idsOf(f.evaluator_ids, f.evaluator_id).includes(userId)) continue;
      const colaborador = colaboradoresById.get(f.user_id);
      out.push({
        id: `resp-feedback-${f.id}`,
        bucket: "responsibility",
        module: "feedback",
        moduleLabel: "Avaliações",
        icon: MessageSquareText,
        title: colaborador?.fullName || "Colaborador",
        subtitle: `Avaliação · ${f.tipo || f.cycle || "—"}`,
        badge: f.period_end ? formatDateBR(f.period_end) : "Sem prazo",
        badgeTone: "var(--text-dim)",
        urgencyRank: daysUntil(f.period_end),
        section: "rh-feedback",
        raw: f,
      });
    }

    // rh_vagas rows come back raw (snake_case) from useRHRecrutamento — only
    // this module has responsible_ids; candidatos/aplicacoes don't.
    for (const v of (vagas || [])) {
      if (v.stage === "encerrada") continue;
      if (!idsOf(v.responsible_ids, null).includes(userId)) continue;
      out.push({
        id: `resp-vaga-${v.id}`,
        bucket: "responsibility",
        module: "vagas",
        moduleLabel: "Vagas",
        icon: BriefcaseBusiness,
        title: v.title,
        subtitle: v.stage ? v.stage[0].toUpperCase() + v.stage.slice(1) : "—",
        badge: v.stage_changed_at ? formatDateBR(v.stage_changed_at) : "—",
        badgeTone: "var(--text-dim)",
        urgencyRank: daysUntil(v.hiring_deadline),
        section: "rh-recrutamento",
        raw: v,
      });
    }

    for (const kase of (posvendaCases || [])) {
      const stageInfo = posvendaStagesByKey.get(kase.stage);
      if (stageInfo?.terminal) continue;
      if (!(kase.ownerIds || []).includes(userId)) continue;
      const agingDays = kase.stageChangedAt ? Math.floor((Date.now() - new Date(kase.stageChangedAt).getTime()) / 86400000) : 0;
      out.push({
        id: `resp-posvenda-${kase.id}`,
        bucket: "responsibility",
        module: "posvenda",
        moduleLabel: "Pós-venda",
        icon: Handshake,
        title: kase.clientName,
        subtitle: stageInfo?.name || kase.stage,
        badge: formatK(kase.value),
        badgeTone: "var(--text-dim)",
        urgencyRank: -agingDays,
        section: "posvenda",
        raw: kase,
      });
    }

    // FASE 4: Tarefas de Marketing — mesmo campo `deadline` de Entregas/Compras.
    for (const t of (marketingTasksList || [])) {
      const stageInfo = marketingTaskStagesByKey.get(t.stage);
      if (!stageInfo || stageInfo.terminal) continue;
      if (!idsOf(t.assigneeIds, null).includes(userId)) continue;
      out.push({
        id: `resp-mktask-${t.id}`,
        bucket: "responsibility",
        module: "marketing_tasks",
        moduleLabel: "Tarefas de Marketing",
        icon: ListTodo,
        title: t.title,
        subtitle: stageInfo?.name || t.stage,
        badge: t.deadline ? formatDateBR(t.deadline) : "Sem prazo",
        badgeTone: "var(--text-dim)",
        urgencyRank: daysUntil(t.deadline),
        section: "marketing-tarefas",
        raw: t,
      });
    }

    // FASE 4: Comex — Exportação e Importação, mesmo aging-por-SLA-de-etapa
    // do bloco de Pós-venda acima (não tem campo de prazo por registro, ver
    // levantamento — sla_days vive na etapa, não na operação).
    for (const op of (comexExportOps || [])) {
      const stageInfo = comexExportStagesByKey.get(op.stage);
      if (!stageInfo || stageInfo.terminal) continue;
      if (!idsOf(op.ownerIds, null).includes(userId)) continue;
      const agingDays = op.stageChangedAt ? Math.floor((Date.now() - new Date(op.stageChangedAt).getTime()) / 86400000) : 0;
      out.push({
        id: `resp-comex-export-${op.id}`,
        bucket: "responsibility",
        module: "comex",
        moduleLabel: "Comex · Exportação",
        icon: Ship,
        title: op.title,
        subtitle: `${stageInfo?.name || op.stage} · ${op.buyerName || "—"}`,
        badge: formatK(op.saleValue || 0),
        badgeTone: "var(--text-dim)",
        urgencyRank: -agingDays,
        section: "comex",
        raw: op,
      });
    }
    for (const op of (comexImportOps || [])) {
      const stageInfo = comexImportStagesByKey.get(op.stage);
      if (!stageInfo || stageInfo.terminal) continue;
      if (!idsOf(op.ownerIds, null).includes(userId)) continue;
      const agingDays = op.stageChangedAt ? Math.floor((Date.now() - new Date(op.stageChangedAt).getTime()) / 86400000) : 0;
      out.push({
        id: `resp-comex-import-${op.id}`,
        bucket: "responsibility",
        module: "comex",
        moduleLabel: "Comex · Importação",
        icon: Ship,
        title: op.title,
        subtitle: `${stageInfo?.name || op.stage} · ${op.supplierName || "—"}`,
        badge: formatK(op.fobValue || 0),
        badgeTone: "var(--text-dim)",
        urgencyRank: -agingDays,
        section: "comex",
        raw: op,
      });
    }

    // ── Aguardando minha aprovação ───────────────────────────────────────
    // Role gates below mirror the real frontend gates: PurchaseRequestDetailDrawer.jsx
    // (`canApprove` = admin/marketing/gerente_marketing — ampliado, ver
    // migration 20260764_marketing_purchase_requests_broaden_approval.sql),
    // use-marketing-quotes.js (`canApprove` = admin/gerente_marketing, NÃO
    // ampliado — fluxo de cotação por e-mail aposentado, mas ainda separado
    // do de compras; mantém gate próprio, não misturar com o de cima),
    // use-marketing-requests.js (`canWrite` = admin/marketing/gerente_marketing),
    // and App.jsx's `isRHManager` (admin/gerente_rh) gating the RHFeriasView
    // `canWrite` prop.
    if (hasAnyRole(currentUser, ["admin", "marketing", "gerente_marketing"])) {
      for (const p of (purchases || [])) {
        // "cotacao" também aguarda decisão — espelha o isPending do
        // PurchaseRequestDetailDrawer (solicitado OU cotacao).
        if (p.stage !== "solicitado" && p.stage !== "cotacao") continue;
        out.push({
          id: `appr-purchase-${p.id}`,
          bucket: "approval",
          module: "purchases",
          moduleLabel: "Compras",
          icon: ShoppingCart,
          title: p.itemName,
          subtitle: p.requesterName || "—",
          badge: formatK(p.totalValue || 0),
          badgeTone: "var(--warning)",
          urgencyRank: daysUntil(p.dueDate),
          section: "marketing-compras",
          raw: p,
        });
      }
    }

    // "Aprovar cotação" foi removido da fila em 27/08/2026 (decisão do
    // Daniel) — apontava pra uma tela que não existe mais. O fluxo de
    // cotação por e-mail foi aposentado; virou a etapa "Cotação" dentro de
    // Compras (ver comentário em FornecedoresView.jsx:171), que já aparece
    // como "Compra aguardando aprovação" (appr-purchase, acima). As funções
    // approveAndSendQuote/rejectQuote continuam no banco mas não têm mais
    // nenhuma UI que as chame — não reviver sem decisão explícita nova.

    if (hasAnyRole(currentUser, ["admin", "marketing", "gerente_marketing"])) {
      for (const r of (marketingRequests || [])) {
        if (r.status !== "pendente") continue;
        out.push({
          id: `appr-request-${r.id}`,
          bucket: "approval",
          module: "requests",
          moduleLabel: "Solicitações",
          icon: Inbox,
          title: r.title,
          subtitle: r.requesterName || "—",
          badge: PRIORITY_LABELS[r.priority] || r.priority || "—",
          badgeTone: "var(--warning)",
          urgencyRank: daysUntil(r.deadline),
          section: "marketing-solicitacoes",
          raw: r,
        });
      }
    }

    if (hasAnyRole(currentUser, ["admin", "gerente_rh"])) {
      for (const r of (feriasRequests || [])) {
        if (r.status !== "pendente") continue;
        const label = RH_LEAVE_TYPES.find(t => t.id === r.type)?.label || r.type;
        // `r.profiles?.name` nunca existe — o SELECT de rh_ferias não faz
        // esse join — então todo card da fila mostrava o literal "Colaborador".
        // O nome certo já está resolvido em colaboradoresById (mesmo padrão
        // usado por Feedback/Treinamentos logo acima/abaixo).
        const colaborador = colaboradoresById.get(r.user_id);
        out.push({
          id: `appr-ferias-${r.id}`,
          bucket: "approval",
          module: "ferias",
          moduleLabel: "Férias & Licenças",
          icon: CalendarClock,
          title: colaborador?.fullName || "Colaborador",
          subtitle: label,
          badge: r.start_date ? formatDateBR(r.start_date) : "—",
          badgeTone: "var(--warning)",
          urgencyRank: daysUntil(r.start_date),
          section: "rh-ferias",
          raw: r,
        });
      }
    }

    // ── Alertas e pendências ─────────────────────────────────────────────
    // Stale leads owned by the current user — reuses the real per-company
    // SLA config from usePipelines(), same as DashboardView/ExecutiveDashboard.
    for (const lead of (leads || [])) {
      if (!idsOf(lead.ownerIds, lead.owner).includes(userId)) continue;
      const companyStages = pipelines?.[lead.companyId];
      if (!isStale(lead, companyStages)) continue;
      out.push({
        id: `alert-lead-${lead.id}`,
        bucket: "alert",
        module: "leads",
        moduleLabel: "Leads parados",
        icon: Clock,
        title: lead.company,
        subtitle: `${leadStageLabel(companyStages, lead.stage)} · ${formatK(lead.value)}`,
        badge: `${daysIdle(lead)}d sem atividade`,
        badgeTone: "var(--warning)",
        urgencyRank: -daysIdle(lead),
        section: "crm",
        lead,
        raw: lead,
      });
    }

    // Stale pós-venda cases owned by the current user — same SLA-window
    // idea as stale leads above, using the stage's own `slaDays` config.
    for (const kase of (posvendaCases || [])) {
      const stageInfo = posvendaStagesByKey.get(kase.stage);
      if (stageInfo?.terminal) continue;
      if (!(kase.ownerIds || []).includes(userId)) continue;
      if (!stageInfo?.slaDays || !kase.stageChangedAt) continue;
      const agingDays = Math.floor((Date.now() - new Date(kase.stageChangedAt).getTime()) / 86400000);
      if (agingDays < stageInfo.slaDays) continue;
      out.push({
        id: `alert-posvenda-${kase.id}`,
        bucket: "alert",
        module: "posvenda",
        moduleLabel: "Pós-venda parado",
        icon: Clock,
        title: kase.clientName,
        subtitle: stageInfo?.name || kase.stage,
        badge: `${agingDays}d na etapa`,
        badgeTone: "var(--warning)",
        urgencyRank: -agingDays,
        section: "posvenda",
        raw: kase,
      });
    }

    // FASE 4: Tarefa de Marketing com prazo vencido — nenhum alerta/
    // notificação pré-existente pra espelhar (levantamento confirmou); segue
    // o mesmo critério já usado em Entregas/Compras (prazo < hoje, etapa não
    // terminal), só que aqui vira alerta (não responsibility) porque a
    // responsibility já cobre a tarefa aberta independente do prazo.
    for (const t of (marketingTasksList || [])) {
      const stageInfo = marketingTaskStagesByKey.get(t.stage);
      if (!stageInfo || stageInfo.terminal) continue;
      if (!idsOf(t.assigneeIds, null).includes(userId)) continue;
      if (!t.deadline) continue;
      const diasAtraso = -daysUntil(t.deadline);
      if (diasAtraso <= 0) continue;
      out.push({
        id: `alert-mktask-${t.id}`,
        bucket: "alert",
        module: "marketing_tasks",
        moduleLabel: "Tarefa de Marketing atrasada",
        icon: Clock,
        title: t.title,
        subtitle: stageInfo?.name || t.stage,
        badge: `Vencido há ${Math.round(diasAtraso)}d`,
        badgeTone: "var(--danger)",
        urgencyRank: -diasAtraso,
        section: "marketing-tarefas",
        raw: t,
      });
    }

    // FASE 4: Comex parado — mesmo critério de aging vs. SLA da etapa do
    // Pós-venda acima (nenhum alerta pré-existente pra espelhar aqui).
    for (const op of (comexExportOps || [])) {
      const stageInfo = comexExportStagesByKey.get(op.stage);
      if (!stageInfo || stageInfo.terminal) continue;
      if (!idsOf(op.ownerIds, null).includes(userId)) continue;
      if (!stageInfo?.slaDays || !op.stageChangedAt) continue;
      const agingDays = Math.floor((Date.now() - new Date(op.stageChangedAt).getTime()) / 86400000);
      if (agingDays < stageInfo.slaDays) continue;
      out.push({
        id: `alert-comex-export-${op.id}`,
        bucket: "alert",
        module: "comex",
        moduleLabel: "Comex parado · Exportação",
        icon: Clock,
        title: op.title,
        subtitle: stageInfo?.name || op.stage,
        badge: `${agingDays}d na etapa`,
        badgeTone: "var(--warning)",
        urgencyRank: -agingDays,
        section: "comex",
        raw: op,
      });
    }
    for (const op of (comexImportOps || [])) {
      const stageInfo = comexImportStagesByKey.get(op.stage);
      if (!stageInfo || stageInfo.terminal) continue;
      if (!idsOf(op.ownerIds, null).includes(userId)) continue;
      if (!stageInfo?.slaDays || !op.stageChangedAt) continue;
      const agingDays = Math.floor((Date.now() - new Date(op.stageChangedAt).getTime()) / 86400000);
      if (agingDays < stageInfo.slaDays) continue;
      out.push({
        id: `alert-comex-import-${op.id}`,
        bucket: "alert",
        module: "comex",
        moduleLabel: "Comex parado · Importação",
        icon: Clock,
        title: op.title,
        subtitle: stageInfo?.name || op.stage,
        badge: `${agingDays}d na etapa`,
        badgeTone: "var(--warning)",
        urgencyRank: -agingDays,
        section: "comex",
        raw: op,
      });
    }

    // FASE 4: Meu To-do atrasado — só entra como ALERTA, não responsibility
    // (uma pendência pra CADA tarefa pessoal aberta inflaria a fila com o
    // que já vive no próprio board "Meu To-do"; só a atrasada de fato precisa
    // furar pra cá). Sem conceito de responsável — é sempre do próprio dono
    // (RLS de personal_tasks já filtra por user_id).
    if (personalTasksEnabled) {
      for (const pt of (personalTasksList || [])) {
        if (personalTaskTerminalKeys.has(pt.status)) continue;
        if (!pt.dueDate) continue;
        const diasAtraso = -daysUntil(pt.dueDate);
        if (diasAtraso <= 0) continue;
        out.push({
          id: `alert-personal-task-${pt.id}`,
          bucket: "alert",
          module: "personal_tasks",
          moduleLabel: "Meu To-do atrasado",
          icon: ListChecks,
          title: pt.title,
          subtitle: pt.tags?.length ? pt.tags.join(", ") : "—",
          badge: `Vencido há ${Math.round(diasAtraso)}d`,
          badgeTone: "var(--danger)",
          urgencyRank: -diasAtraso,
          section: "personal-tasks",
          raw: pt,
        });
      }
    }

    // RH compliance alerts — only for RH managers (mirrors the isRHManager
    // gate on App.jsx's compliance push-notification effect). Windows below
    // are broadened vs. the one-shot notification (which only pings at exact
    // day boundaries like diasRestantes===7) since this is a persistent list,
    // not a "just happened" feed — ASO/contrato use the same <=30d threshold
    // as the push notification, aniversário/bodas use the util's own default
    // 3-day window instead of only the exact day (0).
    if (isRHManagerUser) {
      for (const c of (colaboradores || [])) {
        if (c.employeeStatus !== "ativo") continue;

        const exp = periodoExperienciaInfo(c);
        if (exp && exp.diasRestantes <= 7) {
          out.push({
            id: `alert-exp-${c.id}`,
            bucket: "alert",
            module: "colaboradores",
            moduleLabel: "Conformidade RH",
            icon: AlertTriangle,
            title: c.fullName,
            subtitle: `Período de experiência (${exp.marco}d)`,
            badge: `${exp.diasRestantes}d restantes`,
            badgeTone: exp.diasRestantes <= 1 ? "var(--danger)" : "var(--warning)",
            urgencyRank: exp.diasRestantes,
            section: "rh-funcionarios",
            raw: c,
          });
        }

        // Período de experiência concluído (não só "prestes a vencer") e
        // ninguém ainda solicitou nenhum benefício pra essa pessoa — vira
        // uma tarefa real de RH, não só um alerta informativo como o de
        // cima. Some sozinho quando o primeiro benefício é solicitado.
        if (exp && exp.diasRestantes <= 0) {
          const jaTemBeneficio = (colaboradorBeneficios || []).some(b => b.colaboradorId === c.id && b.status !== "cancelado");
          if (!jaTemBeneficio) {
            out.push({
              id: `resp-beneficios-${c.id}`,
              bucket: "responsibility",
              module: "beneficios",
              moduleLabel: "Benefícios",
              icon: Gift,
              title: c.fullName,
              subtitle: "Período de experiência concluído",
              badge: "Solicitar benefícios",
              badgeTone: "var(--warning)",
              urgencyRank: exp.diasRestantes,
              section: "rh-funcionarios",
              raw: c,
            });
          }
        }

        const asoDias = asoDiasParaVencer(c);
        if (asoDias != null && asoDias <= 30) {
          out.push({
            id: `alert-aso-${c.id}`,
            bucket: "alert",
            module: "colaboradores",
            moduleLabel: "Conformidade RH",
            icon: AlertTriangle,
            title: c.fullName,
            subtitle: "ASO",
            badge: asoDias < 0 ? `Vencido há ${Math.abs(asoDias)}d` : `Vence em ${asoDias}d`,
            badgeTone: asoDias < 0 ? "var(--danger)" : "var(--warning)",
            urgencyRank: asoDias,
            section: "rh-funcionarios",
            raw: c,
          });
        }

        const contratoDias = contratoDiasParaFim(c);
        if (contratoDias != null && contratoDias <= 30) {
          out.push({
            id: `alert-contrato-${c.id}`,
            bucket: "alert",
            module: "colaboradores",
            moduleLabel: "Conformidade RH",
            icon: AlertTriangle,
            title: c.fullName,
            subtitle: "Fim de contrato",
            badge: contratoDias < 0 ? `Venceu há ${Math.abs(contratoDias)}d` : `Termina em ${contratoDias}d`,
            badgeTone: contratoDias < 0 ? "var(--danger)" : "var(--warning)",
            urgencyRank: contratoDias,
            section: "rh-funcionarios",
            raw: c,
          });
        }

        // Jovem Aprendiz (Áudio 6): janela mais larga (60d) — o RH precisa de
        // 2 meses de antecedência pra repor a vaga e não furar a cota. Alerta
        // separado do "Fim de contrato" temporário acima.
        if (c.contractType === "aprendiz") {
          const aprDias = aprendizDiasParaFim(c);
          if (aprDias != null && aprDias <= 60) {
            out.push({
              id: `alert-aprendiz-${c.id}`,
              bucket: "alert",
              module: "colaboradores",
              moduleLabel: "Conformidade RH",
              icon: AlertTriangle,
              title: c.fullName,
              subtitle: "Fim do contrato de aprendizagem",
              badge: aprDias < 0 ? `Encerrou há ${Math.abs(aprDias)}d` : `Encerra em ${aprDias}d`,
              badgeTone: aprDias <= 0 ? "var(--danger)" : "var(--warning)",
              urgencyRank: aprDias,
              section: "rh-funcionarios",
              raw: c,
            });
          }
        }

        const aniversarioDias = diasParaAniversario(c);
        if (aniversarioDias != null) {
          out.push({
            id: `alert-aniversario-${c.id}`,
            bucket: "alert",
            // Aviso puro (tom --success, ninguém "resolve" um aniversário) —
            // não deve inflar o contador de "Alertas ativos", que existe pra
            // sinalizar urgência. Continua aparecendo na aba Alertas.
            informational: true,
            module: "colaboradores",
            moduleLabel: "Conformidade RH",
            icon: Users,
            title: c.fullName,
            subtitle: "Aniversário",
            badge: aniversarioDias === 0 ? "Hoje" : `Em ${aniversarioDias}d`,
            badgeTone: "var(--success)",
            urgencyRank: aniversarioDias,
            section: "rh-funcionarios",
            raw: c,
          });
        }

        const bodasDias = diasParaBodasEmpresa(c);
        if (bodasDias != null) {
          out.push({
            id: `alert-bodas-${c.id}`,
            bucket: "alert",
            informational: true,
            module: "colaboradores",
            moduleLabel: "Conformidade RH",
            icon: Users,
            title: c.fullName,
            subtitle: "Aniversário de empresa",
            badge: bodasDias === 0 ? "Hoje" : `Em ${bodasDias}d`,
            badgeTone: "var(--success)",
            urgencyRank: bodasDias,
            section: "rh-funcionarios",
            raw: c,
          });
        }
      }

      // Offboarding (Onda 3, item 10): desligado sem entrevista de saída
      // registrada. Loop separado — o de cima pula tudo que não é 'ativo'.
      for (const c of (colaboradores || [])) {
        if (c.employeeStatus !== "desligado" || c.desligamentoTipo) continue;
        out.push({
          id: `resp-offboarding-${c.id}`,
          bucket: "responsibility",
          module: "colaboradores",
          moduleLabel: "Offboarding",
          icon: AlertTriangle,
          title: c.fullName,
          subtitle: "Desligado sem entrevista de saída",
          badge: "Registrar entrevista",
          badgeTone: "var(--warning)",
          urgencyRank: 0,
          section: "rh-funcionarios",
          raw: c,
        });
      }

      // Vencimento de treinamento NR/obrigatório (Áudio 4): certificado que
      // vence antes da auditoria. Cruza atribuição concluída × treinamento
      // (validade) × colaborador ativo. Janela de 30d (inclui já-vencido).
      const treinamentosById = new Map((treinamentos || []).map(t => [t.id, t]));
      for (const atr of (atribuicoes || [])) {
        // use-rh-treinamentos.js reconcilia "concluido" pra "vencido" assim
        // que a validade passa (roda ao abrir aquela tela) — com o filtro
        // restrito a "concluido", o alerta se auto-apagava bem na hora que
        // ficava mais urgente (já vencido), sem ninguém ter resolvido nada.
        if (atr.status !== "concluido" && atr.status !== "vencido") continue;
        const tr = treinamentosById.get(atr.treinamento_id);
        if (!tr) continue;
        const col = colaboradoresById.get(atr.colaborador_id);
        if (!col || col.employeeStatus !== "ativo") continue;
        const venceDias = treinamentoDiasParaVencer(atr, tr);
        if (venceDias == null || venceDias > 30) continue;
        out.push({
          id: `alert-treino-${atr.id}`,
          bucket: "alert",
          module: "treinamentos",
          moduleLabel: "Conformidade RH",
          icon: AlertTriangle,
          title: col.fullName,
          subtitle: `Treinamento: ${tr.titulo || tr.tipo || "—"}`,
          badge: venceDias < 0 ? `Vencido há ${Math.abs(venceDias)}d` : `Vence em ${venceDias}d`,
          badgeTone: venceDias <= 0 ? "var(--danger)" : "var(--warning)",
          urgencyRank: venceDias,
          section: "rh-treinamentos",
          raw: atr,
        });
      }

      // Avaliação de desempenho ATRASADA (Áudio 5): avaliação com prazo já
      // vencido e ainda não concluída — o RH precisa cobrar. Distinto da
      // tarefa "sou avaliador" (resp-feedback) e do alerta pessoal de
      // autoavaliação. Só atrasadas, pra não duplicar/poluir. A criação
      // automática por regra de cargo vem na Onda 2.
      for (const f of (feedbacks || [])) {
        if (f.status === "concluido") continue;
        const avalDias = avaliacaoDiasParaVencer(f);
        if (avalDias == null || avalDias >= 0) continue;
        const col = colaboradoresById.get(f.user_id);
        out.push({
          id: `alert-avaliacao-${f.id}`,
          bucket: "alert",
          module: "feedback",
          moduleLabel: "Conformidade RH",
          icon: MessageSquareText,
          title: col?.fullName || "Colaborador",
          subtitle: `Avaliação atrasada · ${f.tipo || f.cycle || "—"}`,
          badge: `Atrasada ${Math.abs(avalDias)}d`,
          badgeTone: "var(--danger)",
          urgencyRank: avalDias,
          section: "rh-feedback",
          // `colaborador` (não dentro de `raw`, mesmo espírito do campo
          // `lead` nos itens de Leads) — o botão "Enviar lembrete" (FASE 2)
          // precisa de nome/cargo/departamento pro e-mail, que `raw: f` (a
          // linha de rh_feedback) sozinha não carrega.
          colaborador: col,
          raw: f,
        });
      }
    }

    // Personal autoavaliação deadline — matches App.jsx's per-user
    // "feedback_prazo" notification (<=3 dias, self_rating ainda vazio).
    if (meuColaborador) {
      const hoje = Date.now();
      for (const f of (feedbacks || [])) {
        if (f.user_id !== meuColaborador.id || f.status === "concluido" || f.self_rating != null) continue;
        if (!f.period_end) continue;
        const diasParaPrazo = Math.floor((new Date(f.period_end).getTime() - hoje) / 86400000);
        if (diasParaPrazo > 3) continue;
        out.push({
          id: `alert-selfeval-${f.id}`,
          bucket: "alert",
          module: "feedback",
          moduleLabel: "Minha autoavaliação",
          icon: MessageSquareText,
          title: "Autoavaliação pendente",
          subtitle: f.tipo || f.cycle || "Ciclo de feedback",
          badge: diasParaPrazo < 0 ? `Atrasada ${Math.abs(diasParaPrazo)}d` : `Vence em ${diasParaPrazo}d`,
          badgeTone: diasParaPrazo < 0 ? "var(--danger)" : "var(--warning)",
          urgencyRank: diasParaPrazo,
          section: "rh-feedback",
          raw: f,
        });
      }
    }

    return out;
  }, [
    userId, currentUser, leads, pipelines, campaigns, deliverables, purchases, quotes,
    marketingRequests, feedbacks, feriasRequests, vagas, colaboradores, colaboradoresById,
    meuColaborador, isRHManagerUser, colaboradorBeneficios, treinamentos, atribuicoes,
    posvendaCases, posvendaStagesByKey, marketingTasksList, marketingTaskStagesByKey,
    comexExportOps, comexImportOps, comexExportStagesByKey, comexImportStagesByKey,
    personalTasksEnabled, personalTasksList, personalTaskTerminalKeys,
  ]);

  const counts = useMemo(() => ({
    responsibility: tasks.filter(t => t.bucket === "responsibility").length,
    approval: tasks.filter(t => t.bucket === "approval").length,
    alert: tasks.filter(t => t.bucket === "alert").length,
  }), [tasks]);

  // Botões de ação de 1 clique na fila (FASE 2 do Copiloto) — só os 3 tipos
  // com função de mutação já pronta no próprio hook do domínio, sem input
  // extra genuinamente obrigatório e sem lógica de guarda vivendo só dentro
  // da View (achado real: appr-ferias aprovar/recusar tinha ficado de fora
  // do escopo original por depender de checagem de documento obrigatório +
  // captura de motivo, ambos vivendo em RHFeriasView — não duplicado aqui).
  // MinhasTarefasView chama estas direto, sem reimplementar a mutação.
  return { tasks, loading, counts, reciclarAtribuicao, rejectRequest, rejectPurchase };
}

export default useMyTasks;
