import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Bell, Globe2, Layers, BarChart3, Shuffle, UserCog,
  Settings as SettingsIcon, Bot, Zap, LifeBuoy, Megaphone,
  Package, DollarSign, Users, BriefcaseBusiness, CalendarCheck, Tent,
  ClipboardCheck, GraduationCap, MessageSquareText, Plane, Inbox, Truck,
  ShoppingCart, CheckSquare, Building2, TrendingUp, Briefcase, HeartHandshake, Home,
  FileBarChart, RefreshCw, ListTodo, Handshake, Ship, MessageCircle, ListChecks, Leaf,
  FlaskConical, PackageSearch, ClipboardList, Bug, BookOpen, Newspaper,
} from "lucide-react";
import { supabase } from "./lib/supabase";
import { STORAGE_KEYS } from "./constants/storage-keys";
import { usePipelines } from "./hooks/use-pipelines";
import { DEFAULT_PIPELINE_STAGES } from "./constants/pipelines";
import { ROUTES, sectionFromPath } from "./constants/routes";
import { useModuleOverrides } from "./hooks/use-module-overrides";
import { useModuleStates } from "./hooks/use-module-states";
import { PageDescriptionProvider } from "./components/shared/PageTitle";
import { effectiveModules, gateByModuleStates, isModuleInTest, ALL_MODULE_IDS, MODULE_LABELS } from "./utils/module-access";
import { useMarketSignals } from "./hooks/use-market-signals";
import { usePersistentState } from "./hooks/use-persistent-state";
import { useCrossReferrals } from "./hooks/use-cross-referrals";
import { useUserSettings } from "./hooks/use-user-settings";
import { useSupabaseAuth } from "./hooks/use-supabase-auth";
import { useLeads } from "./hooks/use-leads";
import { useOfflineSync } from "./hooks/use-offline-sync";
import { useClients } from "./hooks/use-clients";
import { useChat } from "./hooks/use-chat";
import { usePersonalTasks } from "./hooks/use-personal-tasks";
import { useNotifications } from "./hooks/use-notifications";
import { useServerNotifications } from "./hooks/use-server-notifications";
import { useProfiles } from "./hooks/use-profiles";
import { useInvitations } from "./hooks/use-invitations";
import { usePipelineTransitions } from "./hooks/use-pipeline-transitions";
import { useAutomations } from "./hooks/use-automations";
import { useStageFields } from "./hooks/use-stage-fields";
import { getMissingRequiredFields } from "./utils/field-conditions";
import { useMarketingCampaigns } from "./hooks/use-marketing-campaigns";
import { useMarketingDeliverables } from "./hooks/use-marketing-deliverables";
import { globalSearchScopeWords, joinPtCurto } from "./components/ui/CommandPalette";
import { useMarketingRequests } from "./hooks/use-marketing-requests";
import { useRHFeriasRequests } from "./hooks/use-rh-ferias-requests";
import { useRHFeedback } from "./hooks/use-rh-feedback";
import { useMyColaborador } from "./hooks/use-my-colaborador";
import { useRHColaboradores } from "./hooks/use-rh-colaboradores";
import { useCRMDespesas } from "./hooks/use-crm-despesas";
import { periodoExperienciaInfo, asoDiasParaVencer, contratoDiasParaFim, diasParaAniversario, diasParaBodasEmpresa, aprendizDiasParaFim, contratoFornecedorDiasParaVencer } from "./utils/rh-compliance-dates";
import { avaliacaoDiasParaProxima, cicloTipoLabel } from "./utils/rh-feedback-cycles";
import { useRHSuppliers } from "./hooks/use-rh-suppliers";
import { useRHBemEstar } from "./hooks/use-rh-bemestar";
import { useRHRecrutamento } from "./hooks/use-rh-recrutamento";
import { isStale, aggregatePipeline, getLeadOwnerIds } from "./utils/pipeline-metrics";
import { formatK } from "./utils/currency";
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
import { ImportModal } from "./components/lead/ImportModal";
import { ClientImportModal } from "./components/client/ClientImportModal";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { ReportBugModal } from "./components/bugs/ReportBugModal";
import { useBugReports } from "./hooks/use-bug-reports";
import { instalarCapturaDeErros } from "./utils/error-log";
import { useAgentQueueAlert, DIAS_ATENCAO, DIAS_AMBAR } from "./hooks/use-agent-queue-alert";
import { DashboardView } from "./components/views/DashboardView";
import { SignalsView } from "./components/views/SignalsView";
import { ExplorerView } from "./components/views/ExplorerView";
import { CRMView } from "./components/views/CRMView";
import { PosVendaView } from "./components/views/PosVendaView";
import { CRMViagensView } from "./components/views/CRMViagensView";
import { ExecutiveDashboard } from "./components/views/ExecutiveDashboard";
import { ESGCarbonoView } from "./components/views/ESGCarbonoView";
import { MarketIntelligenceView } from "./components/views/MarketIntelligenceView";
import { CrossReferralsView } from "./components/views/CrossReferralsView";
import { ComexView } from "./components/views/ComexView";
import { UserManagementView } from "./components/views/UserManagementView";
import { ClientsManager } from "./components/client/ClientsManager";
import { AbmAccountsView } from "./components/views/AbmAccountsView";
import { CatalogoView } from "./components/views/CatalogoView";
import { PedidosView } from "./components/views/PedidosView";
import { SettingsView } from "./components/views/SettingsView";
import { AgentActionsView } from "./components/views/AgentActionsView";
import { FairImportView } from "./components/views/FairImportView";
import { AutomationsView } from "./components/views/AutomationsView";
import { TutoriaisView } from "./components/views/TutoriaisView";
import { MarketingView } from "./components/views/MarketingView";
import { EntregasView } from "./components/views/EntregasView";
import { MarketingTarefasView } from "./components/views/MarketingTarefasView";
import { DespesasView } from "./components/views/DespesasView";
import { FairReportView, ContentReportView } from "./components/views/FairReportView";
import { MarketingDashboardView } from "./components/views/MarketingDashboardView";
import { MinhasTarefasView } from "./components/views/MinhasTarefasView";
import { ChatView } from "./components/views/ChatView";
import { MarketingRequestsView } from "./components/views/MarketingRequestsView";
import { FornecedoresView } from "./components/views/FornecedoresView";
import { DocumentLibraryView } from "./components/views/DocumentLibraryView";
import { ComprasMarketingView } from "./components/views/ComprasMarketingView";
import { RHOverviewView } from "./components/views/RHOverviewView";
import { RHFuncionariosView } from "./components/views/RHFuncionariosView";
import { RHFornecedoresView } from "./components/views/RHFornecedoresView";
import { RHRecrutamentoView } from "./components/views/RHRecrutamentoView";
import { RHOnboardingView } from "./components/views/RHOnboardingView";
import { RHTreinamentosView } from "./components/views/RHTreinamentosView";
import { RHFeedbackView } from "./components/views/RHFeedbackView";
import { RHFeriasView } from "./components/views/RHFeriasView";
import { BugsView } from "./components/views/BugsView";
import { RHCargosView } from "./components/views/RHCargosView";
import { RHComunicacaoView } from "./components/views/RHComunicacaoView";
import { RHBemEstarView } from "./components/views/RHBemEstarView";
import { RHRelatoriosView } from "./components/views/RHRelatoriosView";
import { MeuRHView } from "./components/views/MeuRHView";
import { PersonalTasksView } from "./components/views/PersonalTasksView";
import { OnboardingModal } from "./components/onboarding/OnboardingModal";
import { OnboardingTour } from "./components/shared/OnboardingTour";
import { useOnboardingTour } from "./hooks/use-onboarding-tour";
import { CommandPalette } from "./components/ui/CommandPalette";
import { MobileBottomNav } from "./components/shell/MobileBottomNav";
import { AppToast } from "./components/shared/AppToast";
import { OfflineBanner } from "./components/shared/OfflineBanner";
import { ChangelogToast } from "./components/shared/ChangelogToast";
import { useAppUpdate } from "./hooks/use-app-update";
import { useChangelogNotice } from "./hooks/use-changelog-notice";
import { useScreenTips } from "./hooks/use-screen-tips";
import { useAgentsCoachmark } from "./hooks/use-agents-coachmark";
import { AgentsSidebarCoachmark } from "./components/shell/AgentsSidebarCoachmark";
import { useFeatureSpotlight } from "./hooks/use-feature-spotlight";
import { FeatureSpotlight } from "./components/shared/FeatureSpotlight";
import { NotFoundView } from "./components/shared/NotFoundView";

