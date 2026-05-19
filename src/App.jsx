import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard, Bell, Globe2, Layers, BarChart3, Shuffle, UserCog,
  Settings as SettingsIcon, Bot, Presentation, GitBranch, Workflow, Zap,
} from "lucide-react";
import { COMPANIES, NEUTRAL } from "./constants/companies";
import { STORAGE_KEYS } from "./constants/storage-keys";
import { defaultPipelines } from "./constants/pipelines";
import { generateMarketSignals } from "./data/generate-signals";
import { usePersistentState } from "./hooks/use-persistent-state";
import { useCrossReferrals } from "./hooks/use-cross-referrals";
import { useUserSettings } from "./hooks/use-user-settings";
import { useSupabaseAuth } from "./hooks/use-supabase-auth";
import { useLeads } from "./hooks/use-leads";
import { useProfiles } from "./hooks/use-profiles";
import { usePipelineTransitions } from "./hooks/use-pipeline-transitions";
import { useAutomations } from "./hooks/use-automations";
import { LoginScreen } from "./components/shell/LoginScreen";
import { PendingAssignmentScreen } from "./components/shell/PendingAssignmentScreen";
import { AppHeader } from "./components/shell/AppHeader";
import { LeadDetailDrawer } from "./components/lead/LeadDetailDrawer";
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
  const [pipelines] = usePersistentState(STORAGE_KEYS.pipelines, defaultPipelines());

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
  const [section, setSection] = useState("dashboard");
  const [selectedLead, setSelectedLead] = useState(null);

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

  const navItems = useMemo(() => {
    const base = [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "signals", label: "Sinais", icon: Bell },
      { id: "explorer", label: "Explorador", icon: Globe2 },
      { id: "crm", label: "CRM", icon: Layers },
      { id: "agents", label: "Agentes", icon: Bot },
    ];
    if (isManager) {
      base.push(
        { id: "executive", label: "Executivo", icon: BarChart3 },
        { id: "crossref", label: "Cross-sell", icon: Shuffle },
        { id: "funnel-history", label: "Histórico", icon: GitBranch },
        { id: "pipeline-builder", label: "Pipeline", icon: Workflow },
        { id: "automations", label: "Automações", icon: Zap },
        { id: "fair-import", label: "Import Feira", icon: Presentation },
        { id: "users", label: "Usuários", icon: UserCog },
        { id: "settings", label: "Configurações", icon: SettingsIcon },
      );
    }
    return base;
  }, [isManager]);

  // Keep vendedor off restricted sections even if state was stale.
  useEffect(() => {
    const managerOnly = ["executive", "crossref", "funnel-history", "pipeline-builder", "automations", "fair-import", "users", "settings"];
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

  const activeCompanyData = COMPANIES[activeCompany];
  const accent = activeCompanyData?.primary || NEUTRAL.graphite;

  return (
    <div
      style={{
        background: NEUTRAL.warmWhite,
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
        color: NEUTRAL.graphite,
        minHeight: "100vh",
      }}
    >
      <div
        className="border-b sticky top-0 z-30 backdrop-blur-md"
        style={{
          background: "rgba(250,250,248,0.95)",
          borderColor: "#EFEFEF",
          borderBottomColor: accent + "30",
          borderBottomWidth: 2,
        }}
      >
        <AppHeader
          currentUser={currentUser}
          activeCompany={activeCompany}
          accessibleCompanies={accessibleCompanies}
          onCompanyChange={setActiveCompany}
          onLogout={handleLogout}
          navItems={navItems}
          section={section}
          onSectionChange={setSection}
          accent={accent}
        />
      </div>

      <div className="px-4 md:px-6 py-6 max-w-[1400px] mx-auto">
        {section === "dashboard" && (
          <DashboardView
            user={currentUser}
            activeCompany={activeCompany}
            leads={leads}
            signals={signals}
            onNavigate={setSection}
            onLeadClick={setSelectedLead}
            visibleWidgets={settings.visibleDashboardWidgets}
          />
        )}
        {section === "signals" && (
          <SignalsView activeCompany={activeCompany} signals={signals} />
        )}
        {section === "explorer" && (
          <ExplorerView
            user={currentUser}
            activeCompany={activeCompany}
            leads={leads}
            onLeadClick={setSelectedLead}
            onStarToggle={toggleStar}
            onLoadDemoLeads={loadDemoLeads}
            onGoToSettings={() => setSection("settings")}
            onAddLead={handleAddLead}
            accessibleCompanies={accessibleCompanies}
          />
        )}
        {section === "crm" && (
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
        )}
        {section === "agents" && (
          <AgentActionsView currentUser={currentUser} activeCompany={activeCompany} />
        )}
        {section === "fair-import" && isManager && (
          <FairImportView
            addLead={handleAddLead}
            leads={leads}
            users={users}
            currentUser={currentUser}
            state={fairImportState}
            setState={setFairImportState}
          />
        )}
        {section === "executive" && isManager && (
          <ExecutiveDashboard leads={leads} crossReferrals={crossReferrals} />
        )}
        {section === "funnel-history" && isManager && (
          <FunnelHistoryView
            user={currentUser}
            activeCompany={activeCompany}
            leads={leads}
            users={users}
          />
        )}
        {section === "pipeline-builder" && isManager && (
          <PipelineBuilderView
            pipelines={pipelines}
            transitions={pipelineTransitions}
            accessibleCompanies={accessibleCompanies}
          />
        )}
        {section === "automations" && isManager && (
          <AutomationsView
            leads={leads}
            pipelines={pipelines}
            activeCompany={activeCompany}
          />
        )}
        {section === "crossref" && isManager && (
          <CrossReferralsView
            crossReferrals={crossReferrals}
            users={users}
            onApprove={approveCross}
            onReject={rejectCross}
          />
        )}
        {section === "users" && isManager && (
          <UserManagementView
            users={users}
            onUsersChange={setUsers}
            onUpdateUser={supabaseEnabled ? updateUser : undefined}
            onDeleteUser={supabaseEnabled ? deleteUser : undefined}
            supabaseEnabled={supabaseEnabled}
            loading={usersLoading}
            currentUser={currentUser}
          />
        )}
        {section === "settings" && isManager && (
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
        )}
      </div>


      <LeadDetailDrawer
        lead={selectedLead}
        onClose={closeDrawer}
        onUpdate={updateLead}
        allLeads={leads}
        users={users}
        isManager={isManager}
        currentUser={currentUser}
      />

      <footer
        className="px-4 md:px-6 py-5 border-t text-xs flex items-center justify-between flex-wrap gap-2"
        style={{ background: NEUTRAL.warmWhite, borderColor: "#EFEFEF", color: NEUTRAL.slate }}
      >
        <div className="font-medium" style={{ letterSpacing: "0.01em" }}>
          Grupo Sanwey · Commercial Intelligence v4.0
        </div>
        <div style={{ color: NEUTRAL.slate }}>
          Abril 2026
        </div>
      </footer>
    </div>
  );
}
