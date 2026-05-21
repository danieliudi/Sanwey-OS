import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Bell, Globe2, Layers, BarChart3, Shuffle, UserCog,
  Settings as SettingsIcon, Bot, Presentation, GitBranch, Workflow, Zap,
  Briefcase, Brain, Sliders,
} from "lucide-react";
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
import { useProfiles } from "./hooks/use-profiles";
import { useInvitations } from "./hooks/use-invitations";
import { usePipelineTransitions } from "./hooks/use-pipeline-transitions";
import { useAutomations } from "./hooks/use-automations";
import { LoginScreen } from "./components/shell/LoginScreen";
import { PendingAssignmentScreen } from "./components/shell/PendingAssignmentScreen";
import { Sidebar } from "./components/shell/Sidebar";
import { TopBar } from "./components/shell/TopBar";
import { LeadDetailDrawer } from "./components/lead/LeadDetailDrawer";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { DashboardView } from "./components/views/DashboardView";
import { SignalsView } from "./components/views/SignalsView";
import { ExplorerView } from "./components/views/ExplorerView";
import { CRMView } from "./components/views/CRMView";
import { ExecutiveDashboard } from "./components/views/ExecutiveDashboard";
import { CrossReferralsView } from "./components/views/CrossReferralsView";
import { UserManagementView } from "./components/views/UserManagementView";
import { SettingsView } from "./components/views/SettingsView";
import { AgentActionsView } from "./components/views/AgentActionsView";
import { FairImportView } from "./components/views/FairImportView";
import { FunnelHistoryView } from "./components/views/FunnelHistoryView";
import { PipelineBuilderView } from "./components/views/PipelineBuilderView";
import { AutomationsView } from "./components/views/AutomationsView";

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
    refreshProfile,
    configured: supabaseEnabled,
  } = useSupabaseAuth();

  const [mockUser, setMockUser] = usePersistentState(STORAGE_KEYS.currentUser, null);
  const currentUser = supabaseEnabled ? supaUser : mockUser;

  const isManagerRole = currentUser?.role === "gerente" || currentUser?.role === "admin";
  const {
    users,
    loading: usersLoading,
    updateUser,
    deleteUser,
    setFallbackUsers: setUsers,
  } = useProfiles({ enabled: Boolean(currentUser) && (supabaseEnabled ? isManagerRole : true) });
  const {
    invitations,
    loading: invitationsLoading,
    createInvitation,
    revokeInvitation,
  } = useInvitations({ enabled: Boolean(currentUser) && supabaseEnabled && isManagerRole });
  const { pipelines, updateStage, reorderStages, resetCompanyPipeline, replacePipeline } = usePipelines();

  const {
    leads,
    addLead,
    updateLead: updateLeadRemote,
    toggleStar,
    changeStage,
    loadDemoLeads,
    clearAllLeads: clearAllLeadsRemote,
  } = useLeads({
    userId: currentUser?.id,
    role: currentUser?.role,
    companies: currentUser?.companies,
  });

  // Signals are purely derived from the current date — no need to persist.
  const [signals] = useState(INITIAL_SIGNALS);

  const { crossReferrals, approve: approveCross, reject: rejectCross } = useCrossReferrals(leads);
  const { settings, update: updateSettings, reset: resetSettings } = useUserSettings();
  const pipelineTransitions = usePipelineTransitions();
  const { evaluateAutomations } = useAutomations();

  const [activeCompany, setActiveCompany] = useState("all");
  const [selectedLead, setSelectedLead] = useState(null);

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
    if (!fresh) return;
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
    else setActiveCompany(u.companies[0] || "all");
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
    setSelectedLead(prev => (prev && prev.id === id ? { ...prev, ...patch } : prev));
    await updateLeadRemote(id, patch);
  }, [updateLeadRemote]);

  const handleStageChange = useCallback(async (id, stage) => {
    const prev = leads.find(l => l.id === id);
    await changeStage(id, stage);
    // Run automation rules for stage_change event (non-blocking)
    if (prev && prev.stage !== stage) {
      const updated = { ...prev, stage, stageChangedAt: new Date().toISOString() };
      const { patches } = evaluateAutomations(updated, prev, "stage_change");
      for (const p of patches) {
        await updateLeadRemote(p.leadId, p.patch).catch(() => {});
      }
    }
  }, [changeStage, leads, evaluateAutomations, updateLeadRemote]);

  // Wrapped addLead that fires lead_created automations after creation
  const handleAddLead = useCallback(async (lead) => {
    await addLead(lead);
    const { patches } = evaluateAutomations(lead, null, "lead_created");
    for (const p of patches) {
      await updateLeadRemote(p.leadId, p.patch).catch(() => {});
    }
  }, [addLead, evaluateAutomations, updateLeadRemote]);

  const closeDrawer = useCallback(() => setSelectedLead(null), []);

  const isManager = isManagerRole;

  // Respects settings.enabledCompanies — the user can toggle a company off from
  // the Settings view without deleting data or editing code.
  const accessibleCompanies = useMemo(() => {
    if (!currentUser) return [];
    const enabled = new Set(settings.enabledCompanies);
    const base = isManager
      ? ["industria", "resibag", "montemor"]
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
    const groups = [
      {
        label: null,
        items: [
          { id: "dashboard", label: "Início", icon: LayoutDashboard },
        ],
      },
      {
        label: "CRM",
        icon: Briefcase,
        items: [
          { id: "crm",       label: "Negócios",   icon: Layers },
          { id: "signals",   label: "Sinais",     icon: Bell },
          { id: "explorer",  label: "Explorador", icon: Globe2 },
          ...(isManager ? [{ id: "crossref", label: "Cross-sell", icon: Shuffle }] : []),
        ],
      },
    ];

    // Inteligência e Configuração só pra gerente/admin — vendedor só vê
    // Início e CRM.
    if (isManager) {
      groups.push({
        label: "Inteligência",
        icon: Brain,
        items: [
          { id: "executive",      label: "Executivo",          icon: BarChart3 },
          { id: "agents",         label: "Agentes",            icon: Bot },
          { id: "funnel-history", label: "Histórico do funil", icon: GitBranch },
        ],
      });

      groups.push({
        label: "Configuração",
        icon: Sliders,
        items: [
          { id: "pipeline-builder", label: "Construtor de pipeline", icon: Workflow },
          { id: "automations",      label: "Automações",              icon: Zap },
          { id: "fair-import",      label: "Importar feira",          icon: Presentation },
          { id: "users",            label: "Usuários",                icon: UserCog },
          { id: "settings",         label: "Configurações",           icon: SettingsIcon },
        ],
      });
    }
    return groups;
  }, [isManager]);

  // Title shown in the slim top bar, derived from the active section.
  const sectionTitle = useMemo(() => {
    for (const g of navGroups) {
      const hit = g.items.find(i => i.id === section);
      if (hit) return hit.label;
    }
    return "";
  }, [navGroups, section]);

  // Keep vendedor off restricted sections even if state was stale.
  useEffect(() => {
    const managerOnly = ["executive", "agents", "crossref", "funnel-history", "pipeline-builder", "automations", "fair-import", "users", "settings"];
    if (!isManager && managerOnly.includes(section)) {
      setSection("dashboard");
    }
  }, [isManager, section]);

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

  return (
    <div
      style={{
        background: "#F4F6FA",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
        color: NEUTRAL.graphite,
        minHeight: "100vh",
        display: "flex",
        alignItems: "stretch",
      }}
    >
      <Sidebar
        navGroups={navGroups}
        section={section}
        onSectionChange={setSection}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          title={sectionTitle}
          activeCompany={activeCompany}
          accessibleCompanies={accessibleCompanies}
          onCompanyChange={setActiveCompany}
        />

        <div className="px-6 py-6 flex-1 min-w-0">
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
                        style={{ background: "#1E4D8C", color: "#FFFFFF" }}>
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
            <DashboardView
              user={currentUser}
              activeCompany={activeCompany}
              leads={leads}
              users={users}
              signals={signals}
              pipelines={pipelines}
              onNavigate={setSection}
              onLeadClick={setSelectedLead}
              visibleWidgets={settings.visibleDashboardWidgets}
            />
          } />
          <Route path={ROUTES.signals} element={
            <SignalsView activeCompany={activeCompany} signals={signals} />
          } />
          <Route path={ROUTES.explorer} element={
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
            />
          } />
          <Route path={ROUTES.crm} element={
            <CRMView
              user={currentUser}
              activeCompany={activeCompany}
              leads={leads}
              pipelines={pipelines}
              users={users}
              onLeadClick={setSelectedLead}
              onStageChange={handleStageChange}
              onAddLead={handleAddLead}
              visibleStages={settings.visibleKanbanStages}
              pipelineTransitions={pipelineTransitions}
            />
          } />
          <Route path={ROUTES.agents} element={
            isManager
              ? <AgentActionsView currentUser={currentUser} activeCompany={activeCompany} />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          {/* Rotas gerente-only: vendedor é redirecionado pra Início. */}
          <Route path={ROUTES["fair-import"]} element={
            isManager ? (
              <FairImportView
                addLead={handleAddLead}
                leads={leads}
                users={users}
                currentUser={currentUser}
                state={fairImportState}
                setState={setFairImportState}
              />
            ) : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES.executive} element={
            isManager
              ? <ExecutiveDashboard leads={leads} crossReferrals={crossReferrals} pipelines={pipelines} users={users} />
              : <Navigate to={ROUTES.dashboard} replace />
          } />
          {/* Antiga rota /presidencia foi fundida no Executivo. Redireciona
              quem tem o link salvo. */}
          <Route path={ROUTES.presidency} element={<Navigate to={ROUTES.executive} replace />} />
          <Route path={ROUTES["funnel-history"]} element={
            isManager ? (
              <FunnelHistoryView
                user={currentUser}
                activeCompany={activeCompany}
                leads={leads}
                users={users}
              />
            ) : <Navigate to={ROUTES.dashboard} replace />
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
            isManager ? (
              <UserManagementView
                users={users}
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
              />
            ) : <Navigate to={ROUTES.dashboard} replace />
          } />
          <Route path={ROUTES.settings} element={
            isManager ? (
              <SettingsView
                settings={settings}
                onUpdate={updateSettings}
                onReset={resetSettings}
                onClearLocalData={clearLocalData}
                currentUser={currentUser}
                leadsCount={leads.length}
                onLoadDemoLeads={loadDemoLeads}
                onClearAllLeads={clearAllLeads}
              />
            ) : <Navigate to={ROUTES.dashboard} replace />
          } />
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
            Grupo Sanwey · Commercial Intelligence v4.0
          </div>
          <div style={{ color: NEUTRAL.slate }}>
            Maio 2026
          </div>
        </footer>
      </div>

      <ErrorBoundary>
        <LeadDetailDrawer
          lead={selectedLead}
          onClose={closeDrawer}
          onUpdate={updateLead}
          allLeads={leads}
          users={users}
          isManager={isManager}
          currentUser={currentUser}
        />
      </ErrorBoundary>
    </div>
  );
}
