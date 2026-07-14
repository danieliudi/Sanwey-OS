import { useMemo } from "react";
import {
  AlertTriangle, Clock, Layers, Megaphone, Package, ShoppingCart, Truck,
  Inbox, CalendarClock, MessageSquareText, BriefcaseBusiness, Users,
} from "lucide-react";
import { useLeads } from "./use-leads";
import { usePipelines } from "./use-pipelines";
import { useMarketingCampaigns } from "./use-marketing-campaigns";
import { useMarketingDeliverables } from "./use-marketing-deliverables";
import { useMarketingPurchaseRequests, PURCHASE_STAGES } from "./use-marketing-purchase-requests";
import { useMarketingQuotes } from "./use-marketing-quotes";
import { useMarketingRequests } from "./use-marketing-requests";
import { useRHFeedback } from "./use-rh-feedback";
import { useRHFeriasRequests } from "./use-rh-ferias-requests";
import { useRHRecrutamento } from "./use-rh-recrutamento";
import { useRHColaboradores } from "./use-rh-colaboradores";
import {
  periodoExperienciaInfo, asoDiasParaVencer, contratoDiasParaFim,
  diasParaAniversario, diasParaBodasEmpresa,
} from "../utils/rh-compliance-dates";
import { isStale, daysIdle } from "../utils/pipeline-metrics";
import { DEFAULT_PIPELINE_STAGES } from "../constants/pipelines";
import { MARKETING_STAGES, DELIVERABLE_STAGES, DELIVERABLE_PRIORITIES } from "../constants/marketing-pipelines";
import { RH_LEAVE_TYPES } from "../constants/rh-config";
import { formatK } from "../utils/currency";
import { formatDateBR } from "../utils/date";

// Same convention used throughout FASE 5: prefer the `_ids` array, fall back
// to the legacy scalar field wrapped in an array.
function idsOf(ids, scalar) {
  return Array.isArray(ids) && ids.length ? ids : (scalar ? [scalar] : []);
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
export function useMyTasks({ currentUser } = {}) {
  const userId = currentUser?.id;
  const role = currentUser?.role;
  const companies = currentUser?.companies;

  const { leads, loading: leadsLoading } = useLeads({ userId, role, companies });
  // usePipelines() takes no args and is cheap (single fetch + realtime
  // channel) — reused as-is rather than approximating staleness, since the
  // real per-company SLA config was readily available here.
  const { pipelines } = usePipelines();
  const { campaigns, loading: campaignsLoading } = useMarketingCampaigns({ userId, role });
  const { deliverables, loading: deliverablesLoading } = useMarketingDeliverables({ userId, role });
  const { purchases, loading: purchasesLoading } = useMarketingPurchaseRequests({});
  const { quotes, loading: quotesLoading } = useMarketingQuotes({ userId, role });
  const { requests: marketingRequests, loading: marketingRequestsLoading } = useMarketingRequests({ userId, role });
  const { feedbacks, loading: feedbacksLoading } = useRHFeedback({ userId });
  const { requests: feriasRequests, loading: feriasLoading } = useRHFeriasRequests({});
  const { vagas, loading: recrutamentoLoading } = useRHRecrutamento({ userId });
  const { colaboradores, loading: colaboradoresLoading } = useRHColaboradores({ userId });

  const loading = leadsLoading || campaignsLoading || deliverablesLoading || purchasesLoading
    || quotesLoading || marketingRequestsLoading || feedbacksLoading || feriasLoading
    || recrutamentoLoading || colaboradoresLoading;

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
        section: "rh-recrutamento",
        raw: v,
      });
    }

    // ── Aguardando minha aprovação ───────────────────────────────────────
    // Role gates below mirror the real frontend gates: PurchaseRequestDetailDrawer.jsx
    // (`canApprove` = admin/gerente_marketing), use-marketing-quotes.js
    // (`canApprove` = admin/gerente_marketing), use-marketing-requests.js
    // (`canWrite` = admin/marketing/gerente_marketing), and App.jsx's
    // `isRHManager` (admin/gerente_rh) gating the RHFeriasView `canWrite` prop.
    if (hasAnyRole(currentUser, ["admin", "gerente_marketing"])) {
      for (const p of (purchases || [])) {
        if (p.stage !== "solicitado") continue;
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
          section: "marketing-compras",
          raw: p,
        });
      }

      for (const q of (quotes || [])) {
        if (q.status !== "pendente") continue;
        out.push({
          id: `appr-quote-${q.id}`,
          bucket: "approval",
          module: "quotes",
          moduleLabel: "Fornecedores",
          icon: Truck,
          title: q.title,
          subtitle: q.supplier?.name || "—",
          badge: q.deadline ? formatDateBR(q.deadline) : "Sem prazo",
          badgeTone: "var(--warning)",
          section: "marketing-fornecedores",
          raw: q,
        });
      }
    }

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
          section: "marketing-solicitacoes",
          raw: r,
        });
      }
    }

    if (hasAnyRole(currentUser, ["admin", "gerente_rh"])) {
      for (const r of (feriasRequests || [])) {
        if (r.status !== "pendente") continue;
        const label = RH_LEAVE_TYPES.find(t => t.id === r.type)?.label || r.type;
        out.push({
          id: `appr-ferias-${r.id}`,
          bucket: "approval",
          module: "ferias",
          moduleLabel: "Férias & Licenças",
          icon: CalendarClock,
          title: r.profiles?.name || "Colaborador",
          subtitle: label,
          badge: r.start_date ? formatDateBR(r.start_date) : "—",
          badgeTone: "var(--warning)",
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
        section: "crm",
        lead,
        raw: lead,
      });
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
            section: "rh-funcionarios",
            raw: c,
          });
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
            section: "rh-funcionarios",
            raw: c,
          });
        }

        const aniversarioDias = diasParaAniversario(c);
        if (aniversarioDias != null) {
          out.push({
            id: `alert-aniversario-${c.id}`,
            bucket: "alert",
            module: "colaboradores",
            moduleLabel: "Conformidade RH",
            icon: Users,
            title: c.fullName,
            subtitle: "Aniversário",
            badge: aniversarioDias === 0 ? "Hoje" : `Em ${aniversarioDias}d`,
            badgeTone: "var(--success)",
            section: "rh-funcionarios",
            raw: c,
          });
        }

        const bodasDias = diasParaBodasEmpresa(c);
        if (bodasDias != null) {
          out.push({
            id: `alert-bodas-${c.id}`,
            bucket: "alert",
            module: "colaboradores",
            moduleLabel: "Conformidade RH",
            icon: Users,
            title: c.fullName,
            subtitle: "Aniversário de empresa",
            badge: bodasDias === 0 ? "Hoje" : `Em ${bodasDias}d`,
            badgeTone: "var(--success)",
            section: "rh-funcionarios",
            raw: c,
          });
        }
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
          section: "rh-feedback",
          raw: f,
        });
      }
    }

    return out;
  }, [
    userId, currentUser, leads, pipelines, campaigns, deliverables, purchases, quotes,
    marketingRequests, feedbacks, feriasRequests, vagas, colaboradores, colaboradoresById,
    meuColaborador, isRHManagerUser,
  ]);

  const counts = useMemo(() => ({
    responsibility: tasks.filter(t => t.bucket === "responsibility").length,
    approval: tasks.filter(t => t.bucket === "approval").length,
    alert: tasks.filter(t => t.bucket === "alert").length,
  }), [tasks]);

  return { tasks, loading, counts };
}

export default useMyTasks;