// Onboarding contextual por tela: reaproveita o quickStart que já existe em
// VIDEO_TUTORIALS (src/data/tutorials.js), hoje só visível na tela separada
// "Tutoriais". Mapeia o id de `section` (rota) pro `description`
// correspondente em VIDEO_TUTORIALS — só as combinações que genuinamente
// existem nos dois lados hoje. "Usuários", "Construtor de pipeline" e
// "Histórico do funil" (conteúdo do papel gerente) ficam de fora de
// propósito: as 3 telas que descrevem foram absorvidas por outra rota
// (Usuários → dentro de Configurações; Construtor de pipeline → botão
// dentro do próprio Kanban de "crm"; Histórico do funil → aba dentro do
// Executivo) e não têm mais uma `section` própria pra receber a dica sem
// colidir com o mapeamento já escolhido pra "crm"/"executive" abaixo.
const SECTION_SCREEN_TIP_KEYS = {
  crm: "Negócios",
  signals: "Sinais",
  automations: "Automações",
  executive: "Executivo",
  marketing: "Campanhas",
  "marketing-entregas": "Entregas",
  "marketing-despesas": "Despesas",
  "marketing-feiras": "Relatório de Feiras",
  "marketing-conteudo": "Relatório de Conteúdo",
  "marketing-home": "Visão Geral",
  "rh-overview": "Visão Geral",
  "rh-funcionarios": "Funcionários",
  "rh-recrutamento": "Recrutamento",
  "rh-ferias": "Férias",
};

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
    isInviteAcceptance,
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

  // isRHManager precisa existir antes dos hooks de toast/coachmark logo
  // abaixo (useAgentsCoachmark/useChangelogNotice dependem dele pra decidir
  // prioridade na cadeia de overlays) — hoisted do bloco de flags de papel
  // mais abaixo; currentUserRoles/hasAnyRole ficam só aqui, não duplicados.
  const currentUserRoles  = currentUser?.roles?.length ? currentUser.roles : (currentUser?.role ? [currentUser.role] : []);
  const hasAnyRole = (roles) => roles.some(r => currentUserRoles.includes(r));
  const isRHManager        = hasAnyRole(["gerente_rh", "admin"]);

  // Toast "nova versão disponível" + coachmark "Agentes" (RH) + toast
  // "novidades" — ver specautoupdatechangelogtoast.md e
  // docs/design-spec-agents-sidebar-coachmark.md. Quem está vendo o tour de
  // boas-vindas (showOnboarding) não recebe nenhum dos três na mesma sessão.
  const { needRefresh, updateNow, dismiss: dismissAppUpdate } = useAppUpdate();
  const { visible: agentsCoachmarkVisible, dismiss: dismissAgentsCoachmark } = useAgentsCoachmark(currentUser, { isRHManager, skip: showOnboarding || needRefresh });
  const { items: changelogItems, dismiss: dismissChangelog } = useChangelogNotice(currentUser, currentUserRoles, { skip: showOnboarding || agentsCoachmarkVisible });
  const [tutoriaisInitialTab, setTutoriaisInitialTab] = useState(undefined);

  // Multi-cargo (FASE 1): `roles` é a fonte de verdade — um usuário pode
  // acumular mais de um cargo (ex: vendedor + agencia). `role` (escalar)
  // continua existindo só como "cargo principal" pra decidir landing
  // page/dashboard padrão quando os cargos empatam em prioridade. Todo
  // profile sempre tem role ∈ roles (garantido pelo trigger
  // profiles_sync_roles), então currentUserRoles nunca fica vazio pra um
  // usuário válido. (currentUserRoles/hasAnyRole já foram hoisted acima,
  // antes dos hooks de toast/coachmark.)
  const rolesSubsetOf = (roles) => currentUserRoles.length > 0 && currentUserRoles.every(r => roles.includes(r));

  // Acesso por módulo (Configurações → Usuários → "Acesso por módulo") —
  // complementa os cargos: sem override nenhum, `allowedModules` é
  // exatamente o padrão do cargo (mesmas regras hoje embutidas no navGroups
  // abaixo, extraídas pra utils/module-access.js). Controla o que aparece
  // no menu e trava o acesso direto por URL (ver guard mais abaixo) — ainda
  // não é enforcement de RLS tabela a tabela (ver comentário na migration).
  const { overrides: myModuleOverrides } = useModuleOverrides({ userId: currentUser?.id, enabled: Boolean(currentUser) });
  // Chave global de liga/desliga por página (Configurações → Módulos). Entra
  // como filtro POR CIMA do que o cargo/exceção concedeu — restringe, nunca
  // amplia. Espelhado no banco, dentro de current_user_has_module().
  const { states: moduleStates, descriptions: moduleDescriptions, setModuleDescription } = useModuleStates({ enabled: Boolean(currentUser) });
  const allowedModules = useMemo(
    () => gateByModuleStates(
      effectiveModules(currentUserRoles, myModuleOverrides),
      moduleStates,
      { isAdmin: currentUserRoles.includes("admin"), overrides: myModuleOverrides },
    ),
    [currentUserRoles, myModuleOverrides, moduleStates]
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
  // Suporte comercial sem outro cargo: menu Comercial enxuto (ver navGroups).
  const isPureSuporte      = rolesSubsetOf(["suporte"]);
  // RH roles (isRHManager já foi hoisted acima)
  const isRHUser           = hasAnyRole(["rh", "gerente_rh", "admin"]);
  const isPureRH           = rolesSubsetOf(["rh", "gerente_rh"]);
  // Comex (Importação/Exportação Direta): cargo dedicado, sem carve-out pro
  // time comercial geral — vendedor/gerente não enxergam por padrão.
  const isComex            = hasAnyRole(["comex", "admin"]);
  const isPureComex        = rolesSubsetOf(["comex"]);
  // Diretoria (reunião com o RH, 20/07): vê tudo da plataforma, escreve nada
  // (RLS bloqueia toda escrita — ver migration 20260756_papel_diretoria.sql).
  // A única exceção pedida é interação mais rica no Painel Executivo.
  const isDiretoria        = hasAnyRole(["diretoria"]);
  // Painel Executivo deixou de ser exclusivo do gerente Comercial: cada
  // gerente de departamento acessa pra ver (só) a área do próprio setor —
  // Comex incluído desde que a aba própria existe (regra 8 do CLAUDE.md).
  const canSeeExecutive    = isManagerRole || isMarketingManager || isRHManager || isComex || isDiretoria;
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
  // Hub "Inteligência de Mercado" (19-20/08/2026, decidido com o Daniel):
  // aba Mercado visível pra vendedor + gerência/marketing/admin — superset
  // de isInsightsUser, que não incluía vendedor nem gerente Comercial puro.
  // Abas Insights/Cruzamento (dentro do mesmo hub) ficam mais restritas,
  // só gerência/admin — isInsightsUser (já cobre rh/gerente_rh/marketing/
  // gerente_marketing/admin/diretoria) OR isManagerRole (soma gerente
  // Comercial, que isInsightsUser não tinha).
  const canSeeMarketIntel     = hasAnyRole(["vendedor", "gerente", "marketing", "gerente_marketing", "admin"]) || isDiretoria;
  const canSeeDeepMarketIntel = isInsightsUser || isManagerRole;
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
    duplicateLead,
    toggleStar,
    changeStage,
    addLeadActivity,
    loadDemoLeads,
    clearAllLeads: clearAllLeadsRemote,
    isOnline,
    cacheAge,
  } = useLeads({
    userId: currentUser?.id,
    role: currentUser?.role,
    companies: currentUser?.companies,
  });

  // Offline fase 1 (ver docs/design-spec-offline-leads-notas.md) — sincroniza
  // a fila de notas enfileiradas offline assim que a conexão volta.
  const {
    pending: offlineActivityQueue,
    syncMessage: offlineSyncMessage,
    dismissSyncMessage: dismissOfflineSyncMessage,
    retry: retryOfflineActivity,
  } = useOfflineSync({ leads, updateLead: updateLeadRemote, userId: currentUser?.id });

  const offlineStatusByActivityId = useMemo(() => {
    const map = {};
    for (const item of offlineActivityQueue) map[item.id] = item;
    return map;
  }, [offlineActivityQueue]);

  const {
    clients,
    loading: clientsLoading,
    createClient,
    createClientContact,
    updateClient,
    deleteClient,
    upsertClientBillingHistory,
  } = useClients({ userId: currentUser?.id });

  // Só o total de não-lidas — o badge do Chat na navegação precisa disso em
  // qualquer tela, não só dentro do próprio Chat. `incomingMessage` alimenta
  // o toast Nível 1 (spec seção 5, docs/design-spec-chat-mobile-whatsapp.md)
  // — reaproveita a MESMA subscription Realtime que já atualiza o badge, não
  // abre uma segunda.
  const { totalUnread: chatUnread, incomingMessage: chatIncomingMessage } = useChat({ userId: currentUser?.id });

  const { signals } = useMarketSignals();

  const { crossReferrals, approve: approveCross, reject: rejectCross } = useCrossReferrals(leads);
  const { settings, update: updateSettings, reset: resetSettings } = useUserSettings();

  // Meu To-do (ex-"Tarefas Pessoais", depois "Lista Pessoal" 05/08, agora
  // "Meu To-do" 10/08 — pedido do Daniel: "Minhas Tarefas" virou "Pendências"
  // no mesmo grupo do menu, então o nome antigo deste item ficava ambíguo de
  // novo): nasce ligada (settings.personalTasksEnabled,
  // default true) e é desligável em Configurações → Preferências → Recursos.
  // `enabled` deixa o hook inerte (sem fetch/subscribe) pra quem desligou.
  // `openCount` alimenta o badge do item no menu, igual ao chatUnread acima.
  // `tasks` alimenta o lembrete de prazo do sino (useNotifications abaixo).
  const { tasks: personalTasks, openCount: personalTasksOpenCount } = usePersonalTasks({
    userId: currentUser?.id,
    enabled: Boolean(settings.personalTasksEnabled),
  });

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

  // Entregas na busca global (Ctrl+K). `enabled` evita cobrar uma assinatura
  // Realtime de TODO usuário da plataforma por uma categoria que só o time de
  // Marketing/Agência/diretoria pode buscar — mesmo padrão do
  // useMarketingCampaigns logo abaixo. Quem não tem o cargo recebe [] e
  // nenhum canal aberto.
  //
  // DÍVIDA ACEITA (revisão de Segurança, 01/09/2026): enquanto alguém de
  // Marketing está NA tela Entregas, este hook fica montado duas vezes — aqui
  // e dentro da própria EntregasView, que não usa `enabled` porque também
  // precisa de createDeliverable/changeStage/etc. São 2 canais e 2 `select *`
  // sobre a mesma tabela, só nessa tela. Resolver de verdade significa a view
  // passar a receber o array já carregado por aqui (padrão que MarketingView
  // usa), o que é uma reestruturação do fluxo de dado dela — desproporcional
  // pro ganho agora. Registrado pra não parecer descuido.
  const { deliverables: searchableDeliverables } = useMarketingDeliverables({
    userId: currentUser?.id,
    role: currentUser?.role,
    roles: currentUser?.roles,
    enabled: Boolean(currentUser) && (isMarketingUser || isAgencia || isDiretoria),
  });

  const { campaigns } = useMarketingCampaigns({
    userId: currentUser?.id,
    role: currentUser?.role,
    roles: currentUser?.roles,
    companies: currentUser?.companies,
    // isDiretoria também acessa a rota de Despesas (App.jsx, guard da rota
    // marketing-despesas) sem precisar de isMarketingUser — sem essa condição
    // aqui, o dropdown "Campanha relacionada" ficava travado em "Nenhuma
    // campanha cadastrada ainda" mesmo com campanhas reais existindo.
    enabled: Boolean(currentUser) && (isMarketingUser || isAgencia || isDiretoria),
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
  } = useNotifications({ currentUser, leads, personalTasks, notificationPrefs: settings.notifications });

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

  // Deep-link do Cmd-K pra campanha/funcionário específico — ao contrário de
  // `selectedLead`, campanha e funcionário não têm drawer/modal hoisted aqui;
  // MarketingView/RHFuncionariosView consomem o id e limpam de volta pra
  // null (ver initialSelectedCampaignId/initialSelectedEmployeeId).
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  // Mesmo mecanismo pro toast de mensagem nova do Chat (spec seção 5) — o
  // clique em "Abrir" precisa selecionar o canal certo dentro de ChatView,
  // que mantém `selectedId` como state local (não sobe pro App.jsx).
  const [selectedChatChannelId, setSelectedChatChannelId] = useState(null);

  // Mesmo mecanismo, agora pro painel de Conexões (Colaborador/Cliente): cada
  // grupo de conexão pode trocar de seção e abrir o registro específico na
  // tela de destino.
  const [selectedAvaliacaoId, setSelectedAvaliacaoId] = useState(null);
  const [selectedMovimentacaoId, setSelectedMovimentacaoId] = useState(null);
  const [selectedTreinamentoAtribuicaoId, setSelectedTreinamentoAtribuicaoId] = useState(null);
  const [selectedFeriasId, setSelectedFeriasId] = useState(null);
  const [selectedViagemId, setSelectedViagemId] = useState(null);

  // Mesmo mecanismo, agora pra fila de Pendências (Copiloto, 27/08/2026) —
  // esses 4 destinos ainda não tinham nenhum jeito de abrir um registro
  // específico de fora da própria tela (cada um só tinha um `selected`
  // local); subimos pra cá seguindo exatamente o padrão acima, não um novo.
  const [selectedDeliverableId, setSelectedDeliverableId] = useState(null);
  // Deep-link da busca global (Ctrl+K) pro cadastro de Cliente — mesmo par
  // (estado + consumo) já usado pra entrega/campanha/funcionário.
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [selectedPurchaseRequestId, setSelectedPurchaseRequestId] = useState(null);
  const [selectedVagaId, setSelectedVagaId] = useState(null);
  const [selectedPosvendaCaseId, setSelectedPosvendaCaseId] = useState(null);
  const [expandedMarketingRequestId, setExpandedMarketingRequestId] = useState(null);

  const { markViewed: markLeadViewed } = useRecordViews("leads", currentUser?.id);
  useEffect(() => { if (selectedLead?.id) markLeadViewed(selectedLead.id); }, [selectedLead?.id]);

  // Avisa o time de Marketing quando chega uma solicitação nova pelo
  // formulário público — antes só aparecia se alguém abrisse a aba
  // "Solicitações" manualmente. Só a primeira leva (pendentes já existentes
  // no primeiro carregamento) não dispara notificação — só as que chegam
  // depois, via Realtime.
  //
  // Guard de seed: NÃO seedar enquanto `loading` — o hook começa com
  // requests=[] e, se seedarmos nessa pintura, a lista real que chega no
  // fetch seguinte parece "toda nova" e re-notifica todos os pendentes a
  // cada remount (mesmo padrão de race que o lembrete de reembolso tinha
  // com dedup só em useRef). Já-existente em localStorage também bloqueia.
  const { requests: marketingRequests, loading: marketingRequestsLoading } = useMarketingRequests({
    userId: currentUser?.id,
    role: currentUser?.role,
    enabled: Boolean(currentUser) && isMarketingUser,
  });
  const requestsVistosRef = useRef(null);
  useEffect(() => {
    if (!isMarketingUser || marketingRequestsLoading) return;
    if (requestsVistosRef.current === null) {
      requestsVistosRef.current = new Set(marketingRequests.map(r => r.id));
      return;
    }
    for (const r of marketingRequests) {
      if (r.status === "pendente" && !requestsVistosRef.current.has(r.id)) {
        const alreadyExists = notifications.some(n =>
          n.type === "marketing_request" && n.link?.id === r.id
        );
        if (alreadyExists) { requestsVistosRef.current.add(r.id); continue; }
        requestsVistosRef.current.add(r.id);
        pushNotification({
          type: "marketing_request",
          title: "Nova solicitação de marketing",
          body: `${r.requesterName || "Alguém"} pediu "${r.title}"${r.department ? ` (${r.department})` : ""}.`,
          link: { module: "marketing_requests", id: r.id },
        });
      } else {
        requestsVistosRef.current.add(r.id);
      }
    }
  }, [marketingRequests, marketingRequestsLoading, isMarketingUser, pushNotification, notifications]);

  // Aprovação de Férias/Licenças é centralizada no RH (não por gestor direto,
  // já que nem todo gestor tem acesso à plataforma) — então quem precisa ser
  // avisado de uma nova solicitação pendente é o time de RH (gerente_rh/admin).
  // Mesmo guard de seed+localStorage do marketing_request acima.
  const { requests: feriasRequests, loading: feriasRequestsLoading } = useRHFeriasRequests({
    enabled: Boolean(currentUser) && isRHManager,
  });
  const feriasVistosRef = useRef(null);
  useEffect(() => {
    if (!isRHManager || feriasRequestsLoading) return;
    if (feriasVistosRef.current === null) {
      feriasVistosRef.current = new Set(feriasRequests.map(r => r.id));
      return;
    }
    for (const r of feriasRequests) {
      if (r.status === "pendente" && !feriasVistosRef.current.has(r.id)) {
        const alreadyExists = notifications.some(n =>
          n.type === "ferias_solicitada" && n.link?.id === r.id
        );
        if (alreadyExists) { feriasVistosRef.current.add(r.id); continue; }
        feriasVistosRef.current.add(r.id);
        const tipo = RH_LEAVE_TYPES.find(t => t.id === r.type)?.label || r.type;
        pushNotification({
          type: "ferias_solicitada",
          title: "Nova solicitação de férias/licença",
          body: `${r.profiles?.name || "Alguém"} solicitou ${tipo?.toLowerCase?.() || tipo}.`,
          link: { module: "rh_ferias", id: r.id },
        });
      } else {
        feriasVistosRef.current.add(r.id);
      }
    }
  }, [feriasRequests, feriasRequestsLoading, isRHManager, pushNotification, notifications]);

  // Lembrete de prazo de autoavaliação de Feedback: avisa o próprio
  // colaborador quando o prazo (period_end) do ciclo pendente está a até 3
  // dias de vencer (ou já venceu) e ele ainda não preencheu a nota dele.
  const { feedbacks: meusCiclosFeedback } = useRHFeedback({ enabled: Boolean(currentUser) });
  // Via get_my_colaborador() (SECURITY DEFINER), não por select direto em
  // rh_colaboradores: a policy ampla de self-select foi removida em
  // 20260713_fix_..._scope, então o select direto voltava vazio justamente
  // pro colaborador comum — quem mais precisa do lembrete. Também é o que
  // decide se "Meu RH" aparece no menu (a tela só faz sentido pra quem tem
  // ficha de colaborador).
  const { meuColaborador } = useMyColaborador(currentUser);
  const meuColaboradorId = meuColaborador?.id || null;
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
        link: { module: "rh_feedback", id: f.id },
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
    // link.id de todo pushNotification abaixo é c.profileId, não c.id: a tela
    // de Funcionários abre o card por id de PROFILE, não pelo id da linha
    // rh_colaboradores (ver RHFuncionariosView.jsx:1553). profileId vem nulo
    // pra colaborador sem login — cai no fallback de só trocar de seção.
    for (const c of colaboradoresParaLembretes) {
      if (c.employeeStatus !== "ativo") continue;

      const exp = periodoExperienciaInfo(c, hoje);
      if (exp && (exp.diasRestantes === 7 || exp.diasRestantes === 1) && marcar(c.id, `exp${exp.marco}`)) {
        pushNotification({
          type: "compliance_experiencia",
          title: `Período de experiência vencendo (${exp.marco} dias)`,
          body: `${c.fullName}: faltam ${exp.diasRestantes} dia(s) pra decisão do marco de ${exp.marco} dias.`,
          link: { module: "rh_funcionarios", id: c.profileId },
        });
      }

      const asoDias = asoDiasParaVencer(c, hoje);
      if (asoDias != null && asoDias <= 30 && marcar(c.id, "aso")) {
        pushNotification({
          type: "compliance_aso",
          title: asoDias < 0 ? "ASO vencido" : "ASO vencendo",
          body: `${c.fullName}: exame periódico ${asoDias < 0 ? "venceu há " + Math.abs(asoDias) + " dia(s)" : "vence em " + asoDias + " dia(s)"}.`,
          link: { module: "rh_funcionarios", id: c.profileId },
        });
      }

      const contratoDias = contratoDiasParaFim(c, hoje);
      if (contratoDias != null && contratoDias <= 30 && marcar(c.id, "contrato_fim")) {
        pushNotification({
          type: "compliance_contrato",
          title: contratoDias < 0 ? "Contrato temporário venceu" : "Fim de contrato temporário se aproximando",
          body: `${c.fullName}: contrato ${contratoDias < 0 ? "venceu há " + Math.abs(contratoDias) + " dia(s)" : "termina em " + contratoDias + " dia(s)"}.`,
          link: { module: "rh_funcionarios", id: c.profileId },
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
          link: { module: "rh_funcionarios", id: c.profileId },
        });
      }

      if (diasParaAniversario(c, hoje) === 0 && marcar(c.id, "aniversario")) {
        pushNotification({ type: "aniversario", title: "Aniversário hoje 🎂", body: `Hoje é aniversário de ${c.fullName}.`, link: { module: "rh_funcionarios", id: c.profileId } });
      }

      if (diasParaBodasEmpresa(c, hoje) === 0 && marcar(c.id, "bodas_empresa")) {
        const anos = hoje.getFullYear() - new Date(c.admissionDate).getFullYear();
        pushNotification({ type: "bodas_empresa", title: "Aniversário de empresa", body: `${c.fullName} completa ${anos} ano(s) de casa hoje.`, link: { module: "rh_funcionarios", id: c.profileId } });
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
        // Aponta pro funcionário (por profileId, não c.id — mesmo motivo do
        // bloco de conformidade acima), não pra rh_feedback: nesse momento o
        // ciclo ainda é só uma projeção (avaliacaoDiasParaProxima), não
        // existe linha em rh_feedback pra abrir — só nasce quando é criado.
        link: { module: "rh_funcionarios", id: c.profileId },
      });
      for (const dest of destinatarios) {
        sendRhEmail("avaliacao_proxima", dest.email, {
          EMPLOYEE_NAME: c.fullName || "",
          JOB_TITLE: c.jobTitle || "—",
          DEPARTMENT: c.department || "—",
          TIPO_CICLO: cicloTipoLabel(info.tipo),
          DUE_DATE: new Date(info.periodEnd).toLocaleDateString("pt-BR"),
          DUE_LABEL: dueLabel,
        }, { colaboradorId: c.id });
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
    const todayStr = hoje.toDateString();
    for (const c of contratosParaLembretes) {
      if (c.status !== "ativo") continue;
      const dias = contratoFornecedorDiasParaVencer(c, hoje);
      if (dias == null || dias > 30) continue;
      const key = `${c.id}:${hojeISO}`;
      if (contratoVistoRef.current.has(key)) continue;
      // Guard contra o array JÁ PERSISTIDO (localStorage), não só o ref em
      // memória — o ref zera a cada remount/reload da página, mas as
      // notificações já gravadas continuam lá; sem essa checagem, cada
      // reload reinseria o lote inteiro de contratos vencidos (achado
      // BUG-12 da auditoria de QA: contador subindo de 8 pra 24 sem ação
      // do usuário). Mesmo padrão de guard que o gerador de "followup" já
      // usa (checa o array persistido antes de empurrar).
      const alreadyExists = notifications.some(n =>
        n.type === "contrato_fornecedor_vencendo" &&
        n.body?.startsWith(`${c.titulo}:`) &&
        new Date(n.createdAt).toDateString() === todayStr
      );
      if (alreadyExists) { contratoVistoRef.current.add(key); continue; }
      contratoVistoRef.current.add(key);

      const dueLabel = dias < 0 ? `venceu há ${Math.abs(dias)} dia(s)` : dias === 0 ? "vence hoje" : `vence em ${dias} dia(s)`;
      pushNotification({
        type: "contrato_fornecedor_vencendo",
        title: dias < 0 ? "Contrato com fornecedor vencido" : "Contrato com fornecedor vencendo",
        body: `${c.titulo}: ${dueLabel}.`,
        link: { module: "rh_fornecedores", id: c.id },
      });
      const responsavel = c.responsavelId ? users.find((u) => u.id === c.responsavelId) : null;
      if (responsavel?.email) {
        sendRhEmail("contrato_fornecedor_vencendo", responsavel.email, {
          CONTRATO_TITULO: c.titulo || "",
          DUE_DATE: c.vigenciaFim ? new Date(c.vigenciaFim).toLocaleDateString("pt-BR") : "—",
          DUE_LABEL: dueLabel,
        }, { contratoId: c.id });
      }
    }
  }, [contratosParaLembretes, isRHManager, users, pushNotification, notifications]);

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
      }, { agendamentoId: f.id });
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
    const todayStr = hoje.toDateString();
    for (const d of despesasParaLembretes) {
      if (d.status_reembolso !== "pendente" || !d.created_at) continue;
      const diasPendente = Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86400000);
      if (diasPendente < 5) continue;
      const key = `${d.id}:${hojeISO}`;
      if (despesaPendenteVistaRef.current.has(key)) continue;
      // Guard contra o array JÁ PERSISTIDO (localStorage) — mesmo padrão
      // BUG-12 dos contratos fornecedor acima. Sem isso, cada reload/
      // remount reinsería o mesmo reembolso pendente (spam de "há 25/24
      // dias" a cada abertura da sessão).
      const alreadyExists = notifications.some(n =>
        n.type === "reembolso_pendente_ha_dias" &&
        n.link?.id === d.id &&
        new Date(n.createdAt).toDateString() === todayStr
      );
      if (alreadyExists) { despesaPendenteVistaRef.current.add(key); continue; }
      despesaPendenteVistaRef.current.add(key);
      pushNotification({
        type: "reembolso_pendente_ha_dias",
        title: "Reembolso pendente há dias",
        body: `${d.categoria || "Despesa"} (${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(d.valor) || 0)}) está pendente há ${diasPendente} dias.`,
        link: { module: "crm_despesas", id: d.id },
      });
    }
  }, [despesasParaLembretes, isManagerRole, pushNotification, notifications]);

  // Geradores de notificação — stale_lead, cross_sell, weekly_digest,
  // new_candidato: toggles existiam em Configurações > Notificações desde a
  // FASE de grupos (#117) sem nenhum gerador correspondente (ligavam a UI mas
  // nunca disparavam nada — backlog QA da auditoria Zero Bullshit).

  // Lead parado (SLA da etapa estourado) — reusa isStale (já usado em
  // Dashboard/Painel Executivo/Minhas Tarefas como badge passivo); aqui vira
  // push ativo pro dono do lead. Guard "1x por dia por lead", mesmo padrão
  // do lembrete de conformidade acima (dia LOCAL, não UTC).
  const staleLeadVistoRef = useRef(new Set());
  useEffect(() => {
    if (!currentUser) return;
    const hoje = new Date();
    const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    const myLeads = leads.filter(l => getLeadOwnerIds(l).includes(currentUser.id));
    for (const l of myLeads) {
      if (!isStale(l, pipelines?.[l.companyId])) continue;
      const key = `${l.id}:${hojeISO}`;
      if (staleLeadVistoRef.current.has(key)) continue;
      staleLeadVistoRef.current.add(key);
      pushNotification({
        type: "stale_lead",
        title: "Lead parado",
        body: `${l.company} está sem atividade há mais tempo que o SLA da etapa.`,
        leadId: l.id,
        companyId: l.companyId,
      });
    }
  }, [leads, pipelines, currentUser, pushNotification]);

  // Sugestão de cross-sell — crossReferrals já existe (overlaps reais entre
  // frentes + sugestões sintéticas, CrossReferralsView.jsx); aqui só avisa
  // quando uma nova aparece pendente/ativa, mesmo padrão de "vistoRef" das
  // solicitações de marketing/férias acima (primeira leva só marca como
  // vista, não notifica retroativo).
  const crossSellVistoRef = useRef(null);
  useEffect(() => {
    if (!hasAnyRole(["vendedor", "gerente", "admin"])) return;
    const pendentes = crossReferrals.filter(c => c.status === "pending" || c.status === "active");
    if (crossSellVistoRef.current === null) {
      crossSellVistoRef.current = new Set(pendentes.map(c => c.id));
      return;
    }
    for (const c of pendentes) {
      if (crossSellVistoRef.current.has(c.id)) continue;
      crossSellVistoRef.current.add(c.id);
      pushNotification({
        type: "cross_sell",
        title: "Sugestão de cross-sell",
        body: `${c.companyName}: ${c.reason || "oportunidade entre frentes identificada"}.`,
        link: { module: "crm_cross_sell", id: c.id },
      });
    }
  }, [crossReferrals, currentUserRoles, pushNotification]);

  // Resumo semanal do pipeline — só gerente/admin (grupo "Gestão"). Guard
  // persistido (não useRef) porque, ao contrário dos lembretes diários
  // acima, recarregar a página no mesmo dia da semana não pode reenviar o
  // mesmo resumo — chave é a segunda-feira da semana corrente.
  const [weeklyDigestLastSent, setWeeklyDigestLastSent] = usePersistentState(STORAGE_KEYS.weeklyDigestLastSent, null);
  useEffect(() => {
    if (!isManagerRole || !leads.length) return;
    const hoje = new Date();
    const dia = hoje.getDay();
    const diffParaSegunda = (dia === 0 ? -6 : 1) - dia;
    const segunda = new Date(hoje);
    segunda.setDate(hoje.getDate() + diffParaSegunda);
    const semanaISO = `${segunda.getFullYear()}-${String(segunda.getMonth() + 1).padStart(2, "0")}-${String(segunda.getDate()).padStart(2, "0")}`;
    if (weeklyDigestLastSent === semanaISO) return;
    setWeeklyDigestLastSent(semanaISO);
    const agg = aggregatePipeline(leads, users);
    pushNotification({
      type: "weekly_digest",
      title: "Resumo semanal do pipeline",
      body: `${agg.totalLeads} negócios abertos, ${formatK(agg.openValue)} em aberto, ${agg.conversionRate}% de conversão.`,
      link: { module: "pipeline_summary" },
    });
  }, [leads, users, isManagerRole, weeklyDigestLastSent, setWeeklyDigestLastSent, pushNotification]);

  // Novo candidato em processo seletivo — hook só instanciado (fetch +
  // realtime de rh_vagas/rh_candidatos/rh_aplicacoes) quando há usuário de RH
  // logado, mesmo `enabled` de useRHFeriasRequests/useRHColaboradores acima.
  // isRHUser (não isRHManager): grupo "Meus processos" inclui o papel "rh"
  // puro, não só gerente_rh/admin.
  const { candidatos: recrutamentoCandidatos } = useRHRecrutamento({ enabled: Boolean(currentUser) && isRHUser });
  const candidatosVistosRef = useRef(null);
  useEffect(() => {
    if (!isRHUser) return;
    if (candidatosVistosRef.current === null) {
      candidatosVistosRef.current = new Set(recrutamentoCandidatos.map(c => c.id));
      return;
    }
    for (const c of recrutamentoCandidatos) {
      if (candidatosVistosRef.current.has(c.id)) continue;
      candidatosVistosRef.current.add(c.id);
      pushNotification({
        type: "new_candidato",
        title: "Novo candidato em processo seletivo",
        body: `${c.name} se candidatou.`,
        link: { module: "rh_candidatos", id: c.id },
      });
    }
  }, [recrutamentoCandidatos, isRHUser, pushNotification]);

  const [activeCompany, setActiveCompany] = useState("all");
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
  const [crmAutoCreate, setCrmAutoCreate] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  // ÚNICO lugar que decide o que cada cargo busca. Convenção: `undefined` =
  // categoria não liberada (some do rótulo do campo); `[]` = liberada, sem
  // registro. Todo array vem de um hook com RLS — a busca filtra em memória,
  // nunca consulta o banco (ver comentário de cabeçalho do CommandPalette).
  //
  // DUAS camadas, não uma (achado da revisão de Segurança, 01/09/2026 — a 1ª
  // versão disto checava só a de cargo e o comentário prometia paridade com o
  // guard da rota, o que era falso):
  //   1. CARGO — predicado POSITIVO, alinhado à RLS da tabela. Positivo de
  //      propósito: com lista negativa, um cargo novo (ou `comex`/`suporte`
  //      puro hoje) lia "Buscar ... cliente" pra uma categoria que a RLS
  //      nunca devolve — a mesma promessa falsa que esta rodada veio corrigir.
  //   2. REGISTRO DE MÓDULOS (`allowedModules`) — a segunda metade do guard
  //      de rota (App.jsx, `ALL_MODULE_IDS.includes(section) &&
  //      !allowedModules.has(section)`). Sem ela, revogar "Clientes" de um
  //      vendedor tirava o item do menu e redirecionava a rota, mas o Ctrl+K
  //      continuava listando nome, CNPJ e cidade daqueles clientes — e clicar
  //      no resultado levava a um redirect. Vale pras 5 categorias, não só
  //      pras 2 novas.
  const searchScopes = useMemo(() => {
    const porModulo = (id, arr) => (allowedModules.has(id) ? arr : undefined);
    // "suporte" entrou aqui em 01/09/2026, junto com a migration que o
    // acrescentou ao `clients_read`. Este predicado tem que acompanhar a
    // RLS: antes da migration, incluir suporte prometeria uma categoria que
    // o banco não devolvia; agora, deixar de fora esconderia da busca um
    // dado que a pessoa já abre pelo menu.
    const comercial = isManagerRole || isDiretoria || hasAnyRole(["vendedor", "suporte"]);
    const marketing = isMarketingUser || isAgencia || isDiretoria;
    return {
      leads:        porModulo("crm", leads),
      clients:      comercial ? porModulo("clients", clients) : undefined,
      campaigns:    marketing ? porModulo("marketing", campaigns) : undefined,
      deliverables: marketing ? porModulo("marketing-entregas", searchableDeliverables) : undefined,
      employees:    isRHUser
        ? porModulo("rh-funcionarios", users.filter(u => u.role === "rh" || u.role === "gerente_rh" || u.department))
        : undefined,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, clients, campaigns, searchableDeliverables, users, allowedModules,
      currentUserRoles, isManagerRole, isDiretoria, isMarketingUser, isAgencia, isRHUser]);

  // Curto de propósito — ver joinPtCurto. O botão da TopBar tem largura fixa;
  // o rótulo inteiro (5 categorias, caso do admin) não cabe.
  const searchPlaceholder = useMemo(() => {
    const scope = joinPtCurto(globalSearchScopeWords(searchScopes));
    return scope ? `Buscar ${scope}\u2026` : "Buscar\u2026";
  }, [searchScopes]);
  const [clientImportOpen, setClientImportOpen] = useState(false);
  // Import de CLIENTES (carteira, sem virar negócio no Funil) — separado do
  // clientImportOpen acima, que abre o importador de LEADS (usado também na
  // tela de Comercial). Achado real: a tela de Clientes reaproveitava o
  // mesmo estado/modal de leads, o que criaria um negócio fantasma por linha
  // só pra povoar a lista de clientes.
  const [clientRosterImportOpen, setClientRosterImportOpen] = useState(false);

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

  // Reporte de bug sem atrito (mockup aprovado 02/09/2026). Três entradas
  // para o mesmo formulário: a tela de erro (`erro` preenchido), o ícone da
  // TopBar, e a Central de Bugs — `origem` grava qual foi, pra dar pra medir
  // se as camadas novas pegaram.
  const [bugReport, setBugReport] = useState(null); // null = fechado
  // `enabled: false` é obrigatório aqui, não otimização: no padrão o hook
  // faz um SELECT da tabela inteira E abre um canal Realtime permanente em
  // postgres_changes — para TODO usuário, em TODA tela. Daqui só se usa o
  // `createReport`, que não depende de nenhum dos dois (ver use-bug-reports.js:
  // ele insere direto, sem olhar `enabled`). A lista de bugs continua sendo
  // carregada pela Central de Bugs, que é quem realmente precisa dela.
  const { createReport: criarBugReport } = useBugReports({ userId: currentUser?.id, isAdmin: false, enabled: false });

  // Anel de erros do navegador: instalado uma vez, no arranque. Sem ele o bug
  // que NÃO quebra a tela (promise rejeitada, escrita barrada pela RLS) não
  // deixava rastro nenhum — ver src/utils/error-log.js.
  useEffect(() => { instalarCapturaDeErros(); }, []);

  // Fila da IA esperando aprovação (mockup aprovado 03/09/2026). Só quem pode
  // aprovar é cobrado — os 10 vendedores não decidem nada nessa fila.
  // `isManagerRole` (linha ~241), NÃO `isManager`: este último só é
  // declarado lá pela 1516, depois daqui — usar ele seria TDZ e derrubaria
  // o App inteiro, a mesma classe de bug documentada na regra 3.2.
  const podeAprovarFilaIA = !!(currentUser && (isAdmin || isManagerRole || isRHManager));
  const filaIA = useAgentQueueAlert({ enabled: podeAprovarFilaIA });

  // Degrau 2 e 3 da escada de urgência da fila da IA (mockup 03/09/2026):
  // um aviso no sino a partir de 1 dia parado, e o texto passa a citar a
  // idade a partir de 3. `localStorage` guarda o dia do último aviso POR
  // usuário: sem isso, cada recarga da página gera um aviso novo — o ruído
  // que a escada existe justamente pra evitar.
  //
  // Um aviso por pessoa por dia, somando a fila inteira: 24 sugestões
  // continuam sendo UM aviso, nunca 24.
  useEffect(() => {
    if (!podeAprovarFilaIA || filaIA.carregando) return;
    if (filaIA.total === 0 || filaIA.diasMaisVelho < DIAS_ATENCAO) return;
    const chave = `gs_v4_fila_ia_avisada_${currentUser?.id || "anon"}`;
    const hoje = new Date().toDateString();
    let jaAvisouHoje = false;
    try { jaAvisouHoje = window.localStorage.getItem(chave) === hoje; } catch { /* modo privado */ }
    if (jaAvisouHoje) return;
    const n = filaIA.total;
    const velha = filaIA.diasMaisVelho >= DIAS_AMBAR;
    pushNotification({
      type: "fila_ia",
      title: velha
        ? `${n} ${n === 1 ? "sugestão parada" : "sugestões paradas"} há ${filaIA.diasMaisVelho} dias`
        : `${n} ${n === 1 ? "sugestão da IA espera" : "sugestões da IA esperam"} sua aprovação`,
      body: velha
        ? "Sinal de mercado perde validade parado. Abra Agentes e decida — aprovar ou recusar, os dois resolvem."
        : "Abra Agentes para aprovar ou recusar.",
      link: { module: "fila_ia", id: null },
    });
    try { window.localStorage.setItem(chave, hoje); } catch { /* modo privado */ }
  }, [podeAprovarFilaIA, filaIA.carregando, filaIA.total, filaIA.diasMaisVelho, currentUser?.id, pushNotification]);


  // Descrição editável da página, entregue por contexto pro PageTitle (ver
  // comentário longo lá). Fica aqui porque só o App sabe qual seção está
  // aberta — as views que renderizam o título não conhecem o próprio
  // module_id. `canEdit` só admin: a policy module_states_write é admin-only
  // e essa policy também liga/desliga página, então afrouxar pra gerente
  // daria junto o poder de derrubar telas do Grupo (ver cabeçalho da
  // migration 20260901180000). O botão nem aparece pra quem não pode — e se
  // aparecesse, a RLS ainda recusaria e o erro subiria na UI.
  //
  // TEM QUE FICAR DEPOIS DE `section` — não mova pra cima junto dos outros
  // flags de papel. Array de dependência é avaliado NA CHAMADA do useMemo,
  // não de forma diferida como o factory: com `section` declarado abaixo,
  // toda renderização de App lançaria "Cannot access 'section' before
  // initialization" e a plataforma inteira viraria tela branca. Foi
  // exatamente isso na 1ª versão desta feature (pego pelo QA, 01/09/2026),
  // e é a MESMA classe do hotfix 32108f7 em Recrutamento. `npm run build`
  // passa nos dois casos: nem o Vite nem o gate fazem análise de TDZ.
  const pageDescriptionCtx = useMemo(() => ({
    moduleId: section,
    description: moduleDescriptions[section] ?? null,
    canEdit: isAdmin,
    onSave: setModuleDescription,
  }), [section, moduleDescriptions, isAdmin, setModuleDescription]);
  const setSection = useCallback((id) => {
    const path = ROUTES[id];
    if (path) navigate(path);
  }, [navigate]);

  // Toast de dica de tela — nunca junto do onboarding nem dos outros 2 toasts
  // (update disponível, novidades): só um AppToast visível por vez.
  const { tip: screenTip, dismiss: dismissScreenTip } = useScreenTips(
    currentUser,
    SECTION_SCREEN_TIP_KEYS[section],
    { skip: showOnboarding || needRefresh || agentsCoachmarkVisible || changelogItems.length > 0 }
  );

  // Tour guiado contextual (ver src/data/feature-spotlights.js) — aponta pra
  // um elemento real da tela quando o usuário naturalmente visita a rota
  // onde aquela novidade mora, em vez de forçar um tour tela-por-tela.
  const { spotlight: featureSpotlight, dismiss: dismissFeatureSpotlight } = useFeatureSpotlight(
    currentUser,
    section,
    { skip: showOnboarding }
  );

  // Tour guiado sequencial da plataforma inteira (diferente do spotlight
  // acima — ver comentário em use-onboarding-tour.js). Mesmo flag `skip:
  // showOnboarding` do spotlight faz o encaixe automático com o modal de
  // boas-vindas: usuário novo só começa o tour depois de fechar o modal
  // (showOnboarding vira false), usuário que já tinha dispensado o
  // onboarding antigo já tem showOnboarding=false e recebe o tour no
  // primeiro load em que ainda não tiver visto, sem precisar de nenhum
  // "usuário novo" — decidido com o Daniel 10/08/2026 (tour vale pra todos).
  const onboardingTour = useOnboardingTour(currentUser, { skip: showOnboarding });
  // No mobile a sidebar é um painel off-canvas (não reserva espaço, some da
  // tela quando fechado) — sem abrir sozinho aqui, o tour não teria nada pra
  // destacar. Inofensivo no desktop: mobileOpen só é lido quando isMobile
  // (ver Sidebar.jsx), então setar aqui não afeta a sidebar fixa de tela grande.
  useEffect(() => {
    // Liga junto do tour, desliga junto do tour (pular ou concluir) — achado
    // em QA adversarial: a versão anterior só abria, nunca fechava sozinha,
    // deixando o drawer (e o scroll da página travado, ver overflow logo
    // acima) preso aberto depois de "Pular tour" no mobile. Só reage à
    // borda de transição de `active` (dependência única), então não briga
    // com o usuário abrindo/fechando manualmente pelo hambúrguer fora do tour.
    setSidebarMobileOpen(onboardingTour.active);
  }, [onboardingTour.active]);

  // Destino genérico de uma notificação (@menção OU gerador local via
  // pushNotification/use-notifications.js) — leva pra tela certa e, pros
  // módulos com estado "selecionado" hoisted aqui (ver
  // notificationDeepLinkSetters logo abaixo), abre o card exato.
  const NOTIFICATION_LINK_SECTIONS = {
    campaigns: "marketing",
    deliverables: "marketing-entregas",
    marketing_tasks: "marketing-tarefas",
    purchase_requests: "marketing-compras",
    marketing_requests: "marketing-solicitacoes",
    rh_vagas: "rh-recrutamento",
    rh_candidatos: "rh-recrutamento",
    rh_onboarding: "rh-onboarding",
    rh_treinamentos: "rh-treinamentos",
    rh_feedback: "rh-feedback",
    rh_ferias: "rh-ferias",
    rh_movimentacoes: "rh-cargos",
    comex_import_operations: "comex",
    comex_export_operations: "comex",
    rh_funcionarios: "rh-funcionarios",
    rh_fornecedores: "rh-fornecedores",
    crm_despesas: "crm-viagens",
    crm_cross_sell: "crossref",
    pipeline_summary: "crm",
    // Fila da IA esperando aprovação: leva pra tela Agentes. Sem entrada aqui
    // o aviso do sino só marcaria como lido e não navegaria pra lugar nenhum
    // (handleNotificationNavigate desiste quando o módulo não está no mapa).
    fila_ia: "agents",
    // Sem estado "selecionado" hoisted aqui (mesma situação de crm_cross_sell/
    // pipeline_summary acima) — a tarefa exata é aberta pelo usuário na tela,
    // o sino só leva até a Lista Pessoal.
    personal_tasks: "personal-tasks",
  };
  // Módulos com abertura do card específico, não só a troca de seção — mesmo
  // mecanismo de deep-link do Cmd-K (initialSelectedXId/onInitialXConsumed já
  // plugados em cada tela, ver App.jsx:401-419). Os módulos fora deste mapa
  // (deliverables, marketing_tasks, purchase_requests, marketing_requests,
  // rh_vagas, rh_candidatos, rh_onboarding, comex_*, crm_despesas,
  // crm_cross_sell, pipeline_summary) ainda não têm um estado "selecionado"
  // hoisted aqui — ficam só na navegação de seção até ganharem um.
  const notificationDeepLinkSetters = {
    campaigns: setSelectedCampaignId,
    rh_ferias: setSelectedFeriasId,
    rh_feedback: setSelectedAvaliacaoId,
    rh_treinamentos: setSelectedTreinamentoAtribuicaoId,
    rh_movimentacoes: setSelectedMovimentacaoId,
    rh_funcionarios: setSelectedEmployeeId,
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
    if (!target) return;
    setSection(target);
    const setDeepLinkId = notificationDeepLinkSetters[link.module];
    if (link.id && setDeepLinkId) setDeepLinkId(link.id);
  }, [
    leads, setSelectedLead, setSection, navigate,
    setSelectedCampaignId, setSelectedFeriasId, setSelectedAvaliacaoId,
    setSelectedTreinamentoAtribuicaoId, setSelectedMovimentacaoId, setSelectedEmployeeId,
  ]);

  // Mesmo espírito de handleNotificationNavigate acima, pra fila de
  // Pendências (Copiloto, 27/08/2026) — a chave aqui é `task.module` (como
  // vem de use-my-tasks.js), não o nome de tabela usado pelas notificações,
  // por isso é um mapa à parte em vez de reaproveitar
  // notificationDeepLinkSetters — mas os SETTERS por trás são os mesmos
  // (nunca duplicar o estado, só o roteamento até ele).
  const handleOpenPendingTask = useCallback((task) => {
    setSection(task.section);
    const id = task.raw?.id ?? null;
    switch (task.module) {
      case "campaigns": setSelectedCampaignId(id); break;
      case "feedback": setSelectedAvaliacaoId(id); break;
      case "ferias": setSelectedFeriasId(id); break;
      case "treinamentos": setSelectedTreinamentoAtribuicaoId(id); break;
      case "colaboradores":
      case "beneficios":
        // RHFuncionariosView casa por id de USUÁRIO (profiles.id), não pelo
        // id da linha de rh_colaboradores — são PKs diferentes (achado real
        // da pesquisa de deep-link). Colaborador sem conta vinculada
        // (profileId nulo) não tem card de usuário pra abrir — a seção já
        // muda, só não abre um card específico.
        if (task.raw?.profileId) setSelectedEmployeeId(task.raw.profileId);
        break;
      case "deliverables": setSelectedDeliverableId(id); break;
      case "purchases": setSelectedPurchaseRequestId(id); break;
      case "vagas": setSelectedVagaId(id); break;
      case "posvenda": setSelectedPosvendaCaseId(id); break;
      case "requests": setExpandedMarketingRequestId(id); break;
      default: break;
    }
  }, [
    setSection, setSelectedCampaignId, setSelectedAvaliacaoId, setSelectedFeriasId,
    setSelectedTreinamentoAtribuicaoId, setSelectedEmployeeId, setSelectedDeliverableId,
    setSelectedPurchaseRequestId, setSelectedVagaId, setSelectedPosvendaCaseId,
    setExpandedMarketingRequestId,
  ]);

  // Toast Nível 1 de mensagem nova do Chat (spec seção 5,
  // docs/design-spec-chat-mobile-whatsapp.md) — só dispara quando quem
  // recebeu não está na tela de Chat agora (não tem como saber daqui qual
  // canal está aberto dentro de ChatView, que é state local; "não está no
  // Chat" cobre o caso descrito na spec sem abrir uma segunda subscription
  // só pra isso). Deliberadamente sem `section` nas deps: precisa avaliar o
  // valor de `section` no momento em que a mensagem chega, não re-disparar
  // quando o usuário troca de tela depois.
  const [chatToast, setChatToast] = useState(null);
  useEffect(() => {
    if (!chatIncomingMessage) return;
    if (section === "chat") return;
    setChatToast(chatIncomingMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatIncomingMessage]);

  const handleOpenChatToast = useCallback(() => {
    if (!chatToast) return;
    setSelectedChatChannelId(chatToast.channelId);
    setSection("chat");
    setChatToast(null);
  }, [chatToast, setSection]);

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
    fairCampaignId: "",
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
    if (currentUser.role === "vendedor") {
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
              // A edge function usa "—" como placeholder de UI quando não tem o
              // dado, e `city` chega como "Município/UF" combinado — sem tratar,
              // o guard `!current.x && res.x` gravava o caractere "—" como setor
              // e UF reais, e a UF duplicada dentro da cidade. Mesmo tratamento
              // que ClientsManager.jsx já aplica (achado de QA de lá).
              const clean = (v) => (v && v !== "—" ? v : "");
              const cidade = clean(res.city).split("/")[0].trim();
              if (!current.sector && clean(res.sector)) patch.sector = clean(res.sector);
              if (!current.city && cidade) patch.city = cidade;
              if (!current.state && clean(res.state)) patch.state = clean(res.state);
              if (!current.cnae && res.cnae) patch.cnae = res.cnae;
              if (!current.situacao && res.situacao) patch.situacao = res.situacao;
              // A razão social já vinha no retorno e era descartada, apesar de
              // `leads.razao_social` existir e ser exibida no drawer.
              if (!current.razaoSocial && res.razaoSocial) patch.razaoSocial = res.razaoSocial;
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

  // Duplicar card do Funil de Vendas — cópia sempre nasce na 1ª etapa
  // não-terminal do pipeline DAQUELA empresa (pipelines[companyId], configurável
  // por Comercial > Editar etapas), nunca herdando a etapa do lead original.
  const handleDuplicateLead = useCallback(async (id) => {
    const source = leads.find(l => l.id === id);
    if (!source) return;
    const stagesForCompany = pipelines[source.companyId] || DEFAULT_PIPELINE_STAGES;
    const firstStage = stagesForCompany.find(s => !s.terminal) || stagesForCompany[0];
    const created = await duplicateLead(source, firstStage?.id);
    if (created) {
      const { patches, notifications: autoNotifs, sideEffects } = evaluateAutomations(created, null, "lead_created");
      await applyAutomationOutcome(patches, autoNotifs, created.id, created.companyId);
      if (sideEffects?.length) await processAutomationSideEffects(sideEffects);
    }
    return created;
  }, [leads, pipelines, duplicateLead, evaluateAutomations, processAutomationSideEffects, applyAutomationOutcome]);

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
    // Portal e Agência têm shell fixo e saem antes do filtro geral lá
    // embaixo — mas a chave global tem que valer pra eles também, senão
    // "Chat desligado" continuaria mostrando Chat pra fora de casa, que é
    // justamente quem menos deveria ver uma página em obras.
    const notOff = (items) => items.filter(i => (moduleStates[i.id] || "live") !== "off");

    // Portal: só "Meu RH", nada mais — mesmo espírito do isAgencia abaixo.
    if (isPortalOnly) {
      return [
        {
          label: null,
          items: notOff([
            { id: "meu-rh", label: "Meu RH", icon: Home },
            ...(currentUser?.chatEnabled === false ? [] : [{ id: "chat", label: "Chat", icon: MessageCircle, badge: chatUnread || undefined }]),
          ]),
        },
      ].filter(g => g.items.length > 0);
    }

    // Agência: only Campanhas + Entregas, nothing else.
    if (isAgencia) {
      return [
        {
          label: "Marketing",
          items: notOff([
            { id: "marketing",          label: "Campanhas", icon: Megaphone },
            { id: "marketing-entregas", label: "Entregas",  icon: Package },
          ]),
        },
      ].filter(g => g.items.length > 0);
    }

    const groups = [];

    // "Meu RH" só faz sentido pra quem tem ficha em rh_colaboradores — sem
    // ela a tela abre vazia (holerite, férias e dados pessoais são todos
    // ancorados no id do colaborador, não no do profile).
    const temFichaColaborador = Boolean(meuColaboradorId);

    // FASE 6: Minhas Tarefas é o pouso pós-login pra todo papel interno
    // (agência já saiu por cima, no `if` acima) — item de nav universal, já
    // que antes só quem caía na rota "dashboard" tinha um link direto pra ela
    // (todo o resto usava "Visão Geral" pra ir pro dashboard antigo do
    // próprio módulo).
    // Chat fica ao lado de Minhas Tarefas, sempre presente: é utilitário do
    // dia a dia de todo mundo, não feature de um módulo (mesma lógica que já
    // vale pra Minhas Tarefas). Decidido com o Daniel no mockup do Chat.
    // Grupo unificado "Meu Espaço" (mockup aprovado com o Daniel): antes
    // existiam DOIS grupos separados — este (sem label visível) com Minhas
    // Tarefas/Chat, e um segundo grupo, mais abaixo, literalmente rotulado
    // "Meu Espaço" só com Meu RH. Consolidados num único grupo rotulado —
    // Meu RH entra aqui embaixo, sob a MESMA condição de sempre
    // (isRHUser||isDiretoria) && temFichaColaborador, sem ampliar nem reduzir
    // quem já enxergava esse item. Lista Pessoal vem ligada por padrão
    // (settings.personalTasksEnabled) e some daqui pra quem desligar em
    // Configurações → Preferências → Recursos; é privada por usuário (RLS).
    groups.push({
      label: "Meu Espaço",
      items: [
        { id: "dashboard", label: "Pendências", icon: CheckSquare },
        ...(currentUser?.chatEnabled === false ? [] : [{ id: "chat", label: "Chat", icon: MessageCircle, badge: chatUnread || undefined }]),
        ...(settings.personalTasksEnabled
          ? [{ id: "personal-tasks", label: "Meu To-do", icon: ListChecks, badge: personalTasksOpenCount || undefined }]
          : []),
        ...((isRHUser || isDiretoria) && temFichaColaborador
          ? [{ id: "meu-rh", label: "Meu RH", icon: Home }]
          : []),
      ],
    });

    // Suporte comercial "puro": opera pedido e mantém o catálogo, não vende.
    // Não precisa de funil, sinais nem prospecção — e o RLS já limitava o
    // dado, então isto é higiene de menu, não permissão nova.
    if (isPureSuporte) {
      groups.push({
        label: "Comercial",
        items: [
          { id: "pedidos",  label: "Pedidos",  icon: ClipboardList },
          { id: "clients",  label: "Clientes", icon: Users },
          { id: "catalogo", label: "Catálogo", icon: PackageSearch },
        ],
      });
    } else if (!isPureMarketing && !isPureRH && !isPureComex) {
      groups.push({
        label: "Comercial",
        items: [
          { id: "commercial-overview", label: "Visão Geral", icon: LayoutDashboard },
          // Ordem "jornada do cliente" (decidido com o Daniel em 28/07/2026):
          // sinal de interesse → funil ativo → pós-venda → base de clientes →
          // expansão → prospecção/apoio.
          { id: "signals",      label: "Sinais",     icon: Bell },
          { id: "crm",          label: "Funil de Vendas",   icon: Layers },
          // Logo abaixo de "Funil de Vendas" (pedido explícito do usuário) — conectado
          // ao Kanban do Funil de Vendas igual Recrutamento é conectado a Onboarding:
          // botão "Enviar para Pós-venda" no negócio Ganho (ver
          // LeadDetailDrawer.jsx) cria um caso aqui, o negócio original
          // continua existindo no Funil de Vendas.
          { id: "posvenda",     label: "Funil de Pós-venda", icon: Handshake },
          { id: "pedidos",      label: "Pedidos",    icon: ClipboardList },
          { id: "clients",      label: "Clientes",   icon: Users },
          { id: "abm",          label: "Contas · ABM", icon: Building2 },
          { id: "catalogo",     label: "Catálogo",   icon: PackageSearch },
          { id: "document-library", label: "Biblioteca de Documentos", icon: BookOpen },
          ...(isManager ? [{ id: "crossref", label: "Cross-sell", icon: Shuffle }] : []),
          { id: "explorer",     label: "Explorador", icon: Globe2 },
          { id: "crm-viagens",  label: "Viagens & Despesas", icon: Plane },
          ...(isComex || isDiretoria ? [{ id: "comex", label: "Comex", icon: Ship }] : []),
        ],
      });
    } else if (isPureComex) {
      // Cargo dedicado, sem carve-out pro time comercial geral (decisão do
      // Daniel) — quem só tem "comex" não vê o resto do menu Comercial.
      groups.push({
        label: "Comercial",
        items: [{ id: "comex", label: "Comex", icon: Ship }],
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
        // Logo abaixo de "Entregas" (pedido explícito do usuário) — board
        // separado de tarefas do dia a dia do time, pra não misturar com as
        // entregas/demandas de produção com a agência.
        { id: "marketing-tarefas",        label: "Tarefas",      icon: ListTodo },
        { id: "marketing-fornecedores",   label: "Fornecedores", icon: Truck },
        { id: "marketing-compras",        label: "Compras",      icon: ShoppingCart },
        { id: "marketing-despesas",       label: "Despesas",     icon: DollarSign },
        { id: "marketing-feiras",         label: "Feiras",       icon: Tent },
        { id: "marketing-conteudo",       label: "Conteúdo",     icon: Newspaper }
      );
      // Catálogo aparece aqui só pra quem NÃO tem o menu Comercial — o
      // Marketing mantém a metade "vitrine" do produto (chamada, destaques,
      // especificações), que é o que o Portal B2B mostra pro cliente. Quem
      // tem os dois menus já vê o item no Comercial; repetir confundiria.
      if (isPureMarketing) {
        mktItems.push({ id: "catalogo", label: "Catálogo", icon: PackageSearch });
      }
      groups.push({ label: "Marketing", items: mktItems });
    }

    if (isRHUser || isDiretoria) {
      groups.push({
        label: "Recursos Humanos",
        // Cargos/Comunicação/Bem-estar/Relatórios: achado do Daniel 10/08/2026
        // — apareciam pra qualquer isRHUser mas a rota só renderiza de fato
        // pra isRHManager||isDiretoria (ver as 4 rotas correspondentes mais
        // abaixo), então um RH comum clicava e caía de volta no Início sem
        // explicação. Corrigido restringindo o item de menu ao mesmo público
        // que já podia abrir a rota — nenhum acesso novo concedido, só o menu
        // deixando de prometer o que não entrega.
        items: [
          { id: "rh-overview",     label: "Visão Geral",      icon: LayoutDashboard },
          { id: "rh-recrutamento", label: "Recrutamento",      icon: BriefcaseBusiness },
          { id: "rh-onboarding",   label: "Onboarding",        icon: ClipboardCheck },
          { id: "rh-treinamentos", label: "Treinamentos",      icon: GraduationCap },
          { id: "rh-feedback",     label: "Avaliação de Desempenho", icon: MessageSquareText },
          { id: "rh-ferias",       label: "Férias & Licenças", icon: CalendarCheck },
          { id: "rh-funcionarios", label: "Funcionários",      icon: Users },
          ...(isRHManager || isDiretoria ? [
            { id: "rh-cargos",       label: "Cargos & Salários", icon: Briefcase },
            { id: "rh-comunicacao",  label: "Comunicação",       icon: Megaphone },
            { id: "rh-bem-estar",    label: "Bem-estar",         icon: HeartHandshake },
          ] : []),
          { id: "rh-fornecedores", label: "Fornecedores",      icon: Building2 },
          ...(isRHManager || isDiretoria ? [
            { id: "rh-relatorios",   label: "Relatórios",        icon: FileBarChart },
          ] : []),
        ],
      });
    } else {
      // Todo colaborador (não só RH) precisa ver seu próprio checklist de
      // onboarding, treinamentos atribuídos e feedbacks — não é uma tela de
      // gestão de RH. "Meu RH" (/meu-rh) entra aqui só pra quem tem ficha de
      // colaborador: a tela existia mas não estava em menu nenhum, então só
      // era alcançável digitando a URL na mão.
      groups.push({
        label: "Meu Desenvolvimento",
        items: [
          ...(temFichaColaborador ? [{ id: "meu-rh", label: "Meu RH", icon: Home }] : []),
          { id: "rh-onboarding",   label: "Onboarding",   icon: ClipboardCheck },
          { id: "rh-treinamentos", label: "Treinamentos", icon: GraduationCap },
          { id: "rh-feedback",     label: "Avaliação de Desempenho", icon: MessageSquareText },
        ],
      });
    }

    // Quem é do RH/diretoria também é colaborador — tem holerite, ponto e
    // férias próprios. O grupo "Meu Desenvolvimento" acima não roda pra eles
    // (já veem os boards de gestão) — "Meu RH" pra essa população vive no
    // grupo "Meu Espaço" no topo do menu (empurrado ali mesmo, junto de
    // Minhas Tarefas/Chat/Lista Pessoal), não mais num grupo próprio aqui.

    // "Inteligência": Executivo/Agentes ficam sob isManager (gerente Comercial
    // + admin, mesmo escopo de sempre). Insights entra à parte sob
    // isInsightsUser — ele cruza dados de RH e Marketing que um gerente
    // Comercial puro não tem RLS pra ler, então não pode herdar o mesmo gate.
    // Cross-sell morou aqui antes, mas é uma ferramenta comercial (indicação
    // entre empresas do grupo) — mudou pra dentro do grupo "Comercial".
    const intelItems = [];
    if (canSeeExecutive) intelItems.push({ id: "executive", label: "Executivo",  icon: BarChart3 });
    // Hub "Inteligência de Mercado" (19-20/08/2026) — substitui o antigo
    // item "Insights" solto: agora são 3 abas (Mercado/Insights/Cruzamento)
    // dentro de uma página só (ver MarketIntelligenceView), com a antiga
    // InsightsView realocada pra dentro como a aba "Insights", não recriada.
    if (canSeeMarketIntel) intelItems.push({ id: "market-intel", label: "Mercado", icon: Globe2 });
    // ESG & Carbono (Fase 1, mockup aprovado 07/08/2026) — mesmo gate de RLS
    // das 3 tabelas esg_* (admin/gerente/diretoria), não canSeeExecutive
    // (que também inclui gerente_marketing/rh/comex, sem RLS pra essas
    // tabelas).
    if (isManager || isDiretoria) intelItems.push({ id: "esg-carbono", label: "ESG & Carbono", icon: Leaf });
    // Agent Builder (PRD docs/prd-agent-builder.md): gerente_rh também cria e
    // aprova agentes de IA (piloto Fornecedores RH), não só o gerente
    // Comercial — mesmo gate que module-access.js/current_user_has_module.
    if (isManager || isRHManager) {
      // Badge = agentes de IA pausados pelo sistema (paused_reason truthy —
      // chave de IA quebrada/ausente), não pausa manual (enabled=false):
      // isso pede atenção de alguém, pausa manual foi decisão do próprio time.
      const pausedAgentsCount = automations.filter(a => a.module === "rh-fornecedores" && a.pausedReason).length;
      // Soma com a fila esperando aprovação (escada de urgência, 03/09/2026):
      // os dois são "tem coisa te esperando em Agentes", e dois contadores no
      // mesmo item de menu não caberiam nem se explicariam.
      const aguardandoAgents = pausedAgentsCount + (filaIA.total || 0);
      intelItems.push({ id: "agents", label: "Agentes", icon: Bot, badge: aguardandoAgents > 0 ? aguardandoAgents : undefined });
    }
    if (intelItems.length > 0) {
      groups.push({ label: "Inteligência", items: intelItems });
    }

    // Automações inclui agora o Agent Builder de RH (isRHManager) — /settings
    // já é universal (rota sem gate, ver ROUTES.settings), então ampliar este
    // grupo não muda nenhum acesso a Configurações, só dá o atalho no menu.
    if (isManager || isRHManager) {
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
        // Central de Bugs (mockup aprovado 17/08/2026): reportar é aberto a
        // todo mundo, por isso o item de menu não tem gate de cargo — só a
        // tela de triagem completa (board) é isAdmin-only, decidido dentro
        // de BugsView.jsx.
        { id: "central-bugs", label: "Central de Bugs", icon: Bug },
      ],
    });

    // Acesso por módulo: só filtra itens que de fato fazem parte do
    // registro de módulos (dashboard/tutorials/settings/automations ficam
    // de fora — controlados só por cargo, como sempre). Grupo que fica
    // vazio depois do filtro some do menu.
    return groups
      .map(g => ({ ...g, items: g.items.filter(i => !ALL_MODULE_IDS.includes(i.id) || allowedModules.has(i.id)) }))
      .filter(g => g.items.length > 0);
  }, [isManager, isRHManager, canSeeExecutive, isInsightsUser, canSeeMarketIntel, isMarketingUser, isPureMarketing, isAgencia, isRHUser, isPureRH, isComex, isPureComex, isPortalOnly, isPureSuporte, isDiretoria, allowedModules, moduleStates, automations, meuColaboradorId, chatUnread, settings.personalTasksEnabled, personalTasksOpenCount, currentUser?.chatEnabled, filaIA.total]);

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

    // "agents"/"automations" também são de gerente_rh agora (Agent Builder,
    // PRD docs/prd-agent-builder.md) — as outras seguem exclusivas do
    // gerente Comercial.
    const managerOnly = ["crossref", "funnel-history", "fair-import", "users"];
    const managerOrRHManagerOnly = ["agents", "automations"];
    if (!isManager && managerOnly.includes(section)) {
      setSection("dashboard");
    }
    if (!isManager && !isRHManager && managerOrRHManagerOnly.includes(section)) {
      setSection("dashboard");
    }
    // "executive" (Painel Executivo) não é mais exclusivo do gerente
    // Comercial — gerente de Marketing/RH também acessa, só vê o recorte
    // do próprio departamento lá dentro (ver canSeeExecutive).
    if (!canSeeExecutive && section === "executive") {
      setSection("dashboard");
    }
    // Hub "Inteligência de Mercado" tem gate próprio (canSeeMarketIntel), não
    // o isManager genérico — ver comentário na definição da flag. /insights
    // (rota antiga) já redireciona pra cá sozinho (ver Route), então section
    // nunca fica presa em "insights" por mais de um tick.
    if (!canSeeMarketIntel && section === "market-intel") {
      setSection("dashboard");
    }
    const marketingOnly = ["marketing", "marketing-entregas", "marketing-tarefas", "marketing-despesas", "marketing-solicitacoes", "marketing-fornecedores", "marketing-compras", "marketing-feiras", "marketing-conteudo"];
    if (!isMarketingUser && !isAgencia && !isDiretoria && marketingOnly.includes(section)) {
      setSection("dashboard");
    }
    // Agência não acessa Solicitações, Fornecedores nem Compras (áreas internas de marketing)
    if (isAgencia && (section === "marketing-solicitacoes" || section === "marketing-fornecedores" || section === "marketing-compras")) {
      setSection("marketing");
    }
    // Pure marketing users shouldn't access CRM sections
    const crmSections = ["crm", "posvenda", "signals", "explorer", "crm-viagens", "commercial-overview", "abm"];
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
    // Comex: cargo dedicado, sem carve-out pro time comercial geral —
    // vendedor/gerente não acessam mesmo digitando a URL direto.
    if (!isComex && !isDiretoria && section === "comex") {
      setSection("dashboard");
    }
    // Pure RH users shouldn't access CRM sections
    if (isPureRH && crmSections.includes(section)) {
      setSection("rh-overview");
    }
    // Pure Comex users shouldn't access general CRM sections either — cargo
    // dedicado, sem carve-out pro time comercial geral (mesma exclusão já
    // feita em module-access.js/defaultModulesForRoles).
    if (isPureComex && crmSections.includes(section)) {
      setSection("comex");
    }
    // Agência can access marketing routes + their own profile (settings).
    // "central-bugs" entrou em 02/09/2026: o menu da agência nunca teve o
    // item, mas a rota não era barrada — digitando /central-bugs na URL, um
    // parceiro externo abria a Central de Bugs inteira. Achado da revisão de
    // segurança; o menu esconder não é o mesmo que a rota negar.
    const agenciaBlocked = ["crm", "posvenda", "signals", "explorer", "crm-viagens", "commercial-overview", "abm", "marketing-despesas", "marketing-compras", "marketing-tarefas", "dashboard", "tutorials", "central-bugs"];
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
    // Página desligada pela chave global: vale até pra Agência/Portal, que
    // não passam pelo registro de módulos mas também não podem ficar dentro
    // de uma tela que foi tirada do ar.
    if ((isAgencia || isPortalOnly) && (moduleStates[section] || "live") === "off") {
      setSection("dashboard");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, isManager, isRHManager, canSeeExecutive, isInsightsUser, canSeeMarketIntel, isMarketingUser, isPureMarketing, isAgencia, isRHUser, isPureRH, isPortalOnly, section, allowedModules, moduleStates]);

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

  // Convite não dispara PASSWORD_RECOVERY (só "type=recovery" faz isso) — sem
  // isto, quem aceita convite era autenticado em silêncio e caía direto no
  // painel de trabalho sem nunca definir senha (achado real, reportado pelo
  // Daniel: "eles não sabem o que fazer depois" de clicar no e-mail).
  if (supabaseEnabled && isInviteAcceptance) {
    return <PasswordResetScreen onReset={resetPasswordWithToken} variant="invite" />;
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
    currentUser.role === "vendedor" &&
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
        isAdmin={isAdmin}
        onLogout={handleLogout}
        mobileOpen={sidebarMobileOpen}
        onMobileClose={() => setSidebarMobileOpen(false)}
        onNewLead={() => { setSection("crm"); navigate(ROUTES.crm); setCrmAutoCreate(true); }}
        forceExpanded={onboardingTour.active}
        moduleStates={moduleStates}
      />

      <div className="flex flex-col min-w-0 app-content-shell" style={{ minHeight: "100vh", overflowX: "clip" }}>
        <TopBar
          title={sectionTitle}
          onReportBug={() => setBugReport({ origem: "atalho", erro: null })}
          onMenuToggle={() => setSidebarMobileOpen(v => !v)}
          onSearchOpen={() => setCmdOpen(true)}
          searchPlaceholder={searchPlaceholder}
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

        <OfflineBanner isOnline={isOnline} cacheAge={cacheAge} />

        <div className="px-4 py-4 sm:px-6 sm:py-6 lg:py-6 pb-24 lg:pb-6 flex-1 min-w-0">
        {isModuleInTest(section, moduleStates) && (
          // Página em teste: quem chegou aqui é admin ou testador marcado à
          // mão. A tarja existe pra ninguém reportar como bug algo que já se
          // sabe incompleto — nem tomar decisão com base num número que
          // ainda não é confiável.
          <div
            className="mb-4 rounded-lg border px-3.5 py-2.5 flex items-start gap-2.5"
            style={{ background: "var(--warning-bg)", borderColor: "color-mix(in srgb, var(--warning) 35%, transparent)" }}
          >
            <FlaskConical size={15} style={{ color: "var(--warning)", flex: "none", marginTop: 1 }} />
            <div className="text-xs leading-relaxed" style={{ color: "var(--warning)" }}>
              <strong style={{ fontWeight: 700 }}>
                {MODULE_LABELS[section] || "Esta página"} está em teste.
              </strong>{" "}
              Ainda não aparece para a equipe. Os dados podem estar incompletos.
            </div>
          </div>
        )}
        <PageDescriptionProvider value={pageDescriptionCtx}>
        <ErrorBoundary
          fallback={({ error, reset }) => (
            <div className="rounded-xl border p-6 max-w-2xl mx-auto mt-8" style={{ background: "var(--danger-bg)", borderColor: "color-mix(in srgb, var(--danger) 35%, transparent)" }}>
              <div className="font-bold text-base mb-2" style={{ color: "var(--danger)" }}>
                Erro ao carregar esta tela
              </div>
              <div className="text-xs mb-3" style={{ color: "var(--danger)" }}>
                Algo travou no carregamento. Tente voltar ao Início ou recarregar a página.
              </div>
              <div className="text-[11px] font-mono p-2 rounded mb-3" style={{ background: "var(--surface)", color: "var(--danger)", whiteSpace: "pre-wrap", maxHeight: 160, overflow: "auto" }}>
                {error?.message || String(error)}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setBugReport({ origem: "tela-de-erro", erro: error })}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg"
                        style={{ background: "var(--danger)", color: "#fff", border: "none" }}>
                  Reportar isso
                </button>
                <button onClick={() => { setSection("dashboard"); reset(); }}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg"
                        style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
                  Voltar ao Início
                </button>
                <button onClick={() => window.location.reload()}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border"
                        style={{ borderColor: "var(--border-strong)", color: "var(--text)", background: "var(--surface)" }}>
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
                onOpenPending={handleOpenPendingTask}
                personalTasksEnabled={Boolean(settings.personalTasksEnabled)}
              />
            )
          } />
          {/* Chat é acessível a qualquer papel interno — inclusive portal-only
              (chão de fábrica). Agência fica de fora: é fornecedor externo, e
              a própria regra de DM no banco (chat_can_dm) já a exclui.
              chatEnabled === false: usuário desativado pelo admin (10/08/2026)
              — enforcement real já é na RLS (chat_is_member), este guard só
              evita a tela renderizar vazia/quebrada pra quem digitar a URL
              direto sem o item de menu visível. */}
          <Route path={ROUTES.chat} element={
            isAgencia
              ? <Navigate to={ROUTES.marketing} replace />
              : currentUser?.chatEnabled === false
              ? <Navigate to={ROUTES.dashboard} replace />
              : (
                <ChatView
                  currentUser={currentUser}
                  initialChannelId={selectedChatChannelId}
                  onInitialChannelConsumed={() => setSelectedChatChannelId(null)}
                />
              )
          } />
          {/* Lista Pessoal: a rota em si não checa o opt-in
              (settings.personalTasksEnabled) — só o item de menu depende
              dele. Digitar a URL direto com a feature desligada não expõe
              nada: personal_tasks é protegida por RLS (só o dono da linha
              lê/escreve), então a tela renderiza vazia igual a qualquer
              outra tela nova sem dado ainda. Mesmo critério do Chat acima
              pra excluir Agência (fornecedor externo, escopo restrito). */}
          <Route path={ROUTES["personal-tasks"]} element={
            isAgencia
              ? <Navigate to={ROUTES.marketing} replace />
              : <PersonalTasksView currentUser={currentUser} />
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
                />
              )
          } />
          <Route path={ROUTES.signals} element={
            isAgencia ? <Navigate to={ROUTES.marketing} replace /> : isPureRH ? <Navigate to={ROUTES.dashboard} replace /> : (
              <SignalsView
                activeCompany={activeCompany}
                signals={signals}
                clients={clients}
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
                    campaigns={campaigns}
                    clients={clients}
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
              onDuplicateLead={handleDuplicateLead}
              onStarToggle={toggleStar}
              pipelineTransitions={pipelineTransitions}
              clients={clients}
              onCreateClient={createClient}
              onCreateClientContact={createClientContact}
              autoOpenCreate={crmAutoCreate}
              onAutoOpenHandled={() => setCrmAutoCreate(false)}
              onOpenImport={isManager ? () => setClientImportOpen(true) : undefined}
              onReplacePipeline={replacePipeline}
              onResetPipeline={resetCompanyPipeline}
              onUpdateStage={updateStage}
              campaigns={campaigns}
            />
          } />
          <Route path={ROUTES["document-library"]} element={
            isAgencia ? <Navigate to={ROUTES.marketing} replace /> : isPureRH ? <Navigate to={ROUTES.dashboard} replace /> : (
              <DocumentLibraryView user={currentUser} canManage={isManager} />
            )
          } />
          <Route path={ROUTES.posvenda} element={
            isAgencia ? <Navigate to={ROUTES.marketing} replace /> : isPureRH ? <Navigate to={ROUTES.dashboard} replace /> : <PosVendaView
              user={currentUser}
              activeCompany={activeCompany}
              accessibleCompanies={accessibleCompanies}
              onCompanyChange={setActiveCompany}
              leads={leads}
              users={users}
              clients={clients}
              onCreateClient={createClient}
              onOpenLead={setSelectedLead}
              initialSelectedCaseId={selectedPosvendaCaseId}
              onInitialCaseConsumed={() => setSelectedPosvendaCaseId(null)}
            />
          } />
          <Route path={ROUTES["crm-viagens"]} element={
            isAgencia || isPureMarketing || isPureRH
              ? <Navigate to={ROUTES.dashboard} replace />
              : (
                <CRMViagensView
                  currentUser={currentUser}
                  clients={clients}
                  onCreateClient={createClient}
                  users={users}
                  pushNotification={pushNotification}
                  initialSelectedViagemId={selectedViagemId}
                  onInitialViagemConsumed={() => setSelectedViagemId(null)}
                />
              )
          } />
          <Route path={ROUTES.pedidos} element={
            isAgencia || isPureMarketing || isPureRH
              ? <Navigate to={ROUTES.dashboard} replace />
              : (
                <PedidosView
                  clients={clients}
                  users={users}
                  accessibleCompanies={accessibleCompanies}
                  /* Conferir, lançar no Kronosys e mover status é operação —
                     suporte, vendedor, gerente ou admin. */
                  canOperate={hasAnyRole(["suporte", "vendedor", "gerente", "admin"])}
                  currentUser={currentUser}
                />
              )
          } />
          <Route path={ROUTES.catalogo} element={
            /* Marketing NÃO é barrado aqui: mantém a metade vitrine do
               produto, que é o que o portal mostra pro cliente. */
            isAgencia || isPureRH
              ? <Navigate to={ROUTES.dashboard} replace />
              : (
                <CatalogoView
                  activeCompany={activeCompany}
                  accessibleCompanies={accessibleCompanies}
                  /* Quem mantém o catálogo e o preço de tabela: suporte
                     comercial, gerente ou admin — mesma regra do RLS em
                     products_write. Vendedor lê pra calcular margem. */
                  canEdit={hasAnyRole(["suporte", "gerente", "admin"])}
                  canEditRules={hasAnyRole(["gerente", "admin"])}
                  /* Vitrine é do Marketing — o trigger no banco congela o
                     lado de lá pra quem não é, isto aqui só evita digitar
                     algo que seria descartado em silêncio. */
                  canEditVitrine={hasAnyRole(["marketing", "gerente_marketing", "gerente", "admin"])}
                />
              )
          } />
          <Route path={ROUTES.clients} element={
            isAgencia || isPureMarketing || isPureRH
              ? <Navigate to={ROUTES.dashboard} replace />
              : (
                <ClientsManager
                  clients={clients}
                  loading={clientsLoading}
                  initialSelectedClientId={selectedClientId}
                  onInitialClientConsumed={() => setSelectedClientId(null)}
                  leads={leads}
                  onCreate={createClient}
                  onUpdate={updateClient}
                  onDelete={deleteClient}
                  canDelete={isManager}
                  onOpenImport={isManager ? () => setClientRosterImportOpen(true) : undefined}
                  onOpenLead={setSelectedLead}
                  onOpenViagem={(id) => { setSection("crm-viagens"); setSelectedViagemId(id); }}
                  /* Liberar produto com preço é ato de negociação — vendedor,
                     gerente ou admin. Suporte vê a aba, mas em leitura: o
                     preço do cliente não é dele (ver RLS de client_products). */
                  canReleaseProducts={hasAnyRole(["vendedor", "gerente", "admin"])}
                  /* Só quem vende pode ser dono de conta — o campo não deve
                     oferecer marketing, RH ou suporte. */
                  vendedores={users.filter(u => (u.roles || []).some(r => ["vendedor", "gerente"].includes(r)))}
                  /* Ata de visita por voz na aba Histórico (4.54.x) — onCreateLead
                     é o handleAddLead (dispara automações lead_created como
                     qualquer negócio novo); onUpdateLead é o `updateLead` local
                     (com automações field_value), não o updateLeadRemote cru. */
                  currentUser={currentUser}
                  onCreateLead={handleAddLead}
                  onAddLeadActivity={addLeadActivity}
                  onUpdateLead={updateLead}
                />
              )
          } />
          <Route path={ROUTES.abm} element={
            isAgencia || isPureMarketing || isPureRH
              ? <Navigate to={ROUTES.dashboard} replace />
              : (
                <AbmAccountsView
                  user={currentUser}
                  leads={leads}
                  campaigns={campaigns}
                  clients={clients}
                  users={users}
                  activeCompany={activeCompany}
                  onLeadClick={setSelectedLead}
                  onOpenClient={(id) => { setSection("clients"); setSelectedClientId(id); }}
                />
              )
          } />
          <Route path={ROUTES["central-bugs"]} element={
            <BugsView currentUser={currentUser} isAdmin={isAdmin} />
          } />
          <Route path={ROUTES.agents} element={
            (isManager || isRHManager)
              ? <AgentActionsView currentUser={currentUser} activeCompany={activeCompany} automations={automations} />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          {/* fair-import is now a tab inside ExplorerView */}
          <Route path={ROUTES["fair-import"]} element={
            <Navigate to={ROUTES.explorer} replace />
          } />
          <Route path={ROUTES.executive} element={
            canSeeExecutive
              ? <ExecutiveDashboard leads={leads} crossReferrals={crossReferrals} pipelines={pipelines} users={users} currentUser={currentUser} activeCompany={activeCompany} visibleWidgets={settings.visibleExecutiveWidgets} isAdmin={isAdmin} isMarketingManager={isMarketingManager || isDiretoria} isRHManager={isRHManager || isDiretoria} isComercialManager={isManager || isDiretoria} isComexManager={isComex || isDiretoria} isEsgViewer={isManager || isDiretoria} />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES["esg-carbono"]} element={
            (isManager || isDiretoria)
              ? <ESGCarbonoView currentUser={currentUser} />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          {/* InsightsView virou a aba "Insights" do hub abaixo — mesmo padrão
              de /presidencia/-funnel-history logo adiante: link antigo
              continua funcionando, só aponta pro endereço novo. */}
          <Route path={ROUTES.insights} element={<Navigate to={ROUTES["market-intel"]} replace />} />
          <Route path={ROUTES["market-intel"]} element={
            canSeeMarketIntel
              ? <MarketIntelligenceView leads={leads} pipelines={pipelines} canSeeDeepIntel={canSeeDeepMarketIntel} />
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
              "Editar etapas" dentro do próprio Kanban do Funil de Vendas. Redireciona
              quem tem o link salvo. */}
          <Route path={ROUTES["pipeline-builder"]} element={<Navigate to={ROUTES.crm} replace />} />
          <Route path={ROUTES.automations} element={
            (isManager || isRHManager) ? (
              <AutomationsView
                leads={leads}
                pipelines={pipelines}
                activeCompany={activeCompany}
                currentUser={currentUser}
                onNavigate={setSection}
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
          <Route path={ROUTES.comex} element={
            (isComex || isDiretoria)
              ? <ComexView currentUser={currentUser} users={users} canWrite={isComex} notifyMentions={notifyMentions} />
              : <Navigate to={ROUTES.dashboard} replace />
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
              isComexManager={isComex || isDiretoria}
              isAdmin={isAdmin}
              roles={currentUserRoles}
              navGroups={navGroups}
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
            <TutoriaisView currentUser={currentUser} onNavigate={setSection} initialTab={tutoriaisInitialTab} />
          } />
          <Route path={ROUTES["marketing-home"]} element={
            (isMarketingUser || isDiretoria)
              ? <MarketingDashboardView user={currentUser} />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES.marketing} element={
            (isMarketingUser || isAgencia || isDiretoria)
              ? <MarketingView
                  user={currentUser}
                  users={users}
                  evaluateAutomations={evaluateAutomations}
                  pushNotification={pushNotification}
                  notifyMentions={notifyMentions}
                  initialSelectedCampaignId={selectedCampaignId}
                  onInitialCampaignConsumed={() => setSelectedCampaignId(null)}
                />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES["marketing-entregas"]} element={
            (isMarketingUser || isAgencia || isDiretoria)
              ? <EntregasView
                  user={currentUser} users={users} notifyMentions={notifyMentions}
                  initialSelectedDeliverableId={selectedDeliverableId}
                  onInitialDeliverableConsumed={() => setSelectedDeliverableId(null)}
                />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          {/* Sem isAgencia aqui (ao contrário de marketing-entregas) — pedido
              explícito: board de tarefas do dia a dia, separado do que a
              Agência acompanha em Entregas. RLS de marketing_tasks já barra
              agência no SELECT; isto barra a rota também. */}
          <Route path={ROUTES["marketing-tarefas"]} element={
            ((isMarketingUser && !isAgencia) || isDiretoria)
              ? <MarketingTarefasView user={currentUser} users={users} notifyMentions={notifyMentions} />
              : <Navigate to={ROUTES.marketing} replace />
          } />
          <Route path={ROUTES["marketing-feiras"]} element={
            ((isMarketingUser && !isAgencia) || isDiretoria)
              ? <FairReportView
                  user={currentUser}
                  campaigns={campaigns}
                  leads={leads}
                  activeCompany={activeCompany}
                />
              : <Navigate to={ROUTES.marketing} replace />
          } />
          <Route path={ROUTES["marketing-conteudo"]} element={
            ((isMarketingUser && !isAgencia) || isDiretoria)
              ? <ContentReportView
                  user={currentUser}
                  campaigns={campaigns}
                  leads={leads}
                  activeCompany={activeCompany}
                />
              : <Navigate to={ROUTES.marketing} replace />
          } />
          <Route path={ROUTES["marketing-despesas"]} element={
            ((isMarketingUser && !isAgencia) || isDiretoria)
              ? <DespesasView user={currentUser} users={users} campaigns={campaigns} />
              : <Navigate to={ROUTES.marketing} replace />
          } />
          <Route path={ROUTES["marketing-solicitacoes"]} element={
            ((isMarketingUser && !isAgencia) || isDiretoria)
              ? <MarketingRequestsView
                  user={currentUser}
                  users={users}
                  initialExpandedRequestId={expandedMarketingRequestId}
                  onInitialRequestConsumed={() => setExpandedMarketingRequestId(null)}
                />
              : <Navigate to={ROUTES.marketing} replace />
          } />
          <Route path={ROUTES["marketing-fornecedores"]} element={
            ((isMarketingUser && !isAgencia) || isDiretoria)
              ? <FornecedoresView user={currentUser} />
              : <Navigate to={ROUTES.marketing} replace />
          } />
          <Route path={ROUTES["marketing-compras"]} element={
            ((isMarketingUser && !isAgencia) || isDiretoria)
              ? <ComprasMarketingView
                  user={currentUser} users={users} notifyMentions={notifyMentions}
                  initialSelectedPurchaseId={selectedPurchaseRequestId}
                  onInitialPurchaseConsumed={() => setSelectedPurchaseRequestId(null)}
                />
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
                  onDeleteUser={supabaseEnabled ? deleteUser : undefined}
                  canWrite={isRHManager}
                  initialSelectedEmployeeId={selectedEmployeeId}
                  onInitialEmployeeConsumed={() => setSelectedEmployeeId(null)}
                  onOpenAvaliacao={(id) => { setSection("rh-feedback"); setSelectedAvaliacaoId(id); }}
                  onOpenMovimentacao={(id) => { setSection("rh-cargos"); setSelectedMovimentacaoId(id); }}
                  onOpenTreinamento={(id) => { setSection("rh-treinamentos"); setSelectedTreinamentoAtribuicaoId(id); }}
                  onOpenFerias={(id) => { setSection("rh-ferias"); setSelectedFeriasId(id); }}
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
                  initialSelectedVagaId={selectedVagaId}
                  onInitialVagaConsumed={() => setSelectedVagaId(null)}
                />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES["rh-onboarding"]} element={
            <RHOnboardingView currentUser={currentUser} canWrite={isRHManager} isRHUser={isRHUser || isDiretoria} notifyMentions={notifyMentions} />
          } />
          <Route path={ROUTES["rh-treinamentos"]} element={
            <RHTreinamentosView
              currentUser={currentUser}
              canWrite={isRHManager}
              isRHUser={isRHUser || isDiretoria}
              users={users}
              notifyMentions={notifyMentions}
              initialSelectedTreinamentoAtribuicaoId={selectedTreinamentoAtribuicaoId}
              onInitialTreinamentoAtribuicaoConsumed={() => setSelectedTreinamentoAtribuicaoId(null)}
            />
          } />
          <Route path={ROUTES["rh-feedback"]} element={
            <RHFeedbackView
              currentUser={currentUser}
              canWrite={isRHManager}
              isRHUser={isRHUser || isDiretoria}
              notifyMentions={notifyMentions}
              initialSelectedAvaliacaoId={selectedAvaliacaoId}
              onInitialAvaliacaoConsumed={() => setSelectedAvaliacaoId(null)}
            />
          } />
          <Route path={ROUTES["rh-ferias"]} element={
            (isRHUser || isDiretoria)
              ? <RHFeriasView
                  currentUser={currentUser}
                  users={users}
                  canWrite={isRHManager}
                  notifyMentions={notifyMentions}
                  initialSelectedFeriasId={selectedFeriasId}
                  onInitialFeriasConsumed={() => setSelectedFeriasId(null)}
                />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES["rh-cargos"]} element={
            (isRHManager || isDiretoria)
              ? <RHCargosView
                  currentUser={currentUser}
                  canWrite={isRHManager}
                  isDirector={isAdmin}
                  users={users}
                  notifyMentions={notifyMentions}
                  initialSelectedMovimentacaoId={selectedMovimentacaoId}
                  onInitialMovimentacaoConsumed={() => setSelectedMovimentacaoId(null)}
                />
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
            <MeuRHView
              currentUser={currentUser}
              notifyMentions={notifyMentions}
              notifications={serverNotifications}
              markNotificationRead={markServerNotificationRead}
              isPortalOnly={isPortalOnly}
            />
          } />
          <Route path={ROUTES.profile} element={<Navigate to={ROUTES.settings} replace />} />
          {/* N-02 da auditoria funcional (19/08/2026): antes redirecionava em
              silêncio pro Início — mockup aprovado 20/08/2026, mostra o
              estado dentro do próprio shell (sidebar/topbar continuam). */}
          <Route path="*" element={<NotFoundView onBack={() => setSection("dashboard")} />} />
        </Routes>
        </ErrorBoundary>
        </PageDescriptionProvider>
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

      <ErrorBoundary onReport={(erro) => setBugReport({ origem: "tela-de-erro", erro })}>
        <LeadDetailDrawer
          lead={selectedLead}
          campaigns={campaigns}
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
          onEditFields={() => { closeDrawer(); setSection("crm"); }}
          notifyMentions={notifyMentions}
          pipelineTransitions={pipelineTransitions}
          offlineStatusById={offlineStatusByActivityId}
          onRetryOfflineActivity={retryOfflineActivity}
        />
      </ErrorBoundary>

      {showOnboarding && (
        <OnboardingModal currentUser={currentUser} onDone={dismissOnboarding} />
      )}

      {needRefresh && (
        <AppToast
          icon={RefreshCw}
          iconBadge
          title="Nova versão disponível"
          description="Melhorias e correções prontas."
          onDismiss={dismissAppUpdate}
          action={{ label: "Atualizar agora", onClick: updateNow, solid: true, icon: RefreshCw }}
        />
      )}

      {agentsCoachmarkVisible && (
        <AgentsSidebarCoachmark visible={agentsCoachmarkVisible} onDismiss={dismissAgentsCoachmark} />
      )}

      {offlineSyncMessage && !needRefresh && !agentsCoachmarkVisible && (
        <AppToast title={offlineSyncMessage} onDismiss={dismissOfflineSyncMessage} />
      )}

      {!needRefresh && !agentsCoachmarkVisible && changelogItems.length > 0 && (
        <ChangelogToast
          items={changelogItems}
          onDismiss={dismissChangelog}
          onViewAll={() => { setTutoriaisInitialTab("novidades"); setSection("tutorials"); dismissChangelog(); }}
        />
      )}

      {screenTip && (
        <AppToast title={`${screenTip.icon} ${sectionTitle}`} onDismiss={dismissScreenTip}>
          <ol className="list-decimal pl-4 space-y-0.5">
            {screenTip.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </AppToast>
      )}

      <FeatureSpotlight spotlight={featureSpotlight} onDismiss={dismissFeatureSpotlight} />
      <OnboardingTour tour={onboardingTour} />

      {chatToast && !needRefresh && !agentsCoachmarkVisible && !screenTip && (
        <AppToast
          icon={MessageSquareText}
          iconBadge
          title={chatToast.channelName}
          description={`${chatToast.senderName ? `${chatToast.senderName}: ` : ""}${(chatToast.preview || "").slice(0, 90)}`}
          onDismiss={() => setChatToast(null)}
          action={{ label: "Abrir", onClick: handleOpenChatToast }}
        />
      )}

      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        /* leads/clients/campaigns/deliverables/employees — ver `searchScopes`
           lá em cima, que é onde o escopo por cargo é decidido. */
        {...searchScopes}
        users={users}
        pipelines={pipelines}
        onSelectLead={(lead) => { setSelectedLead(lead); setCmdOpen(false); }}
        onSelectClient={(client) => { setSection("clients"); setSelectedClientId(client.id); setCmdOpen(false); }}
        onSelectCampaign={(campaign) => { setSection("marketing"); setSelectedCampaignId(campaign.id); setCmdOpen(false); }}
        onSelectDeliverable={(d) => { setSection("marketing-entregas"); setSelectedDeliverableId(d.id); setCmdOpen(false); }}
        onSelectEmployee={(employee) => { setSection("rh-funcionarios"); setSelectedEmployeeId(employee.id); setCmdOpen(false); }}
      />

      <ImportModal
        isOpen={clientImportOpen}
        onClose={() => setClientImportOpen(false)}
        users={users}
        currentUser={currentUser}
        onAddLead={handleAddLead}
        companies={accessibleCompanies || []}
      />

      <ClientImportModal
        isOpen={clientRosterImportOpen}
        onClose={() => setClientRosterImportOpen(false)}
        clients={clients}
        onCreateClient={createClient}
        onUpdateClient={updateClient}
        onUpsertBillingHistory={upsertClientBillingHistory}
      />

      {/* Montado aqui, no fim e FORA de qualquer ErrorBoundary de propósito:
          se ficasse dentro do boundary da tela, o modal morreria junto com a
          tela que quebrou — que é exatamente quando ele mais precisa existir. */}
      <ReportBugModal
        open={!!bugReport}
        onClose={() => setBugReport(null)}
        onSubmit={criarBugReport}
        rota={section}
        empresa={activeCompany}
        erro={bugReport?.erro || null}
        origem={bugReport?.origem || "atalho"}
      />

    </div>
  );
}
