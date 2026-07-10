import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Bell, Globe2, Layers, BarChart3, Shuffle, UserCog,
  Settings as SettingsIcon, Bot, Workflow, Zap, LifeBuoy, Megaphone,
  Package, DollarSign, Users, BriefcaseBusiness, CalendarCheck,
  ClipboardCheck, GraduationCap, MessageSquareText, Plane, Inbox,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { NEUTRAL } from "./constants/companies";
import { STORAGE_KEYS } from "./constants/storage-keys";
import { usePipelines } from "./hooks/use-pipelines";
import { ROUTES, sectionFromPath } from "./constants/routes";
import { generateMarketSignals } from "./data/generate-signals";
import { usePersistentState } from "./hooks/use-persistent-state";
import { useCrossReferrals } from "./hooks/use-cross-referrals";
import { useUserSettings } from "./hooks/use-user-settings";
import { useSupabaseAuth } from "./hooks/use-supabase-auth";
import { useLeads } from "./hooks/use-leads";
import { useClients } from "./hooks/use-clients";
import { useNotifications } from "./hooks/use-notifications";
import { useProfiles } from "./hooks/use-profiles";
import { useInvitations } from "./hooks/use-invitations";
import { usePipelineTransitions } from "./hooks/use-pipeline-transitions";
import { useAutomations } from "./hooks/use-automations";
import { useStageFields } from "./hooks/use-stage-fields";
import { getMissingRequiredFields } from "./utils/field-conditions";
import { useMarketingCampaigns } from "./hooks/use-marketing-campaigns";
import { useMarketingRequests } from "./hooks/use-marketing-requests";
import { useRHFeriasRequests } from "./hooks/use-rh-ferias-requests";
import { useRHFeedback } from "./hooks/use-rh-feedback";
import { useRHColaboradores } from "./hooks/use-rh-colaboradores";
import { periodoExperienciaInfo, asoDiasParaVencer, contratoDiasParaFim, diasParaAniversario, diasParaBodasEmpresa } from "./utils/rh-compliance-dates";
import { RH_LEAVE_TYPES } from "./constants/rh-config";
import { useDemoData } from "./hooks/use-demo-data";
import { LoginScreen, PasswordResetScreen } from "./components/shell/LoginScreen";
import { PendingAssignmentScreen } from "./components/shell/PendingAssignmentScreen";
import { Sidebar } from "./components/shell/Sidebar";
import { TopBar } from "./components/shell/TopBar";
import { LeadDetailDrawer } from "./components/lead/LeadDetailDrawer";
import { SignalDetailDrawer } from "./components/lead/SignalDetailDrawer";
import { ImportModal } from "./components/lead/ImportModal";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { DashboardView } from "./components/views/DashboardView";
import { SignalsView } from "./components/views/SignalsView";
import { ExplorerView } from "./components/views/ExplorerView";
import { CRMView } from "./components/views/CRMView";
import { CRMViagensView } from "./components/views/CRMViagensView";
import { ExecutiveDashboard } from "./components/views/ExecutiveDashboard";
import { CrossReferralsView } from "./components/views/CrossReferralsView";
import { UserManagementView } from "./components/views/UserManagementView";
import { ClientsManager } from "./components/client/ClientsManager";
import { SettingsView } from "./components/views/SettingsView";
import { AgentActionsView } from "./components/views/AgentActionsView";
import { FairImportView } from "./components/views/FairImportView";
import { PipelineBuilderView } from "./components/views/PipelineBuilderView";
import { AutomationsView } from "./components/views/AutomationsView";
import { TutoriaisView } from "./components/views/TutoriaisView";
import { MarketingView } from "./components/views/MarketingView";
import { EntregasView } from "./components/views/EntregasView";
import { DespesasView } from "./components/views/DespesasView";
import { MarketingDashboardView } from "./components/views/MarketingDashboardView";
import { MarketingRequestsView } from "./components/views/MarketingRequestsView";
import { RHOverviewView } from "./components/views/RHOverviewView";
import { RHFuncionariosView } from "./components/views/RHFuncionariosView";
import { RHRecrutamentoView } from "./components/views/RHRecrutamentoView";
import { RHOnboardingView } from "./components/views/RHOnboardingView";
import { RHTreinamentosView } from "./components/views/RHTreinamentosView";
import { RHFeedbackView } from "./components/views/RHFeedbackView";
import { RHFeriasView } from "./components/views/RHFeriasView";
import { OnboardingModal } from "./components/onboarding/OnboardingModal";
import { CommandPalette } from "./components/ui/CommandPalette";
import { MobileBottomNav } from "./components/shell/MobileBottomNav";

const INITIAL_SIGNALS = generateMarketSignals();

