import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Bell, Globe2, Layers, BarChart3, Shuffle, UserCog,
  Settings as SettingsIcon, Bot, Zap, LifeBuoy, Megaphone,
  Package, DollarSign, Users, BriefcaseBusiness, CalendarCheck,
  ClipboardCheck, GraduationCap, MessageSquareText, Plane, Inbox, Truck,
  ShoppingCart, CheckSquare, Building2, TrendingUp, Briefcase, HeartHandshake, Home,
  FileBarChart, RefreshCw, Sparkles,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { STORAGE_KEYS } from "./constants/storage-keys";
import { usePipelines } from "./hooks/use-pipelines";
import { ROUTES, sectionFromPath } from "./constants/routes";
import { useModuleOverrides } from "./hooks/use-module-overrides";
import { effectiveModules, ALL_MODULE_IDS } from "./utils/module-access";
import { generateMarketSignals } from "./data/generate-signals";
import { usePersistentState } from "./hooks/use-persistent-state";
import { useCrossReferrals } from "./hooks/use-cross-referrals";
import { useUserSettings } from "./hooks/use-user-settings";
import { useSupabaseAuth } from "./hooks/use-supabase-auth";
import { useLeads } from "./hooks/use-leads";
import { useClients } from "./hooks/use-clients";
import { useNotifications } from "./hooks/use-notifications";
import { useServerNotifications } from "./hooks/use-server-notifications";
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
import { useCRMDespesas } from "./hooks/use-crm-despesas";
import { periodoExperienciaInfo, asoDiasParaVencer, contratoDiasParaFim, diasParaAniversario, diasParaBodasEmpresa, aprendizDiasParaFim, contratoFornecedorDiasParaVencer } from "./utils/rh-compliance-dates";
import { avaliacaoDiasParaProxima, cicloTipoLabel } from "./utils/rh-feedback-cycles";
import { useRHSuppliers } from "./hooks/use-rh-suppliers";
import { useRHBemEstar } from "./hooks/use-rh-bemestar";
import { sendRhEmail } from "./utils/rh-send-email";
import { RH_LEAVE_TYPES } from "./constants/rh-config";
import { useDemoData } from "./hooks/use-demo-data";
import { LoginScreen, PasswordResetScreen } from "./components/shell/LoginScreen";
import { PendingAssignmentScreen } from "./components/shell/PendingAssignmentScreen";
import { TermsGateScreen } from "./components/shell/TermsGateScreen";
import { useTermsAcceptance } from "./hooks/use-terms-acceptance";
import { Sidebar } from "./components/shell/Sidebar";
import { TopBar } from "./components/shell/TopBar";
import { LeadDetailDrawer } from "./components/lead/LeadDetailDrawer";
import { useRecordViews } from "./hooks/use-record-views";
import { reopenAfterMove } from "./utils/reopen-after-move";
import { SignalDetailDrawer } from "./components/lead/SignalDetailDrawer";
import { ImportModal } from "./components/lead/ImportModal";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { DashboardView } from "./components/views/DashboardView";
import { SignalsView } from "./components/views/SignalsView";
import { ExplorerView } from "./components/views/ExplorerView";
import { CRMView } from "./components/views/CRMView";
import { CRMViagensView } from "./components/views/CRMViagensView";
import { ExecutiveDashboard } from "./components/views/ExecutiveDashboard";
import { InsightsView } from "./components/views/InsightsView";
import { CrossReferralsView } from "./components/views/CrossReferralsView";
import { UserManagementView } from "./components/views/UserManagementView";
import { ClientsManager } from "./components/client/ClientsManager";
import { SettingsView } from "./components/views/SettingsView";
import { AgentActionsView } from "./components/views/AgentActionsView";
import { FairImportView } from "./components/views/FairImportView";
import { AutomationsView } from "./components/views/AutomationsView";
import { TutoriaisView } from "./components/views/TutoriaisView";
import { MarketingView } from "./components/views/MarketingView";
import { EntregasView } from "./components/views/EntregasView";
import { DespesasView } from "./components/views/DespesasView";
import { MarketingDashboardView } from "./components/views/MarketingDashboardView";
import { MinhasTarefasView } from "./components/views/MinhasTarefasView";
import { MarketingRequestsView } from "./components/views/MarketingRequestsView";
import { FornecedoresView } from "./components/views/FornecedoresView";
import { ComprasMarketingView } from "./components/views/ComprasMarketingView";
import { RHOverviewView } from "./components/views/RHOverviewView";
import { RHFuncionariosView } from "./components/views/RHFuncionariosView";
import { RHFornecedoresView } from "./components/views/RHFornecedoresView";
import { RHRecrutamentoView } from "./components/views/RHRecrutamentoView";
import { RHOnboardingView } from "./components/views/RHOnboardingView";
import { RHTreinamentosView } from "./components/views/RHTreinamentosView";
import { RHFeedbackView } from "./components/views/RHFeedbackView";
import { RHFeriasView } from "./components/views/RHFeriasView";
import { RHCargosView } from "./components/views/RHCargosView";
import { RHComunicacaoView } from "./components/views/RHComunicacaoView";
import { RHBemEstarView } from "./components/views/RHBemEstarView";
import { RHRelatoriosView } from "./components/views/RHRelatoriosView";
import { MeuRHView } from "./components/views/MeuRHView";
import { OnboardingModal } from "./components/onboarding/OnboardingModal";
import { CommandPalette } from "./components/ui/CommandPalette";
import { MobileBottomNav } from "./components/shell/MobileBottomNav";
import { AppToast } from "./components/shared/AppToast";
import { useAppUpdate } from "./hooks/use-app-update";
import { useChangelogNotice } from "./hooks/use-changelog-notice";

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
  const { accepted: termsAccepted, loading: loadingTerms, accept: acceptTerms } = useTermsAcceptance(currentUser);

  const [onboardingDoneMap, setOnboardingDoneMap] = usePersistentState("gs_v4_onboarding", {});
  const showOnboarding = Boolean(currentUser && !onboardingDoneMap[currentUser.id]);
  const dismissOnboarding = useCallback(() => {
    if (currentUser?.id) setOnboardingDoneMap(m => ({ ...m, [currentUser.id]: true }));
  }, [currentUser?.id, setOnboardingDoneMap]);

  // Toast "nova versão disponível" + toast "novidades" — ver
  // specautoupdatechangelogtoast.md. Quem está vendo o tour de boas-vindas
  // (showOnboarding) não recebe também o toast de novidades na mesma sessão.
  const { needRefresh, updateNow, dismiss: dismissAppUpdate } = useAppUpdate();
  const { items: changelogItems, dismiss: dismissChangelog } = useChangelogNotice(currentUser, { skip: showOnboarding });

  // Multi-cargo (FASE 1): `roles` é a fonte de verdade — um usuário pode
  // acumular mais de um cargo (ex: vendedor + agencia). `role` (escalar)
  // continua existindo só como "cargo principal" pra decidir landing
  // page/dashboard padrão quando os cargos empatam em prioridade. Todo
  // profile sempre tem role ∈ roles (garantido pelo trigger
  // profiles_sync_roles), então currentUserRoles nunca fica vazio pra um
  // usuário válido.
  const currentUserRoles  = currentUser?.roles?.length ? currentUser.roles : (currentUser?.role ? [currentUser.role] : []);
  const hasAnyRole = (roles) => roles.some(r => currentUserRoles.includes(r));
  const rolesSubsetOf = (roles) => currentUserRoles.length > 0 && currentUserRoles.every(r => roles.includes(r));

  // Acesso por módulo (Configurações → Usuários → "Acesso por módulo") —
  // complementa os cargos: sem override nenhum, `allowedModules` é
  // exatamente o padrão do cargo (mesmas regras hoje embutidas no navGroups
  // abaixo, extraídas pra utils/module-access.js). Controla o que aparece
  // no menu e trava o acesso direto por URL (ver guard mais abaixo) — ainda
  // não é enforcement de RLS tabela a tabela (ver comentário na migration).
  const { overrides: myModuleOverrides } = useModuleOverrides({ userId: currentUser?.id, enabled: Boolean(currentUser) });
  const allowedModules = useMemo(
    () => effectiveModules(currentUserRoles, myModuleOverrides),
    [currentUserRoles, myModuleOverrides]
  );

  const isManagerRole      = hasAnyRole(["gerente", "admin"]);
  // isMarketingUser: can access marketing routes (includes admin for RLS/access)
  const isMarketingUser    = hasAnyRole(["marketing", "gerente_marketing", "admin"]);
  // isPureMarketing: only the marketing dept roles — drives sidebar and dashboard rendering
  const isPureMarketing    = rolesSubsetOf(["marketing", "gerente_marketing"]);
  const isMarketingManager = hasAnyRole(["gerente_marketing", "admin"]);
  const isAgencia          = hasAnyRole(["agencia"]);
  // Papel "portal": login sem nenhum cargo operacional (ex.: Engenharia) —
  // acessa só /meu-rh, mesmo espírito do isAgencia acima (guard total).
  const isPortalOnly       = rolesSubsetOf(["portal"]);
  // RH roles
  const isRHUser           = hasAnyRole(["rh", "gerente_rh", "admin"]);
  const isRHManager        = hasAnyRole(["gerente_rh", "admin"]);
  const isPureRH           = rolesSubsetOf(["rh", "gerente_rh"]);
  // Diretoria (reunião com o RH, 20/07): vê tudo da plataforma, escreve nada
  // (RLS bloqueia toda escrita — ver migration 20260756_papel_diretoria.sql).
  // A única exceção pedida é interação mais rica no Painel Executivo.
  const isDiretoria        = hasAnyRole(["diretoria"]);
  // Painel Executivo deixou de ser exclusivo do gerente Comercial: cada
  // gerente de departamento acessa pra ver (só) o card do próprio setor.
  const canSeeExecutive    = isManagerRole || isMarketingManager || isRHManager || isDiretoria;
  const isAdmin            = hasAnyRole(["admin"]);
  // isInsightsUser: quem o Painel de Insights (src/hooks/use-insights-metrics.js)
  // de fato consegue ler quase todos os dados — o hook cruza
  // rh_stage_history/rh_fornecedor_contratos/rh_colaborador_beneficios (RLS
  // current_user_is_rh(): rh/gerente_rh/admin) e marketing_supplier_quotes/
  // marketing_purchase_requests (RLS current_user_is_marketing():
  // marketing/gerente_marketing/admin). "gerente" (gerente Comercial) sozinho
  // não tem leitura garantida em nenhuma dessas — sem esse gate ele passava
  // pelo `isManager` genérico e via quase todo card do painel zerado.
  const isInsightsUser     = hasAnyRole(["admin", "rh", "gerente_rh", "marketing", "gerente_marketing"]) || isDiretoria;
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
  const { evaluateAutomations, automations } = useAutomations();

  // Campos observados por alguma automação field_value — só vale reavaliar
  // essas automações quando um desses campos de fato muda no patch (senão
  // uma automação como "FitScore > 80 → mover pra Qualificação" dispararia
  // de novo a cada edição de QUALQUER campo do lead, arrastando de volta um
  // negócio que um humano já avançou manualmente pra etapa seguinte).
  const fieldValueWatchedFields = useMemo(() => {
    const set = new Set();
    for (const rule of automations) {
      if (rule.trigger?.type === "field_value" && rule.trigger.field) set.add(rule.trigger.field);
    }
    return set;
  }, [automations]);
  const stageFieldsForNudge = useStageFields();

  const { campaigns } = useMarketingCampaigns({
    userId: currentUser?.id,
    role: currentUser?.role,
    roles: currentUser?.roles,
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

  // Notificações de @menção (FASE 4) — ao contrário das acima (só
  // localStorage do próprio navegador), estas são persistidas no banco e
  // chegam via Realtime pra sessão do usuário mencionado de verdade. Mescla
  // na mesma lista pro sino do TopBar mostrar tudo junto.
  const {
    notifications: serverNotifications,
    markRead: markServerNotificationRead,
    markAllRead: markAllServerNotificationsRead,
    clearAll: clearAllServerNotifications,
    notifyMentions,
  } = useServerNotifications({ currentUser });

  const mergedNotifications = useMemo(() => (
    [...notifications, ...serverNotifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  ), [notifications, serverNotifications]);
  const mergedUnreadCount = unreadCount + serverNotifications.filter(n => !n.read).length;

  const handleMarkAllNotificationsRead = useCallback(() => {
    markAllNotificationsRead();
    markAllServerNotificationsRead();
  }, [markAllNotificationsRead, markAllServerNotificationsRead]);

  const handleMarkNotificationRead = useCallback((id) => {
    markNotificationRead(id);
    markServerNotificationRead(id);
  }, [markNotificationRead, markServerNotificationRead]);

  const handleClearAllNotifications = useCallback(() => {
    clearAllNotifications();
    clearAllServerNotifications();
  }, [clearAllNotifications, clearAllServerNotifications]);

  // `selectedLead` precisa existir antes de qualquer useCallback que a
  // referencie no array de dependências (ex.: handleNotificationNavigate,
  // movido pra depois de `setSection` mais abaixo) — arrays de dependência
  // são avaliados na hora, não são lazy como o corpo da função, então um
  // useState declarado depois de ser referenciado ali é TDZ real ("Cannot
  // access before initialization" em toda renderização).
  const [selectedLead, setSelectedLead] = useState(null);

  const { markViewed: markLeadViewed } = useRecordViews("leads", currentUser?.id);
  useEffect(() => { if (selectedLead?.id) markLeadViewed(selectedLead.id); }, [selectedLead?.id]);

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
    // Dia LOCAL, não UTC — toISOString() já vira o dia seguinte entre ~21h e
    // 24h BRT, furando o guard "uma vez por dia" (a chave mudava dentro do
    // mesmo dia local e o mesmo lembrete disparava de novo).
    const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
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

      // Jovem Aprendiz (Áudio 6): 2 meses de antecedência pra repor a vaga
      // sem furar a cota. Janela de 60d, coluna dedicada aprendizFim.
      const aprDias = c.contractType === "aprendiz" ? aprendizDiasParaFim(c, hoje) : null;
      if (aprDias != null && aprDias <= 60 && marcar(c.id, "aprendiz_fim")) {
        pushNotification({
          type: "compliance_aprendiz",
          title: aprDias <= 0 ? "Contrato de aprendiz encerrado" : "Contrato de aprendiz encerrando",
          body: `${c.fullName}: contrato de aprendizagem ${aprDias < 0 ? "encerrou há " + Math.abs(aprDias) + " dia(s)" : "encerra em " + aprDias + " dia(s)"} — providencie efetivação/reposição.`,
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

  // Lembrete de avaliação de desempenho se aproximando — avisa RH/gestor
  // (in-app + e-mail) quando o próximo ciclo de um colaborador ativo está a
  // até 15 dias de vencer (ou já venceu), uma vez por dia por colaborador.
  // Reunião com o RH (20/07): "preciso de lembretes de quando é a próxima".
  const avaliacaoVistoRef = useRef(new Set());
  useEffect(() => {
    if (!isRHManager) return;
    const hoje = new Date();
    const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    const destinatarios = users.filter((u) => (u.roles || []).some((r) => ["gerente_rh", "admin"].includes(r)) && u.email);
    for (const c of colaboradoresParaLembretes) {
      if (c.employeeStatus !== "ativo") continue;
      const feedbacksDoColaborador = meusCiclosFeedback.filter((f) => f.user_id === c.id);
      const info = avaliacaoDiasParaProxima(c, feedbacksDoColaborador);
      if (!info || info.emAndamento || info.diasRestantes > 15) continue;
      const key = `${c.id}:${info.periodEnd}:${hojeISO}`;
      if (avaliacaoVistoRef.current.has(key)) continue;
      avaliacaoVistoRef.current.add(key);

      const dueLabel = info.diasRestantes < 0
        ? `venceu há ${Math.abs(info.diasRestantes)} dia(s)`
        : info.diasRestantes === 0
        ? "vence hoje"
        : `vence em ${info.diasRestantes} dia(s)`;
      pushNotification({
        type: "avaliacao_proxima",
        title: info.diasRestantes < 0 ? "Avaliação de desempenho atrasada" : "Avaliação de desempenho se aproximando",
        body: `${c.fullName}: próxima avaliação (${cicloTipoLabel(info.tipo)}) ${dueLabel}.`,
      });
      for (const dest of destinatarios) {
        sendRhEmail("avaliacao_proxima", dest.email, {
          EMPLOYEE_NAME: c.fullName || "",
          JOB_TITLE: c.jobTitle || "—",
          DEPARTMENT: c.department || "—",
          TIPO_CICLO: cicloTipoLabel(info.tipo),
          DUE_DATE: new Date(info.periodEnd).toLocaleDateString("pt-BR"),
          DUE_LABEL: dueLabel,
        });
      }
    }
  }, [colaboradoresParaLembretes, meusCiclosFeedback, isRHManager, users, pushNotification]);

  // Lembrete de vencimento de contrato com fornecedor — avisa o responsável
  // pelo contrato (in-app + e-mail) quando a vigência está a até 30 dias de
  // acabar (ou já acabou). Reunião com o RH (20/07): "colocar notificação/
  // lembrete pro usuário responsável receber email e notificação de
  // vencimento do contrato".
  const { contratos: contratosParaLembretes } = useRHSuppliers({ enabled: Boolean(currentUser) && isRHManager });
  const contratoVistoRef = useRef(new Set());
  useEffect(() => {
    if (!isRHManager) return;
    const hoje = new Date();
    const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    for (const c of contratosParaLembretes) {
      if (c.status !== "ativo") continue;
      const dias = contratoFornecedorDiasParaVencer(c, hoje);
      if (dias == null || dias > 30) continue;
      const key = `${c.id}:${hojeISO}`;
      if (contratoVistoRef.current.has(key)) continue;
      contratoVistoRef.current.add(key);

      const dueLabel = dias < 0 ? `venceu há ${Math.abs(dias)} dia(s)` : dias === 0 ? "vence hoje" : `vence em ${dias} dia(s)`;
      pushNotification({
        type: "contrato_fornecedor_vencendo",
        title: dias < 0 ? "Contrato com fornecedor vencido" : "Contrato com fornecedor vencendo",
        body: `${c.titulo}: ${dueLabel}.`,
      });
      const responsavel = c.responsavelId ? users.find((u) => u.id === c.responsavelId) : null;
      if (responsavel?.email) {
        sendRhEmail("contrato_fornecedor_vencendo", responsavel.email, {
          CONTRATO_TITULO: c.titulo || "",
          DUE_DATE: c.vigenciaFim ? new Date(c.vigenciaFim).toLocaleDateString("pt-BR") : "—",
          DUE_LABEL: dueLabel,
        });
      }
    }
  }, [contratosParaLembretes, isRHManager, users, pushNotification]);

  // Lembrete de bem-estar chegando perto — reunião com o RH (20/07): "recebe
  // e-mail avisando... e quando estiver próximo". Roda enquanto um RH tem a
  // tela aberta (mesmo padrão de todo lembrete deste app); avisa a PESSOA que
  // reservou o horário (e-mail capturado no agendamento), não o RH.
  const { sessoes: bemEstarSessoes, fila: bemEstarFila, marcarLembreteEnviado } = useRHBemEstar({ enabled: Boolean(currentUser) && isRHManager });
  useEffect(() => {
    if (!isRHManager) return;
    const agora = Date.now();
    const sessoesPorId = new Map(bemEstarSessoes.map((s) => [s.id, s]));
    for (const f of bemEstarFila) {
      if (f.lembrete_enviado || f.status === "atendido" || f.status === "faltou" || !f.email || !f.horario) continue;
      const sessao = sessoesPorId.get(f.sessao_id);
      if (!sessao?.data || sessao.status !== "aberta") continue;
      const alvo = new Date(`${sessao.data}T${f.horario}`).getTime();
      const minutosParaAlvo = (alvo - agora) / 60000;
      if (minutosParaAlvo > 30 || minutosParaAlvo < -5) continue;
      marcarLembreteEnviado(f.id).catch(() => {});
      sendRhEmail("bemestar_lembrete", f.email, {
        NOME: f.nome || "",
        SESSAO_TITULO: sessao.titulo || "",
        HORARIO: (f.horario || "").slice(0, 5),
      });
    }
  }, [bemEstarSessoes, bemEstarFila, isRHManager, marcarLembreteEnviado]);

  // Lembrete de reembolso de Viagens pendente há muito tempo — mesma ideia
  // de "approval-queue timeout" do Concur/TravelPerk: sem isso, uma despesa
  // fica esquecida na fila do gestor sem ninguém notar.
  const { despesas: despesasParaLembretes } = useCRMDespesas({
    enabled: Boolean(currentUser) && isManagerRole,
  });
  const despesaPendenteVistaRef = useRef(new Set());
  useEffect(() => {
    if (!isManagerRole) return;
    // Dia LOCAL, não UTC — toISOString() vira o dia seguinte entre ~21h e 24h
    // BRT, furando o guard "uma vez por dia" (mesmo fix já feito no lembrete de
    // conformidade acima). Achado da 2ª auditoria.
    const hoje = new Date();
    const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    for (const d of despesasParaLembretes) {
      if (d.status_reembolso !== "pendente" || !d.created_at) continue;
      const diasPendente = Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000);
      if (diasPendente < 5) continue;
      const key = `${d.id}:${hojeISO}`;
      if (despesaPendenteVistaRef.current.has(key)) continue;
      despesaPendenteVistaRef.current.add(key);
      pushNotification({
        type: "reembolso_pendente_ha_dias",
        title: "Reembolso pendente há dias",
        body: `${d.categoria || "Despesa"} (${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(d.valor) || 0)}) está pendente há ${diasPendente} dias.`,
      });
    }
  }, [despesasParaLembretes, isManagerRole, pushNotification]);

  const [activeCompany, setActiveCompany] = useState("all");
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

  // Destino genérico de uma notificação de @menção — leva pra tela certa
  // (e, no caso de leads, abre o card exato); os outros módulos ainda não
  // têm um jeito central de reabrir o card específico a partir daqui, então
  // por ora só navegam até a seção certa.
  const NOTIFICATION_LINK_SECTIONS = {
    campaigns: "marketing",
    deliverables: "marketing-entregas",
    purchase_requests: "marketing-compras",
    marketing_requests: "marketing-solicitacoes",
    rh_vagas: "rh-recrutamento",
    rh_candidatos: "rh-recrutamento",
    rh_onboarding: "rh-onboarding",
    rh_treinamentos: "rh-treinamentos",
    rh_feedback: "rh-feedback",
    rh_ferias: "rh-ferias",
    rh_movimentacoes: "rh-cargos",
  };
  const handleNotificationNavigate = useCallback((link) => {
    // Pesquisas identificadas (RH2-7): a página de resposta vive fora do
    // shell autenticado (/pesquisa/:id, montada direto no main.jsx), então
    // não tem "módulo" pra mapear pra uma seção — navega pra URL crua.
    if (link?.url) { navigate(link.url); return; }
    if (!link?.module) return;
    if (link.module === "leads") {
      const lead = leads.find(l => l.id === link.id);
      if (lead) { setSelectedLead(lead); return; }
      setSection("crm");
      return;
    }
    const target = NOTIFICATION_LINK_SECTIONS[link.module];
    if (target) setSection(target);
  }, [leads, setSelectedLead, setSection, navigate]);

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

  // Aplica os patches de automação e só notifica sucesso das regras cujo
  // patch realmente gravou — antes a notificação disparava incondicional
  // mesmo quando o patch falhava (catch vazio), anunciando algo que não
  // aconteceu.
  const applyAutomationOutcome = useCallback(async (patches, notifications, leadId, companyId) => {
    const failedRuleIds = new Set();
    for (const p of patches) {
      try {
        await updateLeadRemote(p.leadId, p.patch);
      } catch (err) {
        failedRuleIds.add(p.ruleId);
        console.error(`Automação "${p.ruleName}" falhou ao gravar:`, err);
      }
    }
    for (const n of (notifications || [])) {
      if (failedRuleIds.has(n.ruleId)) continue;
      pushNotification({ type: "automation", title: `Automação: ${n.ruleName}`, body: n.message, leadId, companyId });
    }
  }, [updateLeadRemote, pushNotification]);

  const updateLead = useCallback(async (id, patch) => {
    // Notify if lead gets assigned to current user
    const lead = leads.find(l => l.id === id);
    const shouldNotify = patch.owner && patch.owner === currentUser?.id && lead && lead.owner !== currentUser?.id;
    setSelectedLead(prev => (prev && prev.id === id ? { ...prev, ...patch } : prev));
    await updateLeadRemote(id, patch);
    // field_value automations (ex: "Badge VIP · valor ≥ R$50k") — só reavalia
    // quando o patch realmente toca um campo que alguma automação observa.
    if (lead && Object.keys(patch).some(k => fieldValueWatchedFields.has(k))) {
      const updated = { ...lead, ...patch };
      const { patches, notifications: autoNotifs, sideEffects } = evaluateAutomations(updated, lead, "field_value");
      await applyAutomationOutcome(patches, autoNotifs, id, lead.companyId);
      if (sideEffects?.length) await processAutomationSideEffects(sideEffects);
    }
    if (shouldNotify) {
      pushNotification({
        type: 'lead_assigned',
        title: 'Lead atribuído a você',
        body: `${lead.company} foi atribuído à sua carteira.`,
        leadId: id,
        companyId: lead?.companyId,
      });
    }
  }, [updateLeadRemote, currentUser, leads, pushNotification, evaluateAutomations, processAutomationSideEffects, fieldValueWatchedFields, applyAutomationOutcome]);

  const handleStageChange = useCallback(async (id, stage) => {
    const prev = leads.find(l => l.id === id);
    await changeStage(id, stage);
    if (prev && prev.stage !== stage) {
      const updated = { ...prev, stage, stageChangedAt: new Date().toISOString() };
      const { patches, notifications: autoNotifs, sideEffects } = evaluateAutomations(updated, prev, "stage_change");
      await applyAutomationOutcome(patches, autoNotifs, id, prev.companyId);
      if (sideEffects?.length) await processAutomationSideEffects(sideEffects);
      // Notify on terminal stage changes
      if (stage === "ganho") {
        pushNotification({ type: "lead_won", title: "Negócio fechado!", body: `${prev.company} foi marcado como ganho.`, leadId: id, companyId: prev.companyId });
      } else if (stage === "perdido") {
        pushNotification({ type: "lead_lost", title: "Lead marcado como perdido", body: `${prev.company} foi movido para Perdido.`, leadId: id, companyId: prev.companyId });
      }
    }
  }, [changeStage, leads, evaluateAutomations, pushNotification, processAutomationSideEffects, applyAutomationOutcome]);

  // Wrapped addLead that fires lead_created automations after creation.
  // Propaga o retorno de addLead (lead salvo, ou o lead JÁ EXISTENTE em caso
  // de duplicata por CNPJ) — o ImportModal precisa disso pra não confundir
  // duplicata com falha real de gravação.
  const handleAddLead = useCallback(async (lead) => {
    const saved = await addLead(lead);
    const { patches, notifications: autoNotifs, sideEffects } = evaluateAutomations(lead, null, "lead_created");
    await applyAutomationOutcome(patches, autoNotifs, lead.id, lead.companyId);
    if (sideEffects?.length) await processAutomationSideEffects(sideEffects);
    return saved;
  }, [addLead, evaluateAutomations, processAutomationSideEffects, applyAutomationOutcome]);

  // Nudges por tempo: os gatilhos "time_in_stage" e "pending_required_field"
  // não disparam em nenhum evento do CRM (não são mudança de etapa nem
  // criação) — precisam de uma varredura periódica. A própria tela de
  // Automações já dizia "o avaliador roda ao abrir o CRM", mas isso nunca
  // tinha sido implementado; time_in_stage ficava morto. Dedup por
  // localStorage (chave regra+lead+stageChangedAt) pra não repetir a mesma
  // notificação a cada scan.
  const [notifiedNudges, setNotifiedNudges] = usePersistentState("gs_v4_nudges_notified", {});
  // Este scan é um lembrete PERIÓDICO (de hora em hora) de leads parados ou
  // com campo obrigatório pendente — NÃO deve rodar no caminho crítico de uma
  // troca de etapa. Antes ele tinha [leads, stageFieldsForNudge, notifiedNudges,
  // pushNotification, ...] nas deps: como o effect também dispara
  // pushNotification/setNotifiedNudges (→ novo render → effect roda de novo) e
  // o objeto de useStageFields mudava de identidade a cada render, mover UM
  // card com vários leads abertos gerava uma cascata de re-render de 20-40s.
  // Agora lê tudo via ref e roda só na montagem (deferido) + de hora em hora,
  // fora do ciclo de render. setNotifiedNudges é setter estável de useState.
  const nudgeRefs = useRef({});
  nudgeRefs.current = { leads, stageFieldsForNudge, evaluateAutomations, notifiedNudges, pushNotification };
  useEffect(() => {
    const scan = () => {
      const { leads, stageFieldsForNudge, evaluateAutomations, notifiedNudges, pushNotification } = nudgeRefs.current;
      if (!leads.length) return;
      const newlyNotified = {};
      for (const lead of leads) {
        const fields = stageFieldsForNudge.getFields(lead.companyId, lead.stage);
        const missing = getMissingRequiredFields(fields, lead.customFields || {});
        const enriched = { ...lead, _missingRequiredFields: missing };
        const { notifications: staleNotifs } = evaluateAutomations(lead, lead, "time_in_stage");
        const { notifications: pendingNotifs } = evaluateAutomations(enriched, enriched, "pending_required_field");
        for (const n of [...staleNotifs, ...pendingNotifs]) {
          const key = `${n.ruleId}:${lead.id}:${lead.stageChangedAt}`;
          if (notifiedNudges[key] || newlyNotified[key]) continue;
          newlyNotified[key] = true;
          pushNotification({ type: "automation", title: `Automação: ${n.ruleName}`, body: n.message, leadId: lead.id, companyId: lead.companyId });
        }
      }
      if (Object.keys(newlyNotified).length > 0) {
        setNotifiedNudges(prev => ({ ...prev, ...newlyNotified }));
      }
    };
    const first = setTimeout(scan, 4000);
    const interval = setInterval(scan, 60 * 60 * 1000);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, [setNotifiedNudges]);

  const closeDrawer = useCallback(() => setSelectedLead(null), []);

  // Ver src/utils/reopen-after-move.js — fecha o drawer e reabre já na
  // etapa nova, em vez de só trocar o conteúdo por baixo do drawer aberto.
  const leadsRef = useRef(leads);
  useEffect(() => { leadsRef.current = leads; }, [leads]);
  const reopenLeadAfterMove = useCallback((leadId) => {
    reopenAfterMove(setSelectedLead, () => leadsRef.current.find(l => l.id === leadId) || null);
  }, []);

  const isManager      = isManagerRole;

  // Respects settings.enabledCompanies — the user can toggle a company off from
  // the Settings view without deleting data or editing code.
  const accessibleCompanies = useMemo(() => {
    if (!currentUser) return [];
    const enabled = new Set(settings.enabledCompanies);
    const base = (isManager || isDiretoria)
      ? ["industria", "resibag"]
      : currentUser.companies;
    const filtered = base.filter(id => enabled.has(id));
    if (filtered.length === 0) return []; // edge case: user disabled all
    return filtered.length > 1 ? ["all", ...filtered] : filtered;
  }, [currentUser, settings.enabledCompanies, isManager, isDiretoria]);

  // Keep activeCompany valid when enabled list changes.
  useEffect(() => {
    if (accessibleCompanies.length === 0) return;
    if (!accessibleCompanies.includes(activeCompany)) {
      setActiveCompany(accessibleCompanies[0]);
    }
  }, [accessibleCompanies, activeCompany]);

  const navGroups = useMemo(() => {
    // Portal: só "Meu RH", nada mais — mesmo espírito do isAgencia abaixo.
    if (isPortalOnly) {
      return [
        {
          label: null,
          items: [
            { id: "meu-rh", label: "Meu RH", icon: Home },
          ],
        },
      ];
    }

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

    // FASE 6: Minhas Tarefas é o pouso pós-login pra todo papel interno
    // (agência já saiu por cima, no `if` acima) — item de nav universal, já
    // que antes só quem caía na rota "dashboard" tinha um link direto pra ela
    // (todo o resto usava "Visão Geral" pra ir pro dashboard antigo do
    // próprio módulo).
    groups.push({
      label: null,
      items: [
        { id: "dashboard", label: "Minhas Tarefas", icon: CheckSquare },
      ],
    });

    if (!isPureMarketing && !isPureRH) {
      groups.push({
        label: "Comercial",
        items: [
          { id: "commercial-overview", label: "Visão Geral", icon: LayoutDashboard },
          { id: "crm",          label: "Pipeline",   icon: Layers },
          { id: "clients",      label: "Clientes",   icon: Users },
          { id: "signals",      label: "Sinais",     icon: Bell },
          { id: "explorer",     label: "Explorador", icon: Globe2 },
          { id: "crm-viagens",  label: "Viagens & Reembolsos", icon: Plane },
          ...(isManager ? [{ id: "crossref", label: "Cross-sell", icon: Shuffle }] : []),
        ],
      });
    }

    if (isMarketingUser || isDiretoria) {
      const mktItems = [];
      // Todo usuário de marketing vê "Visão Geral" (Marketing Dashboard) —
      // antes só admin/gerente viam, porque "Início" apontava direto pra cá
      // pra quem era isPureMarketing; agora que "Início" virou Minhas
      // Tarefas pra todo mundo, sem esse item o marketing raso (não-gerente)
      // ficaria sem link nenhum pro dashboard do próprio módulo.
      mktItems.push({ id: "marketing-home", label: "Visão Geral", icon: LayoutDashboard });
      mktItems.push(
        { id: "marketing",                label: "Campanhas",    icon: Megaphone },
        { id: "marketing-solicitacoes",   label: "Solicitações", icon: Inbox },
        { id: "marketing-entregas",       label: "Entregas",     icon: Package },
        { id: "marketing-fornecedores",   label: "Fornecedores", icon: Truck },
        { id: "marketing-compras",        label: "Compras",      icon: ShoppingCart },
        { id: "marketing-despesas",       label: "Despesas",     icon: DollarSign }
      );
      groups.push({ label: "Marketing", items: mktItems });
    }

    if (isRHUser || isDiretoria) {
      groups.push({
        label: "Recursos Humanos",
        items: [
          { id: "rh-overview",     label: "Visão Geral",      icon: LayoutDashboard },
          { id: "rh-recrutamento", label: "Recrutamento",      icon: BriefcaseBusiness },
          { id: "rh-onboarding",   label: "Onboarding",        icon: ClipboardCheck },
          { id: "rh-treinamentos", label: "Treinamentos",      icon: GraduationCap },
          { id: "rh-feedback",     label: "Avaliação de Desempenho", icon: MessageSquareText },
          { id: "rh-ferias",       label: "Férias & Licenças", icon: CalendarCheck },
          { id: "rh-funcionarios", label: "Funcionários",      icon: Users },
          { id: "rh-cargos",       label: "Cargos & Salários", icon: Briefcase },
          { id: "rh-comunicacao",  label: "Comunicação",       icon: Megaphone },
          { id: "rh-bem-estar",    label: "Bem-estar",         icon: HeartHandshake },
          { id: "rh-fornecedores", label: "Fornecedores",      icon: Building2 },
          { id: "rh-relatorios",   label: "Relatórios",        icon: FileBarChart },
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
          { id: "rh-feedback",     label: "Avaliação de Desempenho", icon: MessageSquareText },
        ],
      });
    }

    // "Inteligência": Executivo/Agentes ficam sob isManager (gerente Comercial
    // + admin, mesmo escopo de sempre). Insights entra à parte sob
    // isInsightsUser — ele cruza dados de RH e Marketing que um gerente
    // Comercial puro não tem RLS pra ler, então não pode herdar o mesmo gate.
    // Cross-sell morou aqui antes, mas é uma ferramenta comercial (indicação
    // entre empresas do grupo) — mudou pra dentro do grupo "Comercial".
    const intelItems = [];
    if (canSeeExecutive) intelItems.push({ id: "executive", label: "Executivo",  icon: BarChart3 });
    if (isInsightsUser) intelItems.push({ id: "insights", label: "Insights", icon: TrendingUp });
    if (isManager) {
      intelItems.push({ id: "agents", label: "Agentes", icon: Bot });
    }
    if (intelItems.length > 0) {
      groups.push({ label: "Inteligência", items: intelItems });
    }

    if (isManager) {
      groups.push({
        label: "Configuração",
        items: [
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

    // Acesso por módulo: só filtra itens que de fato fazem parte do
    // registro de módulos (dashboard/tutorials/settings/automations ficam
    // de fora — controlados só por cargo, como sempre). Grupo que fica
    // vazio depois do filtro some do menu.
    return groups
      .map(g => ({ ...g, items: g.items.filter(i => !ALL_MODULE_IDS.includes(i.id) || allowedModules.has(i.id)) }))
      .filter(g => g.items.length > 0);
  }, [isManager, canSeeExecutive, isInsightsUser, isMarketingUser, isPureMarketing, isAgencia, isRHUser, isPureRH, isPortalOnly, isDiretoria, allowedModules]);

  // Title shown in the slim top bar, derived from the active section.
  const sectionTitle = useMemo(() => {
    // Unificado com o rótulo já usado no MobileBottomNav e no tooltip do
    // Sidebar ("Configurações") — antes só o não-gerente via "Meu perfil"
    // aqui, uma 3ª variação de nome pra mesma tela. Achado da 2ª auditoria.
    if (section === "settings" && !isManager)          return "Configurações";
    // Três seções distintas usam o mesmo rótulo de menu "Visão Geral" — sem o
    // sufixo de departamento, o título do topbar ficava ambíguo (só Marketing
    // tinha o sufixo). Achado da 2ª auditoria.
    if (section === "commercial-overview")             return "Visão Geral · Comercial";
    if (section === "marketing-home")                  return "Visão Geral · Marketing";
    if (section === "rh-overview")                     return "Visão Geral · RH";
    if (section === "marketing-solicitacoes")          return "Solicitações · Marketing";
    if (section === "marketing-fornecedores")          return "Fornecedores · Marketing";
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

    const managerOnly = ["agents", "crossref", "funnel-history", "automations", "fair-import", "users"];
    if (!isManager && managerOnly.includes(section)) {
      setSection("dashboard");
    }
    // "executive" (Painel Executivo) não é mais exclusivo do gerente
    // Comercial — gerente de Marketing/RH também acessa, só vê o recorte
    // do próprio departamento lá dentro (ver canSeeExecutive).
    if (!canSeeExecutive && section === "executive") {
      setSection("dashboard");
    }
    // Insights tem gate próprio (isInsightsUser), não o isManager genérico —
    // ver comentário na definição de isInsightsUser.
    if (!isInsightsUser && section === "insights") {
      setSection("dashboard");
    }
    const marketingOnly = ["marketing", "marketing-entregas", "marketing-despesas", "marketing-solicitacoes", "marketing-fornecedores", "marketing-compras"];
    if (!isMarketingUser && !isAgencia && !isDiretoria && marketingOnly.includes(section)) {
      setSection("dashboard");
    }
    // Agência não acessa Solicitações, Fornecedores nem Compras (áreas internas de marketing)
    if (isAgencia && (section === "marketing-solicitacoes" || section === "marketing-fornecedores" || section === "marketing-compras")) {
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
    const rhSections = ["rh-overview", "rh-funcionarios", "rh-recrutamento", "rh-ferias", "rh-cargos", "rh-comunicacao", "rh-bem-estar", "rh-fornecedores", "rh-relatorios"];
    if (!isRHUser && !isDiretoria && rhSections.includes(section)) {
      setSection("dashboard");
    }
    // Pure RH users shouldn't access CRM sections
    if (isPureRH && crmSections.includes(section)) {
      setSection("rh-overview");
    }
    // Agência can access marketing routes + their own profile (settings).
    const agenciaBlocked = ["crm", "signals", "explorer", "crm-viagens", "commercial-overview", "marketing-despesas", "marketing-compras", "dashboard", "tutorials"];
    if (isAgencia && agenciaBlocked.includes(section)) {
      setSection("marketing");
    }
    // Portal: só acessa /meu-rh, qualquer outra rota digitada direto na URL
    // volta pra lá — mesmo espírito do guard de agência acima.
    if (isPortalOnly && section !== "meu-rh") {
      setSection("meu-rh");
    }
    // Acesso por módulo: revogação por override direto na URL (o item já
    // some do menu acima, isso cobre quem digita a rota ou tinha aba
    // aberta antes da revogação). Agência/Portal ficam de fora — shell de
    // navegação fixo, não passa pelo registro de módulos.
    if (!isAgencia && !isPortalOnly && ALL_MODULE_IDS.includes(section) && !allowedModules.has(section)) {
      setSection("dashboard");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, isManager, canSeeExecutive, isInsightsUser, isMarketingUser, isPureMarketing, isAgencia, isRHUser, isPureRH, isPortalOnly, section, allowedModules]);

  if (supabaseEnabled && supaLoading && !currentUser) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--surface)", color: "var(--text-dim)" }}
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

  // Bloqueia o resto do app até aceitar a versão vigente dos termos —
  // proteção jurídica pra empresa, ver terms_acceptances/TermsGateScreen.
  if (supabaseEnabled && !loadingTerms && !termsAccepted) {
    return (
      <TermsGateScreen
        currentUser={currentUser}
        onAccept={acceptTerms}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div
      style={{
        background: "var(--bg)",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "var(--text)",
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
          notifications={mergedNotifications}
          unreadCount={mergedUnreadCount}
          onMarkAllRead={handleMarkAllNotificationsRead}
          onMarkRead={handleMarkNotificationRead}
          onClearAll={handleClearAllNotifications}
          desktopPermission={desktopPermission}
          onRequestDesktopPermission={requestDesktopPermission}
          onSelectLead={(leadId) => {
            const lead = leads.find(l => l.id === leadId);
            if (lead) setSelectedLead(lead);
          }}
          onNavigate={handleNotificationNavigate}
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
                        style={{ borderColor: "#D1D5DB", color: "var(--text)", background: "#FFFFFF" }}>
                  Recarregar
                </button>
              </div>
            </div>
          )}
          key={section}
        >
        <Routes>
          <Route path={ROUTES.dashboard} element={
            isPortalOnly ? (
              <Navigate to={ROUTES["meu-rh"]} replace />
            ) : isAgencia ? (
              // Agência mantém o comportamento antigo — papel externo restrito,
              // com nav própria de só 2 itens (Campanhas/Entregas); Minhas
              // Tarefas agrega módulos (RH, CRM interno) fora do seu escopo.
              <Navigate to={ROUTES.marketing} replace />
            ) : isDiretoria ? (
              // Diretoria não tem tarefas/leads próprios — pousa direto no
              // Painel Executivo, a única tela com que de fato interage.
              <Navigate to={ROUTES.executive} replace />
            ) : (
              // FASE 6: Minhas Tarefas é a tela de pouso pós-login pra todo
              // papel interno. Os antigos destinos por papel (Executivo, Visão
              // Geral do Comercial/Marketing, RH) continuam existindo e
              // navegáveis — só deixaram de ser o pouso automático.
              <MinhasTarefasView
                currentUser={currentUser}
                users={users}
                onNavigate={setSection}
                onLeadClick={setSelectedLead}
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
            isAgencia ? <Navigate to={ROUTES.marketing} replace /> : isPureRH ? <Navigate to={ROUTES.dashboard} replace /> : (
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
            isAgencia ? <Navigate to={ROUTES.marketing} replace /> : isPureRH ? <Navigate to={ROUTES.dashboard} replace /> : (
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
            isAgencia ? <Navigate to={ROUTES.marketing} replace /> : isPureRH ? <Navigate to={ROUTES.dashboard} replace /> : <CRMView
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
              onDeleteLead={deleteLead}
              onStarToggle={toggleStar}
              visibleStages={settings.visibleKanbanStages}
              pipelineTransitions={pipelineTransitions}
              clients={clients}
              onCreateClient={createClient}
              autoOpenCreate={crmAutoCreate}
              onAutoOpenHandled={() => setCrmAutoCreate(false)}
              onOpenImport={isManager ? () => setClientImportOpen(true) : undefined}
              onReplacePipeline={replacePipeline}
              onResetPipeline={resetCompanyPipeline}
              onUpdateStage={updateStage}
            />
          } />
          <Route path={ROUTES["crm-viagens"]} element={
            isAgencia || isPureMarketing || isPureRH
              ? <Navigate to={ROUTES.dashboard} replace />
              : <CRMViagensView currentUser={currentUser} leads={leads} users={users} pushNotification={pushNotification} />
          } />
          <Route path={ROUTES.clients} element={
            isAgencia || isPureMarketing || isPureRH
              ? <Navigate to={ROUTES.dashboard} replace />
              : (
                <ClientsManager
                  clients={clients}
                  loading={clientsLoading}
                  leads={leads}
                  onCreate={createClient}
                  onUpdate={updateClient}
                  onDelete={deleteClient}
                  canDelete={isManager}
                  onOpenImport={isManager ? () => setClientImportOpen(true) : undefined}
                  onOpenLead={setSelectedLead}
                />
              )
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
            canSeeExecutive
              ? <ExecutiveDashboard leads={leads} crossReferrals={crossReferrals} pipelines={pipelines} users={users} currentUser={currentUser} activeCompany={activeCompany} visibleWidgets={settings.visibleExecutiveWidgets} isAdmin={isAdmin} isMarketingManager={isMarketingManager || isDiretoria} isRHManager={isRHManager || isDiretoria} isComercialManager={isManager || isDiretoria} />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES.insights} element={
            isInsightsUser
              ? <InsightsView leads={leads} pipelines={pipelines} />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          {/* Antiga rota /presidencia foi fundida no Executivo. Redireciona
              quem tem o link salvo. */}
          <Route path={ROUTES.presidency} element={<Navigate to={ROUTES.executive} replace />} />
          {/* funnel-history is now a tab inside ExecutiveDashboard */}
          <Route path={ROUTES["funnel-history"]} element={
            <Navigate to={ROUTES.executive} replace />
          } />
          {/* Construtor de pipeline standalone foi absorvido pelo botão
              "Editar etapas" dentro do próprio Kanban de Pipeline. Redireciona
              quem tem o link salvo. */}
          <Route path={ROUTES["pipeline-builder"]} element={<Navigate to={ROUTES.crm} replace />} />
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
              isMarketingManager={isMarketingManager}
              isRHManager={isRHManager}
              isAdmin={isAdmin}
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
            (isMarketingUser || isDiretoria)
              ? <MarketingDashboardView user={currentUser} />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES.marketing} element={
            (isMarketingUser || isAgencia || isDiretoria)
              ? <MarketingView user={currentUser} users={users} evaluateAutomations={evaluateAutomations} pushNotification={pushNotification} notifyMentions={notifyMentions} />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES["marketing-entregas"]} element={
            (isMarketingUser || isAgencia || isDiretoria)
              ? <EntregasView user={currentUser} users={users} notifyMentions={notifyMentions} />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES["marketing-despesas"]} element={
            ((isMarketingUser && !isAgencia) || isDiretoria)
              ? <DespesasView user={currentUser} users={users} campaigns={campaigns} />
              : <Navigate to={ROUTES.marketing} replace />
          } />
          <Route path={ROUTES["marketing-solicitacoes"]} element={
            ((isMarketingUser && !isAgencia) || isDiretoria)
              ? <MarketingRequestsView user={currentUser} users={users} />
              : <Navigate to={ROUTES.marketing} replace />
          } />
          <Route path={ROUTES["marketing-fornecedores"]} element={
            ((isMarketingUser && !isAgencia) || isDiretoria)
              ? <FornecedoresView user={currentUser} />
              : <Navigate to={ROUTES.marketing} replace />
          } />
          <Route path={ROUTES["marketing-compras"]} element={
            ((isMarketingUser && !isAgencia) || isDiretoria)
              ? <ComprasMarketingView user={currentUser} users={users} notifyMentions={notifyMentions} />
              : <Navigate to={ROUTES.marketing} replace />
          } />
          <Route path={ROUTES["rh-overview"]} element={
            (isRHUser || isDiretoria)
              ? <RHOverviewView currentUser={currentUser} canWrite={isRHManager} onNavigate={setSection} />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES["rh-funcionarios"]} element={
            (isRHUser || isDiretoria)
              ? <RHFuncionariosView
                  users={users}
                  leads={leads}
                  currentUser={currentUser}
                  onUpdateUser={updateUser}
                  canWrite={isRHManager}
                />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES["rh-fornecedores"]} element={
            (isRHUser || isDiretoria)
              ? <RHFornecedoresView currentUser={currentUser} />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES["rh-recrutamento"]} element={
            (isRHUser || isDiretoria)
              ? <RHRecrutamentoView
                  user={currentUser}
                  canWrite={isRHManager}
                  canTriage={isRHUser}
                  notifyMentions={notifyMentions}
                />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES["rh-onboarding"]} element={
            <RHOnboardingView currentUser={currentUser} canWrite={isRHManager} isRHUser={isRHUser || isDiretoria} notifyMentions={notifyMentions} />
          } />
          <Route path={ROUTES["rh-treinamentos"]} element={
            <RHTreinamentosView currentUser={currentUser} canWrite={isRHManager} isRHUser={isRHUser || isDiretoria} users={users} notifyMentions={notifyMentions} />
          } />
          <Route path={ROUTES["rh-feedback"]} element={
            <RHFeedbackView currentUser={currentUser} canWrite={isRHManager} isRHUser={isRHUser || isDiretoria} notifyMentions={notifyMentions} />
          } />
          <Route path={ROUTES["rh-ferias"]} element={
            (isRHUser || isDiretoria)
              ? <RHFeriasView currentUser={currentUser} users={users} canWrite={isRHManager} notifyMentions={notifyMentions} />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES["rh-cargos"]} element={
            (isRHManager || isDiretoria)
              ? <RHCargosView currentUser={currentUser} canWrite={isRHManager} isDirector={isAdmin} users={users} notifyMentions={notifyMentions} />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES["rh-comunicacao"]} element={
            (isRHManager || isDiretoria)
              ? <RHComunicacaoView currentUser={currentUser} canWrite={isRHManager} />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES["rh-bem-estar"]} element={
            (isRHManager || isDiretoria)
              ? <RHBemEstarView currentUser={currentUser} canWrite={isRHManager} />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES["rh-relatorios"]} element={
            (isRHManager || isDiretoria)
              ? <RHRelatoriosView currentUser={currentUser} />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES["meu-rh"]} element={
            <MeuRHView currentUser={currentUser} notifyMentions={notifyMentions} />
          } />
          <Route path={ROUTES.profile} element={<Navigate to={ROUTES.settings} replace />} />
          {/* Catch-all: rota desconhecida volta pro Início. */}
          <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
        </Routes>
        </ErrorBoundary>
        </div>

        <div className="lg:hidden">
          <MobileBottomNav
            section={section}
            onSectionChange={setSection}
            roles={currentUserRoles}
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
          onStageMoved={reopenLeadAfterMove}
          onUpdate={updateLead}
          onDelete={deleteLead}
          onAddActivity={addLeadActivity}
          allLeads={leads}
          users={users}
          clients={clients}
          onCreateClient={createClient}
          isManager={isManager}
          currentUser={currentUser}
          pipelines={pipelines}
          onNavigateToPipelineBuilder={() => { closeDrawer(); setSection("crm"); }}
          notifyMentions={notifyMentions}
          pipelineTransitions={pipelineTransitions}
        />
      </ErrorBoundary>

      {showOnboarding && (
        <OnboardingModal currentUser={currentUser} onDone={dismissOnboarding} />
      )}

      {needRefresh && (
        <AppToast
          icon={RefreshCw}
          title="Nova versão disponível"
          onDismiss={dismissAppUpdate}
          action={{ label: "Atualizar agora", onClick: updateNow }}
        />
      )}

      {!needRefresh && changelogItems.length > 0 && (
        <AppToast icon={Sparkles} title="Novidades" onDismiss={dismissChangelog}>
          <ul className="list-disc pl-4 space-y-0.5">
            {changelogItems.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </AppToast>
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