export default function App() {
  // Supabase drives auth when env vars are present. When not configured, we
  // fall back to the mock picker (currentUser persisted to localStorage) so the
  // app still runs end-to-end without a backend.
  const {
    currentUser: supaUser,
    loading: supaLoading,
    error: supaError,
    signIn,
    signUp,
    signOut,
    updateAuthUser,
    resetPasswordWithToken,
    refreshProfile,
    isPasswordRecovery,
    configured: supabaseEnabled,
  } = useSupabaseAuth();

  const [mockUser, setMockUser] = usePersistentState(STORAGE_KEYS.currentUser, null);
  const currentUser = supabaseEnabled ? supaUser : mockUser;

  const [onboardingDoneMap, setOnboardingDoneMap] = usePersistentState("gs_v4_onboarding", {});
  const showOnboarding = Boolean(currentUser && !onboardingDoneMap[currentUser.id]);
  const dismissOnboarding = useCallback(() => {
    if (currentUser?.id) setOnboardingDoneMap(m => ({ ...m, [currentUser.id]: true }));
  }, [currentUser?.id, setOnboardingDoneMap]);

  const isManagerRole      = currentUser?.role === "gerente" || currentUser?.role === "admin";
  const isAdminRole        = currentUser?.role === "admin";
  // isMarketingUser: can access marketing routes (includes admin for RLS/access)
  const isMarketingUser    = ["marketing", "gerente_marketing", "admin"].includes(currentUser?.role);
  // isPureMarketing: only the marketing dept roles — drives sidebar and dashboard rendering
  const isPureMarketing    = ["marketing", "gerente_marketing"].includes(currentUser?.role);
  const isAgencia          = currentUser?.role === "agencia";
  // RH roles
  const isRHUser           = ["rh", "gerente_rh", "admin"].includes(currentUser?.role);
  const isRHManager        = ["gerente_rh", "admin"].includes(currentUser?.role);
  const isPureRH           = ["rh", "gerente_rh"].includes(currentUser?.role);
  const {
    users,
    loading: usersLoading,
    updateUser,
    deleteUser,
    setFallbackUsers: setUsers,
  } = useProfiles({ enabled: Boolean(currentUser) });
  const {
    invitations,
    loading: invitationsLoading,
    createInvitation,
    revokeInvitation,
    resendInvitation,
  } = useInvitations({ enabled: Boolean(currentUser) && supabaseEnabled && isManagerRole });
  const { pipelines, updateStage, reorderStages, resetCompanyPipeline, replacePipeline } = usePipelines();

  const {
    leads,
    addLead,
    updateLead: updateLeadRemote,
    deleteLead,
    toggleStar,
    changeStage,
    addLeadActivity,
    loadDemoLeads,
    clearAllLeads: clearAllLeadsRemote,
  } = useLeads({
    userId: currentUser?.id,
    role: currentUser?.role,
    companies: currentUser?.companies,
  });

  const {
    clients,
    loading: clientsLoading,
    createClient,
    updateClient,
    deleteClient,
  } = useClients({ userId: currentUser?.id });

  // Signals are purely derived from the current date — no need to persist.
  const [signals] = useState(INITIAL_SIGNALS);

  const { crossReferrals, approve: approveCross, reject: rejectCross } = useCrossReferrals(leads);
  const { settings, update: updateSettings, reset: resetSettings } = useUserSettings();
  const pipelineTransitions = usePipelineTransitions();
  const { evaluateAutomations } = useAutomations();
  const stageFieldsForNudge = useStageFields();

  const { campaigns } = useMarketingCampaigns({
    userId: currentUser?.id,
    role: currentUser?.role,
    companies: currentUser?.companies,
    enabled: Boolean(currentUser) && (isMarketingUser || isAgencia),
  });

  const {
    loadAllDemo: loadAllDemoData,
    loading: demoDataLoading,
    counts: demoDataCounts,
  } = useDemoData();

  const {
    notifications,
    unreadCount,
    push: pushNotification,
    markAllRead: markAllNotificationsRead,
    markRead: markNotificationRead,
    clearAll: clearAllNotifications,
    desktopPermission,
    requestDesktopPermission,
  } = useNotifications({ currentUser, leads });

  // Avisa o time de Marketing quando chega uma solicitação nova pelo
  // formulário público — antes só aparecia se alguém abrisse a aba
  // "Solicitações" manualmente. Só a primeira leva (pendentes já existentes
  // no primeiro carregamento) não dispara notificação — só as que chegam
  // depois, via Realtime.
  const { requests: marketingRequests } = useMarketingRequests({
    userId: currentUser?.id,
    role: currentUser?.role,
    enabled: Boolean(currentUser) && isMarketingUser,
  });
  const requestsVistosRef = useRef(null);
  useEffect(() => {
    if (!isMarketingUser) return;
    if (requestsVistosRef.current === null) {
      requestsVistosRef.current = new Set(marketingRequests.map(r => r.id));
      return;
    }
    for (const r of marketingRequests) {
      if (r.status === "pendente" && !requestsVistosRef.current.has(r.id)) {
        requestsVistosRef.current.add(r.id);
        pushNotification({
          type: "marketing_request",
          title: "Nova solicitação de marketing",
          body: `${r.requesterName || "Alguém"} pediu "${r.title}"${r.department ? ` (${r.department})` : ""}.`,
        });
      } else {
        requestsVistosRef.current.add(r.id);
      }
    }
  }, [marketingRequests, isMarketingUser, pushNotification]);

  // Aprovação de Férias/Licenças é centralizada no RH (não por gestor direto,
  // já que nem todo gestor tem acesso à plataforma) — então quem precisa ser
  // avisado de uma nova solicitação pendente é o time de RH (gerente_rh/admin).
  const { requests: feriasRequests } = useRHFeriasRequests({
    enabled: Boolean(currentUser) && isRHManager,
  });
  const feriasVistosRef = useRef(null);
  useEffect(() => {
    if (!isRHManager) return;
    if (feriasVistosRef.current === null) {
      feriasVistosRef.current = new Set(feriasRequests.map(r => r.id));
      return;
    }
    for (const r of feriasRequests) {
      if (r.status === "pendente" && !feriasVistosRef.current.has(r.id)) {
        feriasVistosRef.current.add(r.id);
        const tipo = RH_LEAVE_TYPES.find(t => t.id === r.type)?.label || r.type;
        pushNotification({
          type: "ferias_solicitada",
          title: "Nova solicitação de férias/licença",
          body: `${r.profiles?.name || "Alguém"} solicitou ${tipo?.toLowerCase?.() || tipo}.`,
        });
      } else {
        feriasVistosRef.current.add(r.id);
      }
    }
  }, [feriasRequests, isRHManager, pushNotification]);

  // Lembrete de prazo de autoavaliação de Feedback: avisa o próprio
  // colaborador quando o prazo (period_end) do ciclo pendente está a até 3
  // dias de vencer (ou já venceu) e ele ainda não preencheu a nota dele.
  const { feedbacks: meusCiclosFeedback } = useRHFeedback({ enabled: Boolean(currentUser) });
  const [meuColaboradorId, setMeuColaboradorId] = useState(null);
  useEffect(() => {
    if (!currentUser?.id || !isSupabaseConfigured) return;
    let active = true;
    supabase.from("rh_colaboradores").select("id").eq("profile_id", currentUser.id).maybeSingle()
      .then(({ data }) => { if (active) setMeuColaboradorId(data?.id || null); });
    return () => { active = false; };
  }, [currentUser?.id]);
  const feedbackPrazoVistoRef = useRef(new Set());
  useEffect(() => {
    if (!meuColaboradorId) return;
    const hoje = Date.now();
    for (const f of meusCiclosFeedback) {
      if (f.user_id !== meuColaboradorId || f.status === "concluido" || f.self_rating != null) continue;
      const diasParaPrazo = Math.floor((new Date(f.period_end).getTime() - hoje) / 86400000);
      if (diasParaPrazo > 3 || feedbackPrazoVistoRef.current.has(f.id)) continue;
      feedbackPrazoVistoRef.current.add(f.id);
      pushNotification({
        type: "feedback_prazo",
        title: diasParaPrazo < 0 ? "Autoavaliação atrasada" : "Autoavaliação com prazo próximo",
        body: `Sua autoavaliação vence em ${new Date(f.period_end).toLocaleDateString("pt-BR")}. Preencha na aba Feedback.`,
      });
    }
  }, [meusCiclosFeedback, meuColaboradorId, pushNotification]);

  // Lembretes de conformidade do diretório de Funcionários — período de
  // experiência CLT (45/90 dias), vencimento de ASO, fim de contrato
  // temporário e aniversário/tempo de casa. Tudo estimativa informativa,
  // avisa uma vez por dia por evento enquanto a janela estiver aberta.
  const { colaboradores: colaboradoresParaLembretes } = useRHColaboradores({
    enabled: Boolean(currentUser) && isRHManager,
  });
  const complianceVistoRef = useRef(new Set());
  useEffect(() => {
    if (!isRHManager) return;
    const hoje = new Date();
    const hojeISO = hoje.toISOString().slice(0, 10);
    const marcar = (id, tipo) => {
      const key = `${id}:${tipo}:${hojeISO}`;
      if (complianceVistoRef.current.has(key)) return false;
      complianceVistoRef.current.add(key);
      return true;
    };
    for (const c of colaboradoresParaLembretes) {
      if (c.employeeStatus !== "ativo") continue;

      const exp = periodoExperienciaInfo(c, hoje);
      if (exp && (exp.diasRestantes === 7 || exp.diasRestantes === 1) && marcar(c.id, `exp${exp.marco}`)) {
        pushNotification({
          type: "compliance_experiencia",
          title: `Período de experiência vencendo (${exp.marco} dias)`,
          body: `${c.fullName}: faltam ${exp.diasRestantes} dia(s) pra decisão do marco de ${exp.marco} dias.`,
        });
      }

      const asoDias = asoDiasParaVencer(c, hoje);
      if (asoDias != null && asoDias <= 30 && marcar(c.id, "aso")) {
        pushNotification({
          type: "compliance_aso",
          title: asoDias < 0 ? "ASO vencido" : "ASO vencendo",
          body: `${c.fullName}: exame periódico ${asoDias < 0 ? "venceu há " + Math.abs(asoDias) + " dia(s)" : "vence em " + asoDias + " dia(s)"}.`,
        });
      }

      const contratoDias = contratoDiasParaFim(c, hoje);
      if (contratoDias != null && contratoDias <= 30 && marcar(c.id, "contrato_fim")) {
        pushNotification({
          type: "compliance_contrato",
          title: contratoDias < 0 ? "Contrato temporário venceu" : "Fim de contrato temporário se aproximando",
          body: `${c.fullName}: contrato ${contratoDias < 0 ? "venceu há " + Math.abs(contratoDias) + " dia(s)" : "termina em " + contratoDias + " dia(s)"}.`,
        });
      }

      if (diasParaAniversario(c, hoje) === 0 && marcar(c.id, "aniversario")) {
        pushNotification({ type: "aniversario", title: "Aniversário hoje 🎂", body: `Hoje é aniversário de ${c.fullName}.` });
      }

      if (diasParaBodasEmpresa(c, hoje) === 0 && marcar(c.id, "bodas_empresa")) {
        const anos = hoje.getFullYear() - new Date(c.admissionDate).getFullYear();
        pushNotification({ type: "bodas_empresa", title: "Aniversário de empresa", body: `${c.fullName} completa ${anos} ano(s) de casa hoje.` });
      }
    }
  }, [colaboradoresParaLembretes, isRHManager, pushNotification]);

  const [activeCompany, setActiveCompany] = useState("all");
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
  const [crmAutoCreate, setCrmAutoCreate] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [clientImportOpen, setClientImportOpen] = useState(false);

  const closeSignalDrawer = useCallback(() => setSelectedSignal(null), []);

  useEffect(() => {
    document.body.style.overflow = sidebarMobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarMobileOpen]);

  // Global Cmd+K / Ctrl+K shortcut to open the command palette
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Roteamento ──────────────────────────────────────────────────────────
  // section vem direto da URL. Mudar de tela é navigate(ROUTES[id]) — a URL
  // muda e o useLocation re-renderiza. Mantém todas as condicionais (if
  // section === "x") funcionando sem refactor maior.
  const location = useLocation();
  const navigate = useNavigate();
  const section = sectionFromPath(location.pathname);
  const setSection = useCallback((id) => {
    const path = ROUTES[id];
    if (path) navigate(path);
  }, [navigate]);

  // Mantém o drawer em sync quando o lead aberto muda via realtime
  // (outra sessão editou) ou via update otimista local.
  useEffect(() => {
    if (!selectedLead) return;
    const fresh = leads.find(l => l.id === selectedLead.id);
    if (!fresh) { setSelectedLead(null); return; }
    if (fresh === selectedLead) return;
    setSelectedLead(fresh);
  }, [leads, selectedLead]);

  // Lifted to App so the parsed file, fair name, and import status survive
  // tab switches. (Switching tabs unmounts FairImportView, which would
  // otherwise reset its local useState.)
  const [fairImportState, setFairImportState] = useState({
    fairName: "",
    phase: "idle",
    rows: [],
    importResult: null,
    importing: false,
  });

  const clearLocalData = useCallback(() => {
    try {
      for (const key of Object.values(STORAGE_KEYS)) {
        window.localStorage.removeItem(key);
      }
    } catch {}
    window.location.reload();
  }, []);

  const clearAllLeads = useCallback(async () => {
    await clearAllLeadsRemote();
    setSelectedLead(null);
  }, [clearAllLeadsRemote]);

  // FIX B5: track the previous user id via a ref so this effect only reacts
  // to actual login changes, not to the reference-swap that happens when the
  // drawer updates the current user object.
  const lastUserIdRef = useRef(currentUser?.id ?? null);
  useEffect(() => {
    const id = currentUser?.id ?? null;
    if (id === lastUserIdRef.current) return;
    lastUserIdRef.current = id;
    if (!currentUser) return;
    if (currentUser.role === "vendedor" || currentUser.role === "consultor") {
      if (currentUser.companies.length === 1) {
        setActiveCompany(currentUser.companies[0]);
      } else if (activeCompany !== "all" && !currentUser.companies.includes(activeCompany)) {
        setActiveCompany(currentUser.companies[0] || "all");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const handleMockLogin = useCallback((u) => {
    setMockUser(u);
    if (u.role === "gerente" || u.role === "admin") setActiveCompany("all");
    else setActiveCompany(u.companies?.[0] || "all");
    setSection("dashboard");
  }, [setMockUser]);

  const handleLogout = useCallback(async () => {
    if (supabaseEnabled) {
      try { await signOut(); } catch {}
    } else {
      setMockUser(null);
    }
    setActiveCompany("all");
    setSelectedLead(null);
  }, [supabaseEnabled, signOut, setMockUser]);

  const updateLead = useCallback(async (id, patch) => {
    // Notify if lead gets assigned to current user
    const lead = leads.find(l => l.id === id);
    const shouldNotify = patch.owner && patch.owner === currentUser?.id && lead && lead.owner !== currentUser?.id;
    setSelectedLead(prev => (prev && prev.id === id ? { ...prev, ...patch } : prev));
    await updateLeadRemote(id, patch);
    if (shouldNotify) {
      pushNotification({
        type: 'lead_assigned',
        title: 'Lead atribuído a você',
        body: `${lead.company} foi atribuído à sua carteira.`,
        leadId: id,
        companyId: lead?.companyId,
      });
    }
  }, [updateLeadRemote, currentUser, leads, pushNotification]);

  // Executa os efeitos colaterais de automação que precisam de uma chamada
  // real (não são um simples patch síncrono no lead): criar uma entrega em
  // outro módulo (Marketing) ou enriquecer o lead via busca de CNPJ. Falha
  // de um efeito não deve travar o fluxo principal do CRM.
  const processAutomationSideEffects = useCallback(async (sideEffects) => {
    for (const effect of (sideEffects || [])) {
      try {
        if (effect.type === "create_deliverable") {
          await supabase.rpc("crm_create_cross_module_deliverable", {
            p_title: effect.title,
            p_company_ids: effect.companyIds,
            p_description: effect.description,
            p_priority: effect.priority,
          });
        }
        if (effect.type === "enrich_cnpj" && effect.cnpj) {
          const { data: res, error } = await supabase.functions.invoke("cnpj-lookup", { body: { cnpj: effect.cnpj } });
          if (!error && res && !res.error) {
            const current = leads.find(l => l.id === effect.leadId);
            const patch = {};
            if (current) {
              if (!current.sector && res.sector) patch.sector = res.sector;
              if (!current.city && res.city) patch.city = res.city;
              if (!current.state && res.state) patch.state = res.state;
              if (!current.cnae && res.cnae) patch.cnae = res.cnae;
              if (!current.situacao && res.situacao) patch.situacao = res.situacao;
            }
            if (Object.keys(patch).length > 0) {
              await updateLeadRemote(effect.leadId, patch).catch(() => {});
            }
          }
        }
      } catch {
        // Ignora — automação não deve travar o fluxo do CRM.
      }
    }
  }, [leads, updateLeadRemote]);

  const handleStageChange = useCallback(async (id, stage) => {
    const prev = leads.find(l => l.id === id);
    await changeStage(id, stage);
    if (prev && prev.stage !== stage) {
      const updated = { ...prev, stage, stageChangedAt: new Date().toISOString() };
      const { patches, notifications: autoNotifs, sideEffects } = evaluateAutomations(updated, prev, "stage_change");
      for (const p of patches) {
        await updateLeadRemote(p.leadId, p.patch).catch(() => {});
      }
      if (sideEffects?.length) await processAutomationSideEffects(sideEffects);
      // Notify on terminal stage changes
      if (stage === "ganho") {
        pushNotification({ type: "lead_won", title: "Negócio fechado!", body: `${prev.company} foi marcado como ganho.`, leadId: id, companyId: prev.companyId });
      } else if (stage === "perdido") {
        pushNotification({ type: "lead_lost", title: "Lead marcado como perdido", body: `${prev.company} foi movido para Perdido.`, leadId: id, companyId: prev.companyId });
      }
      // Notify for each automation that fired
      for (const n of (autoNotifs || [])) {
        pushNotification({ type: "automation", title: `Automação: ${n.ruleName}`, body: n.message, leadId: id, companyId: prev.companyId });
      }
    }
  }, [changeStage, leads, evaluateAutomations, updateLeadRemote, pushNotification, processAutomationSideEffects]);

  // Wrapped addLead that fires lead_created automations after creation
  const handleAddLead = useCallback(async (lead) => {
    await addLead(lead);
    const { patches, notifications: autoNotifs, sideEffects } = evaluateAutomations(lead, null, "lead_created");
    for (const p of patches) {
      await updateLeadRemote(p.leadId, p.patch).catch(() => {});
    }
    if (sideEffects?.length) await processAutomationSideEffects(sideEffects);
    for (const n of (autoNotifs || [])) {
      pushNotification({ type: "automation", title: `Automação: ${n.ruleName}`, body: n.message, leadId: lead.id, companyId: lead.companyId });
    }
  }, [addLead, evaluateAutomations, updateLeadRemote, pushNotification, processAutomationSideEffects]);

  // Nudges por tempo: os gatilhos "time_in_stage" e "pending_required_field"
  // não disparam em nenhum evento do CRM (não são mudança de etapa nem
  // criação) — precisam de uma varredura periódica. A própria tela de
  // Automações já dizia "o avaliador roda ao abrir o CRM", mas isso nunca
  // tinha sido implementado; time_in_stage ficava morto. Dedup por
  // localStorage (chave regra+lead+stageChangedAt) pra não repetir a mesma
  // notificação a cada scan.
  const [notifiedNudges, setNotifiedNudges] = usePersistentState("gs_v4_nudges_notified", {});
  useEffect(() => {
    if (!leads.length) return;
    const scan = () => {
      const newlyNotified = {};
      for (const lead of leads) {
        const fields = stageFieldsForNudge.getFields(lead.companyId, lead.stage);
        const missing = getMissingRequiredFields(fields, lead.customFields || {});
        const enriched = { ...lead, _missingRequiredFields: missing };
        const { notifications: staleNotifs } = evaluateAutomations(lead, lead, "time_in_stage");
        const { notifications: pendingNotifs } = evaluateAutomations(enriched, enriched, "pending_required_field");
        for (const n of [...staleNotifs, ...pendingNotifs]) {
          const key = `${n.ruleId}:${lead.id}:${lead.stageChangedAt}`;
          if (notifiedNudges[key]) continue;
          newlyNotified[key] = true;
          pushNotification({ type: "automation", title: `Automação: ${n.ruleName}`, body: n.message, leadId: lead.id, companyId: lead.companyId });
        }
      }
      if (Object.keys(newlyNotified).length > 0) {
        setNotifiedNudges(prev => ({ ...prev, ...newlyNotified }));
      }
    };
    scan();
    const interval = setInterval(scan, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [leads, stageFieldsForNudge, evaluateAutomations, notifiedNudges, pushNotification, setNotifiedNudges]);

  const closeDrawer = useCallback(() => setSelectedLead(null), []);

  const isManager      = isManagerRole;

  // Respects settings.enabledCompanies — the user can toggle a company off from
  // the Settings view without deleting data or editing code.
  const accessibleCompanies = useMemo(() => {
    if (!currentUser) return [];
    const enabled = new Set(settings.enabledCompanies);
    const base = isManager
      ? ["industria", "resibag"]
      : currentUser.companies;
    const filtered = base.filter(id => enabled.has(id));
    if (filtered.length === 0) return []; // edge case: user disabled all
    return filtered.length > 1 ? ["all", ...filtered] : filtered;
  }, [currentUser, settings.enabledCompanies, isManager]);

  // Keep activeCompany valid when enabled list changes.
  useEffect(() => {
    if (accessibleCompanies.length === 0) return;
    if (!accessibleCompanies.includes(activeCompany)) {
      setActiveCompany(accessibleCompanies[0]);
    }
  }, [accessibleCompanies, activeCompany]);

  const navGroups = useMemo(() => {
    // Agência: only Campanhas + Entregas, nothing else.
    if (isAgencia) {
      return [
        {
          label: "Marketing",
          items: [
            { id: "marketing",          label: "Campanhas", icon: Megaphone },
            { id: "marketing-entregas", label: "Entregas",  icon: Package },
          ],
        },
      ];
    }

    const groups = [];

    if (!isPureMarketing) {
      groups.push({
        label: "Comercial",
        items: [
          { id: "commercial-overview", label: "Visão Geral", icon: LayoutDashboard },
          { id: "crm",          label: "Pipeline",   icon: Layers },
          { id: "signals",      label: "Sinais",     icon: Bell },
          { id: "explorer",     label: "Explorador", icon: Globe2 },
          { id: "crm-viagens",  label: "Viagens",    icon: Plane },
        ],
      });
    } else {
      groups.push({
        label: null,
        items: [
          { id: "dashboard", label: "Início", icon: LayoutDashboard },
        ],
      });
    }

    if (isMarketingUser) {
      const mktItems = [];
      // Admin and gerente see "Visão Geral" (Marketing Dashboard) since their
      // "Início" points to the CRM dashboard, not the Marketing one.
      if (isManager) {
        mktItems.push({ id: "marketing-home", label: "Visão Geral", icon: LayoutDashboard });
      }
      mktItems.push(
        { id: "marketing",                label: "Campanhas",    icon: Megaphone },
        { id: "marketing-solicitacoes",   label: "Solicitações", icon: Inbox },
        { id: "marketing-entregas",       label: "Entregas",     icon: Package },
        { id: "marketing-despesas",       label: "Despesas",     icon: DollarSign }
      );
      groups.push({ label: "Marketing", items: mktItems });
    }

    if (isRHUser) {
      groups.push({
        label: "Recursos Humanos",
        items: [
          { id: "rh-overview",     label: "Visão Geral",      icon: LayoutDashboard },
          { id: "rh-funcionarios", label: "Funcionários",      icon: Users },
          { id: "rh-recrutamento", label: "Recrutamento",      icon: BriefcaseBusiness },
          { id: "rh-onboarding",   label: "Onboarding",        icon: ClipboardCheck },
          { id: "rh-treinamentos", label: "Treinamentos",      icon: GraduationCap },
          { id: "rh-feedback",     label: "Feedback",          icon: MessageSquareText },
          { id: "rh-ferias",       label: "Férias & Licenças", icon: CalendarCheck },
        ],
      });
    } else {
      // Todo colaborador (não só RH) precisa ver seu próprio checklist de
      // onboarding, treinamentos atribuídos e feedbacks — não é uma tela de
      // gestão de RH.
      groups.push({
        label: "Meu Desenvolvimento",
        items: [
          { id: "rh-onboarding",   label: "Onboarding",   icon: ClipboardCheck },
          { id: "rh-treinamentos", label: "Treinamentos", icon: GraduationCap },
          { id: "rh-feedback",     label: "Feedback",     icon: MessageSquareText },
        ],
      });
    }

    if (isManager) {
      groups.push({
        label: "Inteligência",
        items: [
          { id: "executive", label: "Executivo",  icon: BarChart3 },
          { id: "crossref",  label: "Cross-sell", icon: Shuffle },
          { id: "agents",    label: "Agentes",    icon: Bot },
        ],
      });

      groups.push({
        label: "Configuração",
        items: [
          { id: "pipeline-builder", label: "Construtor de pipeline", icon: Workflow },
          { id: "automations",      label: "Automações",             icon: Zap },
          { id: "settings",         label: "Configurações",          icon: SettingsIcon },
        ],
      });
    }

    groups.push({
      label: null,
      items: [
        { id: "tutorials", label: "Ajuda & Tutoriais", icon: LifeBuoy },
      ],
    });
    return groups;
  }, [isManager, isMarketingUser, isPureMarketing, isAgencia]);

  // Title shown in the slim top bar, derived from the active section.
  const sectionTitle = useMemo(() => {
    if (section === "settings" && !isManager)          return "Meu perfil";
    if (section === "marketing-home")                  return "Visão Geral · Marketing";
    if (section === "marketing-solicitacoes")          return "Solicitações · Marketing";
    for (const g of navGroups) {
      const hit = g.items.find(i => i.id === section);
      if (hit) return hit.label;
    }
    return "";
  }, [navGroups, section, isManager]);

  // Keep vendedor off restricted sections even if state was stale.
  useEffect(() => {
    // Don't redirect while auth is still loading — currentUser is null and
    // all role flags are false, which would kick the user to "/" on refresh.
    if (!currentUser) return;

    const managerOnly = ["executive", "agents", "crossref", "funnel-history", "pipeline-builder", "automations", "fair-import", "users"];
    if (!isManager && managerOnly.includes(section)) {
      setSection("dashboard");
    }
    const marketingOnly = ["marketing", "marketing-entregas", "marketing-despesas", "marketing-solicitacoes"];
    if (!isMarketingUser && !isAgencia && marketingOnly.includes(section)) {
      setSection("dashboard");
    }
    // Agência não acessa Solicitações (área interna de marketing)
    if (isAgencia && section === "marketing-solicitacoes") {
      setSection("marketing");
    }
    // Pure marketing users shouldn't access CRM sections
    const crmSections = ["crm", "signals", "explorer", "crm-viagens", "commercial-overview"];
    if (isPureMarketing && crmSections.includes(section)) {
      setSection("dashboard");
    }
    // RH sections only for rh/gerente_rh/admin
    // Onboarding/Treinamentos ficam de fora do guard — todo colaborador acessa
    // o próprio checklist, não só o time de RH (RLS já restringe os dados).
    const rhSections = ["rh-overview", "rh-funcionarios", "rh-recrutamento", "rh-ferias"];
    if (!isRHUser && rhSections.includes(section)) {
      setSection("dashboard");
    }
    // Pure RH users shouldn't access CRM sections
    if (isPureRH && crmSections.includes(section)) {
      setSection("rh-overview");
    }
    // Agência can access marketing routes + their own profile (settings).
    const agenciaBlocked = ["crm", "signals", "explorer", "crm-viagens", "commercial-overview", "marketing-despesas", "dashboard", "tutorials"];
    if (isAgencia && agenciaBlocked.includes(section)) {
      setSection("marketing");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, isManager, isMarketingUser, isPureMarketing, isAgencia, section]);

  if (supabaseEnabled && supaLoading && !currentUser) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: NEUTRAL.warmWhite, color: NEUTRAL.slate }}
      >
        <div className="text-xs uppercase tracking-widest" style={{ letterSpacing: "0.15em" }}>
          Carregando…
        </div>
      </div>
    );
  }

  if (supabaseEnabled && isPasswordRecovery) {
    return <PasswordResetScreen onReset={resetPasswordWithToken} />;
  }

  if (!currentUser) {
    return (
      <LoginScreen
        supabaseEnabled={supabaseEnabled}
        authError={supaError}
        authLoading={supaLoading}
        onSignIn={signIn}
        onSignUp={signUp}
        users={users}
        onMockLogin={handleMockLogin}
      />
    );
  }

  // Vendedor signed up but admin hasn't assigned any company yet. Blocks the
  // rest of the app (blank dashboards, empty leads) and gives them a clear
  // path: wait, refresh, or log out.
  if (
    supabaseEnabled &&
    (currentUser.role === "vendedor" || currentUser.role === "consultor") &&
    (!currentUser.companies || currentUser.companies.length === 0)
  ) {
    return (
      <PendingAssignmentScreen
        currentUser={currentUser}
        onRefresh={refreshProfile}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div
      style={{
        background: "var(--bg)",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#201a1a",
        minHeight: "100vh",
        width: "100%",
        maxWidth: "100vw",
        overflowX: "clip",
      }}
    >
      <Sidebar
        navGroups={navGroups}
        section={section}
        onSectionChange={setSection}
        currentUser={currentUser}
        onLogout={handleLogout}
        mobileOpen={sidebarMobileOpen}
        onMobileClose={() => setSidebarMobileOpen(false)}
        onNewLead={() => { setSection("crm"); navigate(ROUTES.crm); setCrmAutoCreate(true); }}
      />

      <div className="flex flex-col min-w-0 lg:ml-[288px]" style={{ minHeight: "100vh", overflowX: "clip" }}>
        <TopBar
          title={sectionTitle}
          onMenuToggle={() => setSidebarMobileOpen(v => !v)}
          onSearchOpen={() => setCmdOpen(true)}
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAllRead={markAllNotificationsRead}
          onMarkRead={markNotificationRead}
          onClearAll={clearAllNotifications}
          desktopPermission={desktopPermission}
          onRequestDesktopPermission={requestDesktopPermission}
          onSelectLead={(leadId) => {
            const lead = leads.find(l => l.id === leadId);
            if (lead) setSelectedLead(lead);
          }}
          onHelpClick={() => setSection("tutorials")}
        />

        <div className="px-4 py-4 sm:px-6 sm:py-6 lg:py-6 pb-24 lg:pb-6 flex-1 min-w-0">
        <ErrorBoundary
          fallback={({ error, reset }) => (
            <div className="rounded-xl border p-6 max-w-2xl mx-auto mt-8" style={{ background: "#FEF2F2", borderColor: "#FECACA" }}>
              <div className="font-bold text-base mb-2" style={{ color: "#B91C1C" }}>
                Erro ao carregar esta tela
              </div>
              <div className="text-xs mb-3" style={{ color: "#7F1D1D" }}>
                Algo travou no carregamento. Tente voltar ao Início ou recarregar a página.
              </div>
              <div className="text-[11px] font-mono p-2 rounded mb-3" style={{ background: "#FFF", color: "#7F1D1D", whiteSpace: "pre-wrap", maxHeight: 160, overflow: "auto" }}>
                {error?.message || String(error)}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setSection("dashboard"); reset(); }}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg"
                        style={{ background: "var(--accent)", color: "#FFFFFF" }}>
                  Voltar ao Início
                </button>
                <button onClick={() => window.location.reload()}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border"
                        style={{ borderColor: "#D1D5DB", color: NEUTRAL.graphite, background: "#FFFFFF" }}>
                  Recarregar
                </button>
              </div>
            </div>
          )}
          key={section}
        >
        <Routes>
          <Route path={ROUTES.dashboard} element={
            isAgencia ? (
              <Navigate to={ROUTES.marketing} replace />
            ) : isPureRH ? (
              <Navigate to={ROUTES["rh-overview"]} replace />
            ) : isPureMarketing ? (
              <MarketingDashboardView user={currentUser} />
            ) : isAdminRole ? (
              <Navigate to={ROUTES.executive} replace />
            ) : (
              <DashboardView
                user={currentUser}
                activeCompany={activeCompany}
                leads={leads}
                users={users}
                pipelines={pipelines}
                onNavigate={setSection}
                onLeadClick={setSelectedLead}
                visibleWidgets={settings.visibleDashboardWidgets}
              />
            )
          } />
          <Route path={ROUTES["commercial-overview"]} element={
            (isAgencia || isPureMarketing || isPureRH)
              ? <Navigate to={ROUTES.dashboard} replace />
              : (
                <DashboardView
                  user={currentUser}
                  activeCompany={activeCompany}
                  leads={leads}
                  users={users}
                  pipelines={pipelines}
                  onNavigate={setSection}
                  onLeadClick={setSelectedLead}
                  visibleWidgets={settings.visibleDashboardWidgets}
                />
              )
          } />
          <Route path={ROUTES.signals} element={
            isAgencia ? <Navigate to={ROUTES.marketing} replace /> : (
              <SignalsView
                activeCompany={activeCompany}
                signals={signals}
                onSignalClick={setSelectedSignal}
                onAddLead={handleAddLead}
                accessibleCompanies={accessibleCompanies}
              />
            )
          } />
          <Route path={ROUTES.explorer} element={
            isAgencia ? <Navigate to={ROUTES.marketing} replace /> : (
              <ExplorerView
                user={currentUser}
                activeCompany={activeCompany}
                leads={leads}
                users={users}
                onLeadClick={setSelectedLead}
                onStarToggle={toggleStar}
                onLoadDemoLeads={loadDemoLeads}
                onGoToSettings={() => setSection("settings")}
                onAddLead={handleAddLead}
                accessibleCompanies={accessibleCompanies}
                fairImportPanel={isManager ? (
                  <FairImportView
                    addLead={handleAddLead}
                    leads={leads}
                    users={users}
                    currentUser={currentUser}
                    state={fairImportState}
                    setState={setFairImportState}
                  />
                ) : undefined}
              />
            )
          } />
          <Route path={ROUTES.crm} element={
            isAgencia ? <Navigate to={ROUTES.marketing} replace /> : <CRMView
              user={currentUser}
              activeCompany={activeCompany}
              accessibleCompanies={accessibleCompanies}
              onCompanyChange={setActiveCompany}
              leads={leads}
              pipelines={pipelines}
              users={users}
              onLeadClick={setSelectedLead}
              onStageChange={handleStageChange}
              onAddLead={handleAddLead}
              visibleStages={settings.visibleKanbanStages}
              pipelineTransitions={pipelineTransitions}
              clients={clients}
              onCreateClient={createClient}
              autoOpenCreate={crmAutoCreate}
              onAutoOpenHandled={() => setCrmAutoCreate(false)}
              onOpenImport={isManager ? () => setClientImportOpen(true) : undefined}
            />
          } />
          <Route path={ROUTES["crm-viagens"]} element={
            isAgencia || isPureMarketing || isPureRH
              ? <Navigate to={ROUTES.dashboard} replace />
              : <CRMViagensView currentUser={currentUser} leads={leads} users={users} pushNotification={pushNotification} />
          } />
          <Route path={ROUTES.agents} element={
            isManager
              ? <AgentActionsView currentUser={currentUser} activeCompany={activeCompany} />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          {/* fair-import is now a tab inside ExplorerView */}
          <Route path={ROUTES["fair-import"]} element={
            <Navigate to={ROUTES.explorer} replace />
          } />
          <Route path={ROUTES.executive} element={
            isManager
              ? <ExecutiveDashboard leads={leads} crossReferrals={crossReferrals} pipelines={pipelines} users={users} currentUser={currentUser} activeCompany={activeCompany} visibleWidgets={settings.visibleExecutiveWidgets} />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          {/* Antiga rota /presidencia foi fundida no Executivo. Redireciona
              quem tem o link salvo. */}
          <Route path={ROUTES.presidency} element={<Navigate to={ROUTES.executive} replace />} />
          {/* funnel-history is now a tab inside ExecutiveDashboard */}
          <Route path={ROUTES["funnel-history"]} element={
            <Navigate to={ROUTES.executive} replace />
          } />
          <Route path={ROUTES["pipeline-builder"]} element={
            isManager ? (
              <PipelineBuilderView
                pipelines={pipelines}
                transitions={pipelineTransitions}
                accessibleCompanies={accessibleCompanies}
                onReplacePipeline={replacePipeline}
                onResetPipeline={resetCompanyPipeline}
                leads={leads}
              />
            ) : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES.automations} element={
            isManager ? (
              <AutomationsView
                leads={leads}
                pipelines={pipelines}
                activeCompany={activeCompany}
                currentUser={currentUser}
              />
            ) : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES.crossref} element={
            isManager ? (
              <CrossReferralsView
                crossReferrals={crossReferrals}
                users={users}
                onApprove={approveCross}
                onReject={rejectCross}
              />
            ) : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES.users} element={
            isManager ? <Navigate to={ROUTES.settings} replace /> : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES.settings} element={
            <SettingsView
              settings={settings}
              onUpdate={updateSettings}
              onReset={resetSettings}
              onClearLocalData={clearLocalData}
              currentUser={currentUser}
              leadsCount={leads.length}
              onLoadDemoLeads={loadDemoLeads}
              onClearAllLeads={clearAllLeads}
              onLoadAllDemoData={isManager ? loadAllDemoData : undefined}
              demoDataLoading={demoDataLoading}
              demoDataCounts={demoDataCounts}
              onUpdateUser={updateUser}
              onUpdateAuthUser={supabaseEnabled ? updateAuthUser : null}
              onUpdateMockUser={supabaseEnabled ? null : setMockUser}
              supabaseEnabled={supabaseEnabled}
              isManager={isManager}
              onOpenClientImport={isManager ? () => setClientImportOpen(true) : null}
              clientsPanel={isManager ? (
                <ClientsManager
                  clients={clients}
                  loading={clientsLoading}
                  onCreate={createClient}
                  onUpdate={updateClient}
                  onDelete={deleteClient}
                  canDelete={isManager}
                />
              ) : null}
              usersPanel={isManager ? (
                <UserManagementView
                  users={users}
                  leads={leads}
                  onUsersChange={setUsers}
                  onUpdateUser={supabaseEnabled ? updateUser : undefined}
                  onDeleteUser={supabaseEnabled ? deleteUser : undefined}
                  supabaseEnabled={supabaseEnabled}
                  loading={usersLoading}
                  currentUser={currentUser}
                  invitations={invitations}
                  invitationsLoading={invitationsLoading}
                  onCreateInvitation={createInvitation}
                  onRevokeInvitation={revokeInvitation}
                  onResendInvitation={supabaseEnabled ? resendInvitation : undefined}
                />
              ) : null}
            />
          } />
          <Route path={ROUTES.tutorials} element={
            <TutoriaisView currentUser={currentUser} onNavigate={setSection} />
          } />
          <Route path={ROUTES["marketing-home"]} element={
            isMarketingUser
              ? <MarketingDashboardView user={currentUser} />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES.marketing} element={
            (isMarketingUser || isAgencia)
              ? <MarketingView user={currentUser} users={users} evaluateAutomations={evaluateAutomations} pushNotification={pushNotification} />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES["marketing-entregas"]} element={
            (isMarketingUser || isAgencia)
              ? <EntregasView user={currentUser} users={users} />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES["marketing-despesas"]} element={
            (isMarketingUser && !isAgencia)
              ? <DespesasView user={currentUser} users={users} campaigns={campaigns} />
              : <Navigate to={ROUTES.marketing} replace />
          } />
          <Route path={ROUTES["marketing-solicitacoes"]} element={
            (isMarketingUser && !isAgencia)
              ? <MarketingRequestsView user={currentUser} users={users} />
              : <Navigate to={ROUTES.marketing} replace />
          } />
          <Route path={ROUTES["rh-overview"]} element={
            isRHUser
              ? <RHOverviewView currentUser={currentUser} canWrite={isRHManager} onNavigate={setSection} />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES["rh-funcionarios"]} element={
            isRHUser
              ? <RHFuncionariosView
                  users={users}
                  leads={leads}
                  currentUser={currentUser}
                  onUpdateUser={updateUser}
                  canWrite={isRHManager}
                />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES["rh-recrutamento"]} element={
            isRHUser
              ? <RHRecrutamentoView
                  user={currentUser}
                  canWrite={isRHManager}
                />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES["rh-onboarding"]} element={
            <RHOnboardingView currentUser={currentUser} canWrite={isRHManager} isRHUser={isRHUser} />
          } />
          <Route path={ROUTES["rh-treinamentos"]} element={
            <RHTreinamentosView currentUser={currentUser} canWrite={isRHManager} isRHUser={isRHUser} users={users} />
          } />
          <Route path={ROUTES["rh-feedback"]} element={
            <RHFeedbackView currentUser={currentUser} canWrite={isRHManager} isRHUser={isRHUser} />
          } />
          <Route path={ROUTES["rh-ferias"]} element={
            isRHUser
              ? <RHFeriasView currentUser={currentUser} users={users} canWrite={isRHManager} />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES.profile} element={<Navigate to={ROUTES.settings} replace />} />
          {/* Catch-all: rota desconhecida volta pro Início. */}
          <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
        </Routes>
        </ErrorBoundary>
        </div>

        <footer
          className="px-6 py-4 border-t text-xs flex items-center justify-between flex-wrap gap-2"
          style={{ background: "#FFFFFF", borderColor: "#E5E7EB", color: NEUTRAL.slate }}
        >
          <div className="font-medium" style={{ letterSpacing: "0.01em" }}>
            Gestão Sanwey
          </div>
          <div style={{ color: NEUTRAL.slate }}>
            Maio 2026
          </div>
        </footer>

        <div className="lg:hidden">
          <MobileBottomNav
            section={section}
            onSectionChange={setSection}
            role={currentUser?.role}
            navGroups={navGroups}
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        </div>
      </div>

      <ErrorBoundary>
        <LeadDetailDrawer
          lead={selectedLead}
          onClose={closeDrawer}
          onUpdate={updateLead}
          onDelete={deleteLead}
          onAddActivity={addLeadActivity}
          allLeads={leads}
          users={users}
          clients={clients}
          onCreateClient={createClient}
          isManager={isManager}
          currentUser={currentUser}
          onNavigateToPipelineBuilder={() => { closeDrawer(); setSection("pipeline-builder"); }}
        />
      </ErrorBoundary>

      {showOnboarding && (
        <OnboardingModal currentUser={currentUser} onDone={dismissOnboarding} />
      )}

      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        leads={leads}
        campaigns={isMarketingUser || isAgencia ? campaigns : []}
        employees={isRHUser ? users.filter(u => u.role === "rh" || u.role === "gerente_rh" || u.department) : []}
        users={users}
        pipelines={pipelines}
        onSelectLead={(lead) => { setSelectedLead(lead); setCmdOpen(false); }}
        onSelectCampaign={() => { setSection("marketing"); setCmdOpen(false); }}
        onSelectEmployee={() => { setSection("rh-funcionarios"); setCmdOpen(false); }}
      />

      <ImportModal
        isOpen={clientImportOpen}
        onClose={() => setClientImportOpen(false)}
        users={users}
        currentUser={currentUser}
        onAddLead={handleAddLead}
        companies={accessibleCompanies || []}
      />

      <ErrorBoundary>
        <SignalDetailDrawer
          signal={selectedSignal}
          onClose={closeSignalDrawer}
          onAddLead={handleAddLead}
          currentUser={currentUser}
          users={users}
          pipelines={pipelines}
        />
      </ErrorBoundary>
    </div>
  );
}
