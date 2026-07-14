import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  RotateCcw, Check, AlertTriangle, AlertCircle, Trash2, Database, Sparkles, Camera, Loader2,
  Bot, Key, Zap, ExternalLink, CheckCircle2, User, Bell, Sliders, Globe, X, UserCog, Link2, Copy, Users, Palette,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { supabase } from "../../lib/supabase";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import { AI_PROVIDERS, AI_PROVIDER_MAP } from "../../constants/ai-providers";
import { DEFAULT_PIPELINE_STAGES } from "../../constants/pipelines";
import {
  DASHBOARD_WIDGETS, EXECUTIVE_WIDGETS, NOTIFICATION_GROUPS,
} from "../../constants/user-settings";
import { Button } from "../ui/Button";

function Section({ title, description, children }) {
  return (
    <div
      className="p-5 rounded-xl border"
      style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="mb-4">
        <h2 className="font-semibold" style={{ fontSize: 15, color: "var(--text)" }}>
          {title}
        </h2>
        {description && (
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-dim)" }}>{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ checked, onChange, label, sublabel, disabled }) {
  return (
    <label
      className="flex items-center justify-between gap-3 py-2.5 cursor-pointer"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <div>
        <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</div>
        {sublabel && (
          <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>{sublabel}</div>
        )}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="w-4 h-4 cursor-pointer"
        style={{ accentColor: "var(--text)" }}
      />
    </label>
  );
}

const ROLE_LABEL = {
  admin:             "Administrador",
  gerente:           "Gerente Comercial",
  vendedor:          "Vendedor",
  consultor:         "Consultor",
  marketing:         "Marketing",
  gerente_marketing: "Gerente de Marketing",
  agencia:           "Agência",
};

const ACCENT_PRESETS = [
  { label: "Carvão",    value: "#37352F", hover: "#2A2925" },
  { label: "Vermelho",  value: "#C7212B", hover: "#8B1419" },
  { label: "Verde",     value: "#16A34A", hover: "#15803D" },
  { label: "Azul",      value: "#1D4ED8", hover: "#1E3A8A" },
  { label: "Roxo",      value: "#7C3AED", hover: "#6D28D9" },
  { label: "Laranja",   value: "#EA7309", hover: "#C25F00" },
  { label: "Rosa",      value: "#DB2777", hover: "#BE185D" },
];

function applyAccentGlobal(accent, hover) {
  const isDark = document.documentElement.dataset.theme === "dark";
  localStorage.setItem("sanwey-accent", accent);
  localStorage.setItem("sanwey-accent-hover", hover);
  if (!isDark) {
    document.documentElement.style.setProperty("--accent", accent);
    document.documentElement.style.setProperty("--accent-hover", hover);
  }
}

// Personal tabs available to every authenticated user.
const PERSONAL_TABS = [
  { id: "perfil",        label: "Perfil",          icon: User    },
  { id: "notificacoes", label: "Notificações",     icon: Bell    },
  { id: "ia",            label: "Integrações IA",  icon: Bot     },
  { id: "aparencia",     label: "Aparência",       icon: Palette },
];

// Manager-only tabs added on top of the personal ones.
const MANAGER_TABS = [
  { id: "preferencias", label: "Preferências",     icon: Sliders  },
  { id: "captura",       label: "Captura pública", icon: Link2    },
  { id: "dados",         label: "Dados",           icon: Database },
];

export function SettingsView({
  settings, onUpdate, onReset, onClearLocalData, currentUser,
  leadsCount = 0, onLoadDemoLeads, onClearAllLeads,
  onLoadAllDemoData, demoDataLoading = false, demoDataCounts = null,
  onUpdateUser, onUpdateAuthUser, onUpdateMockUser, supabaseEnabled,
  usersPanel, clientsPanel, onOpenClientImport, isManager = false,
}) {
  const [activeTab, setActiveTab] = useState("perfil");
  const tabs = useMemo(() => {
    if (!isManager) return PERSONAL_TABS;
    // Manager order: Perfil, Preferências, Notificações, IA, Clientes, Captura, Dados, Usuários
    const list = [
      PERSONAL_TABS[0],
      MANAGER_TABS[0],
      PERSONAL_TABS[1],
      PERSONAL_TABS[2],
    ];
    if (clientsPanel) list.push({ id: "clientes", label: "Clientes", icon: Users });
    list.push(MANAGER_TABS[1], MANAGER_TABS[2]);
    return usersPanel ? [...list, { id: "usuarios", label: "Usuários", icon: UserCog }] : list;
  }, [isManager, usersPanel, clientsPanel]);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearTyped, setClearTyped] = useState("");

  // ── Appearance / theme colors ────────────────────────────────────────
  const [accentColor, setAccentColor] = useState(
    () => localStorage.getItem("sanwey-accent") || "#37352F"
  );
  const [hoverColor, setHoverColor] = useState(
    () => localStorage.getItem("sanwey-accent-hover") || "#2A2925"
  );

  const handleAccentPreset = (preset) => {
    setAccentColor(preset.value);
    setHoverColor(preset.hover);
    applyAccentGlobal(preset.value, preset.hover);
  };

  const handleAccentInput = (color) => {
    setAccentColor(color);
    applyAccentGlobal(color, hoverColor);
  };

  const handleHoverInput = (color) => {
    setHoverColor(color);
    applyAccentGlobal(accentColor, color);
  };

  const handleResetAccent = () => {
    const def = ACCENT_PRESETS[0];
    setAccentColor(def.value);
    setHoverColor(def.hover);
    localStorage.removeItem("sanwey-accent");
    localStorage.removeItem("sanwey-accent-hover");
    document.documentElement.style.removeProperty("--accent");
    document.documentElement.style.removeProperty("--accent-hover");
  };

  // ── Profile form ────────────────────────────────────────────────────
  const [profileForm, setProfileForm] = useState({
    name: currentUser?.name || "",
    email: currentUser?.email || "",
    avatarUrl: currentUser?.avatarUrl || null,
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (currentUser) {
      setProfileForm(f => ({
        ...f,
        name: currentUser.name || "",
        email: currentUser.email || "",
        avatarUrl: currentUser.avatarUrl || null,
      }));
    }
  }, [currentUser?.id]);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setProfileFeedback({ type: "error", msg: "Imagem muito grande. Máximo 2 MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setProfileForm(f => ({ ...f, avatarUrl: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const handleProfileSave = async () => {
    if (!profileForm.name.trim()) {
      setProfileFeedback({ type: "error", msg: "Nome não pode ficar em branco." });
      return;
    }
    setProfileSaving(true);
    setProfileFeedback(null);
    try {
      const profilePatch = {
        name: profileForm.name.trim(),
        initials: profileForm.name.trim().slice(0, 2).toUpperCase(),
        avatarUrl: profileForm.avatarUrl || null,
      };
      if (onUpdateUser && currentUser?.id) {
        await onUpdateUser(currentUser.id, profilePatch);
      } else if (onUpdateMockUser) {
        onUpdateMockUser(u => ({ ...u, ...profilePatch }));
      }
      if (profileForm.email && profileForm.email !== currentUser?.email) {
        if (onUpdateAuthUser) {
          await onUpdateAuthUser({ email: profileForm.email });
        } else if (onUpdateMockUser) {
          onUpdateMockUser(u => ({ ...u, email: profileForm.email }));
        }
      }
      setProfileFeedback({ type: "success", msg: "Perfil atualizado com sucesso." });
    } catch (err) {
      setProfileFeedback({ type: "error", msg: err.message || "Erro ao salvar perfil." });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSave = async () => {
    setPasswordFeedback(null);
    if (passwordForm.newPassword.length < 6) {
      setPasswordFeedback({ type: "error", msg: "A senha deve ter pelo menos 6 caracteres." });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordFeedback({ type: "error", msg: "As senhas não coincidem." });
      return;
    }
    setPasswordSaving(true);
    try {
      if (onUpdateAuthUser) {
        await onUpdateAuthUser({ password: passwordForm.newPassword });
        setPasswordFeedback({ type: "success", msg: "Senha alterada com sucesso." });
        setPasswordForm({ newPassword: "", confirmPassword: "" });
      } else {
        setPasswordFeedback({ type: "error", msg: "Troca de senha requer Supabase configurado." });
      }
    } catch (err) {
      setPasswordFeedback({ type: "error", msg: err.message || "Erro ao alterar senha." });
    } finally {
      setPasswordSaving(false);
    }
  };

  // ── AI integration state ─────────────────────────────────────────────
  const [aiForm, setAiForm] = useState({
    provider: currentUser?.aiConfig?.provider || '',
    model: currentUser?.aiConfig?.model || '',
    apiKey: currentUser?.aiConfig?.apiKey || '',
  });
  const [aiKeyVisible, setAiKeyVisible] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiTestResult, setAiTestResult] = useState(null); // null | 'ok' | 'error'
  const [aiTestMsg, setAiTestMsg] = useState('');
  const [aiTesting, setAiTesting] = useState(false);

  useEffect(() => {
    if (currentUser?.aiConfig) {
      setAiForm({
        provider: currentUser.aiConfig.provider || '',
        model: currentUser.aiConfig.model || '',
        apiKey: currentUser.aiConfig.apiKey || '',
      });
    }
  }, [currentUser?.id]);

  const selectedProvider = AI_PROVIDER_MAP[aiForm.provider];

  const handleAiProviderChange = (providerId) => {
    const p = AI_PROVIDER_MAP[providerId];
    setAiForm(f => ({ ...f, provider: providerId, model: p?.models[0]?.id || '' }));
    setAiTestResult(null);
  };

  const [aiSaveFeedback, setAiSaveFeedback] = useState(null);

  const handleAiSave = async () => {
    if (!aiForm.provider || !aiForm.model || !aiForm.apiKey.trim()) return;
    setAiSaving(true);
    setAiSaveFeedback(null);
    try {
      const config = { provider: aiForm.provider, model: aiForm.model, apiKey: aiForm.apiKey.trim() };
      if (onUpdateUser && currentUser?.id) await onUpdateUser(currentUser.id, { aiConfig: config });
      if (onUpdateMockUser) onUpdateMockUser(u => ({ ...u, aiConfig: config }));
      setAiSaveFeedback({ type: "success", msg: "Configuração salva com sucesso." });
    } catch (err) {
      setAiSaveFeedback({ type: "error", msg: err.message || "Erro ao salvar configuração." });
    } finally {
      setAiSaving(false);
    }
  };

  const handleAiTest = async () => {
    if (!aiForm.provider || !aiForm.model || !aiForm.apiKey.trim()) return;
    setAiTesting(true);
    setAiTestResult(null);
    try {
      const config = { provider: aiForm.provider, model: aiForm.model, apiKey: aiForm.apiKey.trim() };
      const messages = [
        { role: 'user', content: 'Responda apenas: "Conexão OK"' }
      ];
      let text = '';
      if (config.provider === 'openai') {
        const r = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: config.model, messages, max_tokens: 20 }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error?.message || 'Erro');
        text = d.choices[0]?.message?.content || '';
      } else if (config.provider === 'gemini') {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Responda apenas: "Conexão OK"' }] }] }),
          }
        );
        const d = await r.json();
        if (!r.ok) throw new Error(d.error?.message || 'Erro');
        text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        // Anthropic passa pela edge function ai-assistant (a API key não
        // pode ir direto do browser pro provider — precisa de CORS
        // liberado, que só a function tem). Antes isso não chamava nada e
        // sempre reportava sucesso, mesmo com a function fora do ar.
        const { data, error } = await supabase.functions.invoke('ai-assistant', {
          body: { provider: config.provider, model: config.model, apiKey: config.apiKey, messages, maxTokens: 20 },
        });
        if (error) throw new Error(error.message || 'Erro ao chamar ai-assistant');
        if (data?.error) throw new Error(data.error);
        text = data?.content || '';
      }
      setAiTestResult('ok');
      setAiTestMsg(text.trim().slice(0, 80));
    } catch (e) {
      setAiTestResult('error');
      setAiTestMsg(e.message);
    } finally {
      setAiTesting(false);
    }
  };

  const handleAiDisconnect = async () => {
    setAiForm({ provider: '', model: '', apiKey: '' });
    setAiTestResult(null);
    if (onUpdateUser && currentUser?.id) await onUpdateUser(currentUser.id, { aiConfig: null });
    if (onUpdateMockUser) onUpdateMockUser(u => ({ ...u, aiConfig: null }));
  };

  // ── General settings callbacks ───────────────────────────────────────
  const toggleCompany = useCallback((id) => {
    const has = settings.enabledCompanies.includes(id);
    const next = has
      ? settings.enabledCompanies.filter(c => c !== id)
      : [...settings.enabledCompanies, id];
    if (next.length === 0) return;
    onUpdate({ enabledCompanies: next });
  }, [settings.enabledCompanies, onUpdate]);

  const toggleWidget = useCallback((id) => {
    const has = settings.visibleDashboardWidgets.includes(id);
    onUpdate({
      visibleDashboardWidgets: has
        ? settings.visibleDashboardWidgets.filter(w => w !== id)
        : [...settings.visibleDashboardWidgets, id],
    });
  }, [settings.visibleDashboardWidgets, onUpdate]);

  const toggleExecutiveWidget = useCallback((id) => {
    const has = settings.visibleExecutiveWidgets.includes(id);
    onUpdate({
      visibleExecutiveWidgets: has
        ? settings.visibleExecutiveWidgets.filter(w => w !== id)
        : [...settings.visibleExecutiveWidgets, id],
    });
  }, [settings.visibleExecutiveWidgets, onUpdate]);

  const toggleStage = useCallback((id) => {
    const has = settings.visibleKanbanStages.includes(id);
    const next = has
      ? settings.visibleKanbanStages.filter(s => s !== id)
      : [...settings.visibleKanbanStages, id];
    if (next.length === 0) return;
    onUpdate({ visibleKanbanStages: next });
  }, [settings.visibleKanbanStages, onUpdate]);

  const toggleNotification = useCallback((id) => {
    onUpdate({
      notifications: {
        ...settings.notifications,
        [id]: !settings.notifications[id],
      },
    });
  }, [settings.notifications, onUpdate]);

  const handleClearLocal = useCallback(() => {
    if (window.confirm("Isso vai apagar leads, configurações e sessão local. Continuar?")) {
      onClearLocalData();
    }
  }, [onClearLocalData]);

  const handleLoadDemo = useCallback(() => {
    const proceed = leadsCount === 0
      ? true
      : window.confirm("Isso vai substituir os leads atuais pelo conjunto de demonstração. Continuar?");
    if (proceed) onLoadDemoLeads?.();
  }, [leadsCount, onLoadDemoLeads]);

  const handleClearLeads = useCallback(() => {
    if (leadsCount === 0) return;
    setClearTyped("");
    setClearConfirmOpen(true);
  }, [leadsCount]);

  const handleClearConfirm = useCallback(() => {
    onClearAllLeads?.();
    setClearConfirmOpen(false);
    setClearTyped("");
  }, [onClearAllLeads]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-bold leading-tight" style={{ fontSize: 26, color: "var(--text)", letterSpacing: "-0.02em" }}>
            {isManager ? "Configurações" : "Meu perfil"}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>
            {isManager
              ? "Gerencie seu perfil, preferências e integrações"
              : "Atualize seus dados, notificações e integrações pessoais"}
          </p>
        </div>
        {isManager && (
          <Button variant="ghost" icon={RotateCcw} onClick={onReset}>
            Restaurar padrão
          </Button>
        )}
      </div>

      {/* Tab layout */}
      <div className="lg:flex lg:gap-6 lg:items-start">

        {/* Sidebar nav — lg only */}
        <nav className="hidden lg:flex flex-col gap-0.5 shrink-0" style={{ width: 200 }}>
          {tabs.map(tab => {
            const active = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left w-full"
                style={{
                  background: active ? "var(--accent-tint)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text-dim)",
                  boxShadow: active ? "inset 3px 0 0 var(--accent)" : "inset 3px 0 0 transparent",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.background = "var(--surface-alt)";
                    e.currentTarget.style.color = "var(--text)";
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-dim)";
                  }
                }}
              >
                <Icon size={15} strokeWidth={2} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Stack on mobile */}
        <div className="flex-1 min-w-0">

          {/* Mobile horizontal tabs — lg:hidden */}
          <div className="lg:hidden flex gap-1.5 overflow-x-auto mb-4" style={{ scrollbarWidth: "none" }}>
            {tabs.map(tab => {
              const active = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold shrink-0 transition-all"
                  style={{
                    background: active ? "var(--accent)" : "#F1EDE8",
                    color: active ? "#FFFFFF" : "var(--text-dim)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <Icon size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="space-y-4">

            {/* ── PERFIL ── */}
            {activeTab === "perfil" && (
              <div className="space-y-4">
                <Section title="Meu perfil">
                  {/* Avatar + info */}
                  <div className="flex items-center gap-4 mb-5">
                    <div className="relative shrink-0">
                      <div
                        className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden font-bold text-white"
                        style={{
                          fontSize: 22,
                          background: profileForm.avatarUrl ? "transparent" : (currentUser?.avatarBg || "var(--accent)"),
                        }}
                      >
                        {profileForm.avatarUrl
                          ? <img src={profileForm.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                          : (currentUser?.initials || "?")}
                      </div>
                      <button
                        onClick={() => fileRef.current?.click()}
                        title="Alterar foto"
                        className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ background: "var(--color-industria)", color: "#FFF", border: "2px solid #FFF", cursor: "pointer" }}
                      >
                        <Camera size={11} />
                      </button>
                      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm" style={{ color: "var(--text)" }}>{currentUser?.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>{currentUser?.email}</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>{ROLE_LABEL[currentUser?.role] || currentUser?.role}</div>
                    </div>
                  </div>

                  {/* Fields */}
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Nome
                      </label>
                      <input
                        type="text"
                        value={profileForm.name}
                        onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={{ borderColor: "var(--border)", color: "var(--text)", outline: "none", background: "var(--surface)" }}
                        onFocus={e => { e.target.style.borderColor = "var(--color-industria)"; e.target.style.boxShadow = `0 0 0 3px rgba(199,33,43,0.12)`; }}
                        onBlur={e => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                      />
                    </div>
                    <div>
                      <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Email
                      </label>
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={{ borderColor: "var(--border)", color: "var(--text)", outline: "none", background: "var(--surface)" }}
                        onFocus={e => { e.target.style.borderColor = "var(--color-industria)"; e.target.style.boxShadow = `0 0 0 3px rgba(199,33,43,0.12)`; }}
                        onBlur={e => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                      />
                      {!supabaseEnabled && (
                        <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>Modo offline — email salvo localmente.</p>
                      )}
                    </div>
                  </div>

                  {profileFeedback && (
                    <div
                      className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-3"
                      style={{
                        background: profileFeedback.type === "success" ? "var(--success-bg)" : "var(--danger-bg)",
                        color: profileFeedback.type === "success" ? "var(--success)" : "var(--danger)",
                        border: `1px solid ${profileFeedback.type === "success" ? "#BBF7D0" : "#FECACA"}`,
                      }}
                    >
                      {profileFeedback.type === "success" ? <Check size={13} /> : <AlertTriangle size={13} />}
                      {profileFeedback.msg}
                    </div>
                  )}

                  <button
                    onClick={handleProfileSave}
                    disabled={profileSaving}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
                    style={{ background: "var(--color-industria)", opacity: profileSaving ? 0.7 : 1, cursor: profileSaving ? "not-allowed" : "pointer" }}
                  >
                    {profileSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Salvar alterações
                  </button>
                </Section>

                <Section title="Alterar senha" description="Disponível apenas com autenticação ativa.">
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Nova senha
                      </label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={passwordForm.newPassword}
                        onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={{ borderColor: "var(--border)", color: "var(--text)", outline: "none", background: "var(--surface)" }}
                        onFocus={e => { e.target.style.borderColor = "var(--color-industria)"; e.target.style.boxShadow = `0 0 0 3px rgba(199,33,43,0.12)`; }}
                        onBlur={e => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                      />
                    </div>
                    <div>
                      <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Confirmar nova senha
                      </label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={passwordForm.confirmPassword}
                        onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                        placeholder="Repita a nova senha"
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={{ borderColor: "var(--border)", color: "var(--text)", outline: "none", background: "var(--surface)" }}
                        onFocus={e => { e.target.style.borderColor = "var(--color-industria)"; e.target.style.boxShadow = `0 0 0 3px rgba(199,33,43,0.12)`; }}
                        onBlur={e => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
                      />
                    </div>
                  </div>

                  {passwordFeedback && (
                    <div
                      className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-3"
                      style={{
                        background: passwordFeedback.type === "success" ? "var(--success-bg)" : "var(--danger-bg)",
                        color: passwordFeedback.type === "success" ? "var(--success)" : "var(--danger)",
                        border: `1px solid ${passwordFeedback.type === "success" ? "#BBF7D0" : "#FECACA"}`,
                      }}
                    >
                      {passwordFeedback.type === "success" ? <Check size={13} /> : <AlertTriangle size={13} />}
                      {passwordFeedback.msg}
                    </div>
                  )}

                  <button
                    onClick={handlePasswordSave}
                    disabled={passwordSaving || !passwordForm.newPassword}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all"
                    style={{
                      background: "var(--surface)",
                      color: "var(--text)",
                      borderColor: "var(--border)",
                      opacity: (passwordSaving || !passwordForm.newPassword) ? 0.5 : 1,
                      cursor: (passwordSaving || !passwordForm.newPassword) ? "not-allowed" : "pointer",
                    }}
                  >
                    {passwordSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                    Alterar senha
                  </button>
                </Section>
              </div>
            )}

            {/* ── PREFERÊNCIAS ── */}
            {activeTab === "preferencias" && (
              <div className="space-y-4">
                <Section
                  title="Empresas ativas"
                  description="Quais empresas aparecem no seletor do topo e nos filtros do app."
                >
                  <div className="grid grid-cols-2 gap-2">
                    {COMPANY_IDS.map(id => {
                      const c = COMPANIES[id];
                      const enabled = settings.enabledCompanies.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleCompany(id)}
                          className="p-3 rounded-lg border flex items-center gap-2.5 transition-all duration-150 text-left"
                          style={{
                            background: enabled ? c.light : "var(--surface)",
                            borderColor: enabled ? c.primary + "80" : "var(--border)",
                            boxShadow: enabled ? `0 0 0 1px ${c.primary}40` : "none",
                          }}
                          onMouseEnter={e => {
                            if (!enabled) {
                              e.currentTarget.style.borderColor = "#D0D0D0";
                              e.currentTarget.style.background = "#F5F5F3";
                            }
                          }}
                          onMouseLeave={e => {
                            if (!enabled) {
                              e.currentTarget.style.borderColor = "var(--border)";
                              e.currentTarget.style.background = "var(--surface)";
                            }
                          }}
                        >
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.primary }} />
                          <span
                            className="font-medium text-sm flex-1 leading-tight"
                            style={{ color: enabled ? c.dark : "var(--text)" }}
                          >
                            {c.name}
                          </span>
                          {enabled && <Check size={13} color={c.primary} />}
                        </button>
                      );
                    })}
                  </div>
                </Section>

                <Section
                  title="Widgets do Dashboard"
                  description="Quais StatCards aparecem no topo do Dashboard."
                >
                  <div className="divide-y" style={{ borderColor: "#F0F0F0" }}>
                    {DASHBOARD_WIDGETS.map(w => (
                      <ToggleRow
                        key={w.id}
                        label={w.label}
                        checked={settings.visibleDashboardWidgets.includes(w.id)}
                        onChange={() => toggleWidget(w.id)}
                      />
                    ))}
                  </div>
                </Section>

                {isManager && (
                  <Section
                    title="Widgets do Painel Executivo"
                    description="O Painel Executivo não é do Comercial — é a visão de todos os departamentos que você tem acesso. Escolha o que aparece no seu."
                  >
                    <div className="divide-y" style={{ borderColor: "#F0F0F0" }}>
                      {EXECUTIVE_WIDGETS.map(w => (
                        <ToggleRow
                          key={w.id}
                          label={w.label}
                          checked={settings.visibleExecutiveWidgets.includes(w.id)}
                          onChange={() => toggleExecutiveWidget(w.id)}
                        />
                      ))}
                    </div>
                  </Section>
                )}

                <Section
                  title="Etapas visíveis no Kanban"
                  description="Esconda etapas que você não usa no dia a dia."
                >
                  <div className="divide-y" style={{ borderColor: "#F0F0F0" }}>
                    {DEFAULT_PIPELINE_STAGES.map(s => (
                      <ToggleRow
                        key={s.id}
                        label={s.name}
                        checked={settings.visibleKanbanStages.includes(s.id)}
                        onChange={() => toggleStage(s.id)}
                      />
                    ))}
                  </div>
                </Section>
              </div>
            )}

            {/* ── NOTIFICAÇÕES ── */}
            {activeTab === "notificacoes" && (
              <Section
                title="Notificações"
                description="Alertas visuais dentro do app, filtrados pelo seu papel."
              >
                <div className="space-y-4">
                  <div>
                    <div
                      className="pb-2 mb-1 border-b"
                      style={{ borderColor: "#F0F0F0" }}
                    >
                      <span
                        className="font-bold tracking-wide"
                        style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}
                      >
                        Menções
                      </span>
                    </div>
                    <div className="divide-y" style={{ borderColor: "#F0F0F0" }}>
                      <ToggleRow
                        label="Notificar quando alguém me mencionar (@)"
                        sublabel="Ativado por padrão. Desative se não quiser receber notificação de @menção em comentários."
                        checked={currentUser?.mentionNotificationsEnabled !== false}
                        onChange={() => {
                          if (onUpdateUser && currentUser?.id) {
                            onUpdateUser(currentUser.id, { mentionNotificationsEnabled: !(currentUser?.mentionNotificationsEnabled !== false) });
                          }
                        }}
                      />
                    </div>
                  </div>
                  {NOTIFICATION_GROUPS
                    .filter(group => !currentUser?.role || group.roles.includes(currentUser.role))
                    .map(group => (
                      <div key={group.id}>
                        <div
                          className="pb-2 mb-1 border-b flex items-center justify-between"
                          style={{ borderColor: "#F0F0F0" }}
                        >
                          <span
                            className="font-bold tracking-wide"
                            style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}
                          >
                            {group.label}
                          </span>
                          {(() => {
                            const allOn = group.items.every(n => Boolean(settings.notifications[n.id]));
                            return (
                              <button
                                onClick={() => {
                                  const update = {};
                                  group.items.forEach(n => { update[n.id] = !allOn; });
                                  onUpdate({ notifications: { ...settings.notifications, ...update } });
                                }}
                                className="text-[10px] font-semibold"
                                style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                              >
                                {allOn ? "Desativar todos" : "Ativar todos"}
                              </button>
                            );
                          })()}
                        </div>
                        <div className="divide-y" style={{ borderColor: "#F0F0F0" }}>
                          {group.items.map(n => (
                            <ToggleRow
                              key={n.id}
                              label={n.label}
                              checked={Boolean(settings.notifications[n.id])}
                              onChange={() => toggleNotification(n.id)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </Section>
            )}

            {/* ── IA ── */}
            {activeTab === "ia" && (
              <Section title="Integrações de IA" description="Configure sua LLM para usar os recursos de IA do CRM.">
                <div className="space-y-5">
                  {/* Status badge */}
                  {currentUser?.aiConfig?.provider && (
                    <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
                      <CheckCircle2 size={13} />
                      <span className="font-semibold">
                        {AI_PROVIDER_MAP[currentUser.aiConfig.provider]?.name} — {currentUser.aiConfig.model} conectado
                      </span>
                      <button
                        onClick={handleAiDisconnect}
                        className="ml-auto text-xs underline"
                        style={{ color: "var(--success)", background: "none", border: "none", cursor: "pointer" }}
                      >
                        Desconectar
                      </button>
                    </div>
                  )}

                  {/* Provider picker */}
                  <div>
                    <label className="text-xs font-semibold block mb-2" style={{ color: "var(--text-dim)" }}>
                      Provedor de IA
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {AI_PROVIDERS.map(p => (
                        <button
                          key={p.id}
                          onClick={() => handleAiProviderChange(p.id)}
                          className="py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all"
                          style={{
                            background: aiForm.provider === p.id ? NEUTRAL.red + "0F" : "var(--surface)",
                            borderColor: aiForm.provider === p.id ? "var(--color-industria)" : "var(--border)",
                            color: aiForm.provider === p.id ? "var(--color-industria)" : "var(--text)",
                            cursor: "pointer",
                          }}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Model picker */}
                  {selectedProvider && (
                    <div>
                      <label className="text-xs font-semibold block mb-2" style={{ color: "var(--text-dim)" }}>
                        Modelo
                      </label>
                      <div className="flex flex-col gap-1.5">
                        {selectedProvider.models.map(m => (
                          <label
                            key={m.id}
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all"
                            style={{
                              background: aiForm.model === m.id ? NEUTRAL.red + "0F" : "var(--surface)",
                              borderColor: aiForm.model === m.id ? "var(--color-industria)" : "var(--border)",
                            }}
                          >
                            <input
                              type="radio"
                              name="ai-model"
                              value={m.id}
                              checked={aiForm.model === m.id}
                              onChange={() => setAiForm(f => ({ ...f, model: m.id }))}
                              style={{ accentColor: "var(--color-industria)" }}
                            />
                            <span className="text-xs font-medium" style={{ color: "var(--text)" }}>{m.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* API key */}
                  {selectedProvider && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
                          <Key size={11} className="inline mr-1" />Chave de API
                        </label>
                        <a
                          href={selectedProvider.keyHint.includes('platform.openai') ? 'https://platform.openai.com/api-keys' :
                                selectedProvider.keyHint.includes('console.anthropic') ? 'https://console.anthropic.com/settings/keys' :
                                'https://aistudio.google.com/app/apikey'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs flex items-center gap-1"
                          style={{ color: "var(--color-industria)" }}
                        >
                          <ExternalLink size={10} />Obter chave
                        </a>
                      </div>
                      <div className="relative">
                        <input
                          type={aiKeyVisible ? "text" : "password"}
                          value={aiForm.apiKey}
                          onChange={e => { setAiForm(f => ({ ...f, apiKey: e.target.value })); setAiTestResult(null); }}
                          placeholder={selectedProvider.keyPlaceholder}
                          className="w-full text-sm rounded-xl border px-3 py-2.5 outline-none pr-16"
                          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)", fontFamily: "monospace" }}
                          onFocus={e => { e.currentTarget.style.borderColor = "var(--color-industria)"; }}
                          onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
                        />
                        <button
                          type="button"
                          onClick={() => setAiKeyVisible(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                          style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer" }}
                        >
                          {aiKeyVisible ? "Ocultar" : "Mostrar"}
                        </button>
                      </div>
                      <p className="text-[11px] mt-1" style={{ color: "var(--text-dim)" }}>
                        {selectedProvider.keyHint}
                      </p>
                    </div>
                  )}

                  {/* Test result */}
                  {aiTestResult && (
                    <div
                      className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
                      style={{
                        background: aiTestResult === 'ok' ? "var(--success-bg)" : "var(--danger-bg)",
                        color: aiTestResult === 'ok' ? "var(--success)" : "var(--danger)",
                      }}
                    >
                      {aiTestResult === 'ok' ? <CheckCircle2 size={13} /> : <Zap size={13} />}
                      <span>{aiTestResult === 'ok' ? `✓ ${aiTestMsg || 'Conexão OK'}` : aiTestMsg}</span>
                    </div>
                  )}

                  {/* Action buttons */}
                  {selectedProvider && aiForm.apiKey.trim() && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={handleAiTest}
                        disabled={aiTesting}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border transition-all"
                        style={{
                          background: "var(--surface)",
                          borderColor: "var(--border)",
                          color: "var(--text)",
                          cursor: aiTesting ? "wait" : "pointer",
                        }}
                      >
                        <Zap size={12} />
                        {aiTesting ? "Testando..." : "Testar conexão"}
                      </button>
                      <button
                        onClick={handleAiSave}
                        disabled={aiSaving}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all"
                        style={{
                          background: aiSaving ? "#E5E7EB" : "var(--color-industria)",
                          border: "none",
                          cursor: aiSaving ? "wait" : "pointer",
                        }}
                      >
                        {aiSaving ? "Salvando..." : "Salvar configuração"}
                      </button>
                    </div>
                  )}
                  {aiSaveFeedback && (
                    <div
                      className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                      style={{
                        background: aiSaveFeedback.type === "success" ? "var(--success-bg)" : "var(--danger-bg)",
                        color: aiSaveFeedback.type === "success" ? "var(--success)" : "var(--danger)",
                      }}
                    >
                      {aiSaveFeedback.type === "success" ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                      {aiSaveFeedback.msg}
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* ── APARÊNCIA ── */}
            {activeTab === "aparencia" && (
              <div className="space-y-4">
                <Section
                  title="Cor de destaque"
                  description="Aplicada em botões, links ativos, barras de progresso e destaques em todo o sistema."
                >
                  {/* Preset swatches */}
                  <div className="mb-4">
                    <div className="text-xs font-semibold mb-2" style={{ color: "var(--text-dim)" }}>Paletas prontas</div>
                    <div className="flex flex-wrap gap-2">
                      {ACCENT_PRESETS.map(p => {
                        const active = accentColor === p.value;
                        return (
                          <button
                            key={p.value}
                            onClick={() => handleAccentPreset(p)}
                            title={p.label}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
                            style={{
                              background: active ? p.value + "18" : "var(--surface)",
                              borderColor: active ? p.value : "var(--border)",
                              color: active ? p.value : "var(--text-dim)",
                              cursor: "pointer",
                            }}
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-full shrink-0"
                              style={{ background: p.value, border: "2px solid " + p.value + "40" }}
                            />
                            {p.label}
                            {active && <Check size={11} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom pickers */}
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div>
                      <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Cor principal
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={accentColor}
                          onChange={e => handleAccentInput(e.target.value)}
                          className="w-9 h-9 rounded-lg border cursor-pointer"
                          style={{ borderColor: "var(--border)", padding: 2 }}
                        />
                        <input
                          type="text"
                          value={accentColor}
                          onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) handleAccentInput(e.target.value); }}
                          className="flex-1 text-xs rounded-lg border px-2 py-1.5 outline-none font-mono"
                          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Cor hover
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={hoverColor}
                          onChange={e => handleHoverInput(e.target.value)}
                          className="w-9 h-9 rounded-lg border cursor-pointer"
                          style={{ borderColor: "var(--border)", padding: 2 }}
                        />
                        <input
                          type="text"
                          value={hoverColor}
                          onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) handleHoverInput(e.target.value); }}
                          className="flex-1 text-xs rounded-lg border px-2 py-1.5 outline-none font-mono"
                          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Live preview */}
                  <div className="p-4 rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}>
                    <div className="text-xs font-semibold mb-3" style={{ color: "var(--text-dim)" }}>Pré-visualização</div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                        style={{ background: accentColor, cursor: "default" }}
                      >
                        Botão primário
                      </button>
                      <button
                        className="px-4 py-2 rounded-lg text-sm font-semibold border"
                        style={{ color: accentColor, borderColor: accentColor, background: accentColor + "10", cursor: "default" }}
                      >
                        Botão secundário
                      </button>
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ background: accentColor + "18", color: accentColor, border: `1px solid ${accentColor}30` }}
                      >
                        Badge destaque
                      </span>
                      <span
                        className="text-sm font-medium underline cursor-default"
                        style={{ color: accentColor }}
                      >
                        Link ativo
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={handleResetAccent}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all"
                      style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)", cursor: "pointer" }}
                    >
                      <RotateCcw size={12} />
                      Restaurar padrão
                    </button>
                    <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                      A cor é salva localmente neste navegador.
                    </span>
                  </div>
                </Section>

                <Section
                  title="Modo escuro"
                  description="O botão de alternância fica no canto superior direito da barra de navegação."
                >
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
                    Use o ícone <strong style={{ color: "var(--text)" }}>lua / sol</strong> na barra superior para alternar entre modo claro e escuro.
                    A preferência é salva automaticamente.
                  </p>
                </Section>
              </div>
            )}

            {/* ── DADOS ── */}
            {activeTab === "dados" && (
              <div className="space-y-4">
                {!supabaseEnabled && (
                  <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "var(--warning-bg)", color: "var(--warning)", border: "1px solid #FCD34D" }}>
                    Modo offline — dados armazenados localmente neste navegador.
                  </div>
                )}

                {/* ── Comercial (Leads) ── */}
                <Section
                  title="Dados de demonstração · Comercial"
                  description={`${leadsCount} lead${leadsCount === 1 ? "" : "s"} no momento. Use para explorar a UI sem cadastrar dados reais.`}
                >
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Button variant="secondary" icon={Sparkles} onClick={handleLoadDemo}>
                      Carregar dados de demonstração
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t" style={{ borderColor: "#F0F0F0" }}>
                    <Button
                      variant="ghost"
                      icon={Trash2}
                      onClick={handleClearLeads}
                      disabled={leadsCount === 0}
                      style={{ color: "var(--danger)", borderColor: "#FECACA" }}
                    >
                      Limpar todos os leads
                    </Button>
                    {leadsCount > 0 && (
                      <span className="self-center text-xs flex items-center gap-1" style={{ color: "var(--danger)" }}>
                        <AlertTriangle size={11} />
                        Ação irreversível
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed mt-3" style={{ color: "var(--text-dim)" }}>
                    Gera ~68 empresas fictícias distribuídas nas 4 unidades, com setor, estado, porte e
                    funil. Preenche os dropdowns do Explorador, Kanban e Executivo para testes.
                  </p>
                </Section>

                {/* ── Marketing + RH ── */}
                {supabaseEnabled && onLoadAllDemoData && (
                  <Section
                    title="Dados de demonstração · Marketing & RH"
                    description="Popula campanhas, entregas, despesas, solicitações e funcionários fictícios para explorar todas as áreas da plataforma."
                  >
                    {demoDataCounts && (
                      <div className="mb-3 p-3 rounded-lg text-xs" style={{ background: "#DCFCE7", color: "#15803D", border: "1px solid #BBF7D0" }}>
                        <strong>Carregado com sucesso:</strong>{" "}
                        {demoDataCounts.campaigns} campanhas,{" "}
                        {demoDataCounts.deliverables} entregas,{" "}
                        {demoDataCounts.expenses} despesas,{" "}
                        {demoDataCounts.requests} solicitações,{" "}
                        {demoDataCounts.colaboradores} funcionários.
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        icon={demoDataLoading ? Loader2 : Sparkles}
                        onClick={onLoadAllDemoData}
                        disabled={demoDataLoading}
                      >
                        {demoDataLoading ? "Carregando…" : "Carregar dados de demonstração"}
                      </Button>
                    </div>
                    <p className="text-xs leading-relaxed mt-3" style={{ color: "var(--text-dim)" }}>
                      Cria registros fictícios em: Campanhas de Marketing, Entregas, Despesas,
                      Solicitações e Funcionários (RH). Os dados são marcados com <code>is_demo</code> e
                      podem ser removidos individualmente em cada módulo.
                    </p>
                  </Section>
                )}

                <Section
                  title="Dados locais"
                  description="Apagar leads, configurações e sessão armazenados neste navegador."
                >
                  <div
                    className="p-3.5 rounded-lg mb-4 flex items-start gap-2.5 text-xs"
                    style={{ background: NEUTRAL.amber + "15" || "#FFF7ED", borderLeft: "3px solid var(--amber)", color: "var(--amber)" }}
                  >
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span className="leading-relaxed">
                      Isso não afeta dados sincronizados com o Supabase. Afeta só este navegador.
                    </span>
                  </div>
                  <Button variant="secondary" icon={Trash2} onClick={handleClearLocal}>
                    Limpar dados locais
                  </Button>
                </Section>
              </div>
            )}

            {/* ── CAPTURA PÚBLICA ── */}
            {activeTab === "captura" && (
              <Section
                title="Links de captura pública"
                description="Compartilhe estes links no site, redes sociais ou anúncios. Quando um cliente preenche, o lead entra direto na etapa Prospecção da empresa correspondente."
              >
                {/* Formulário de Solicitação de Marketing */}
                <div className="mb-5 pb-5 border-b" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                    <div>
                      <div className="font-semibold text-sm mb-0.5" style={{ color: "var(--text)" }}>
                        Formulário de Solicitação · Marketing
                      </div>
                      <p className="text-xs" style={{ color: "var(--text-dim)", marginBottom: 0 }}>
                        Outros departamentos usam este link para pedir materiais ao Marketing. As solicitações entram em <strong>Marketing → Solicitações</strong> para aprovação.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/solicitar-marketing`)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer transition-colors"
                        style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
                        title="Copiar link"
                      >
                        <Copy size={12} />
                        Copiar
                      </button>
                      <a
                        href={`${window.location.origin}/solicitar-marketing`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
                        style={{ background: "var(--accent)", color: "#FFFFFF", textDecoration: "none" }}
                      >
                        <ExternalLink size={12} />
                        Abrir
                      </a>
                    </div>
                  </div>
                  <code style={{ fontSize: 12, color: "var(--text-dim)", wordBreak: "break-all" }}>
                    {window.location.origin}/solicitar-marketing
                  </code>
                </div>

                {/* Formulário de Solicitação de Compras de Marketing */}
                <div className="mb-5 pb-5 border-b" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                    <div>
                      <div className="font-semibold text-sm mb-0.5" style={{ color: "var(--text)" }}>
                        Formulário de Solicitação · Compras de Marketing
                      </div>
                      <p className="text-xs" style={{ color: "var(--text-dim)", marginBottom: 0 }}>
                        Qualquer pessoa usa este link para pedir a compra de um item pronto (brinde, uniforme, material impresso). As solicitações entram em <strong>Marketing → Compras</strong> para aprovação.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/solicitar-compra`)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer transition-colors"
                        style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
                        title="Copiar link"
                      >
                        <Copy size={12} />
                        Copiar
                      </button>
                      <a
                        href={`${window.location.origin}/solicitar-compra`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
                        style={{ background: "var(--accent)", color: "#FFFFFF", textDecoration: "none" }}
                      >
                        <ExternalLink size={12} />
                        Abrir
                      </a>
                    </div>
                  </div>
                  <code style={{ fontSize: 12, color: "var(--text-dim)", wordBreak: "break-all" }}>
                    {window.location.origin}/solicitar-compra
                  </code>
                </div>
                <div className="space-y-3">
                  {COMPANY_IDS.map(id => {
                    const c = COMPANIES[id];
                    const url = `${window.location.origin}/captura/${id}`;
                    return (
                      <div key={id} className="p-3.5 rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                              style={{ background: c.primary + "18", color: c.primary, border: `1px solid ${c.primary}30` }}
                            >
                              {c.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => navigator.clipboard?.writeText(url)}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer transition-colors"
                              style={{ background: "var(--surface)", color: "var(--text)", borderColor: "var(--border)" }}
                              onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}
                              title="Copiar link"
                            >
                              <Copy size={12} />
                              Copiar
                            </button>
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
                              style={{ background: c.primary, color: "#FFFFFF", textDecoration: "none" }}
                            >
                              <ExternalLink size={12} />
                              Abrir
                            </a>
                          </div>
                        </div>
                        <code style={{ fontSize: 12, color: "var(--text-dim)", wordBreak: "break-all" }}>{url}</code>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 p-3 rounded-lg text-xs flex items-start gap-2" style={{ background: "var(--surface-alt)", color: "#1E40AF", border: "1px solid #BFDBFE" }}>
                  <Link2 size={13} className="shrink-0 mt-0.5" />
                  <div>
                    <strong>Dica:</strong> adicione <code>?src=instagram</code>, <code>?src=whatsapp</code> ou outro identificador ao final da URL para rastrear a origem da captura no card do lead.
                  </div>
                </div>

                {/* Importar planilha de clientes */}
                {onOpenClientImport && (
                  <div className="mt-6 pt-5 border-t" style={{ borderColor: "#F0F0F0" }}>
                    <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                      <div>
                        <div className="font-semibold text-sm" style={{ color: "var(--text)", marginBottom: 2 }}>
                          Importar planilha de clientes
                        </div>
                        <p className="text-xs" style={{ color: "var(--text-dim)", marginBottom: 0, maxWidth: 480 }}>
                          Envie um arquivo .xlsx ou .csv com clientes ativos e inativos. A plataforma deduplica
                          automaticamente por CNPJ — registros já cadastrados são ignorados.
                        </p>
                      </div>
                      <Button variant="primary" icon={Database} onClick={onOpenClientImport}>
                        Importar planilha
                      </Button>
                    </div>
                  </div>
                )}
              </Section>
            )}

            {/* ── CLIENTES ── */}
            {activeTab === "clientes" && clientsPanel}

            {/* ── USUÁRIOS ── */}
            {activeTab === "usuarios" && usersPanel}

          </div>
        </div>
      </div>

      {/* Confirm clear leads modal */}
      <Modal
        open={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        title="⚠️ Confirmar exclusão de leads"
        width={440}
      >
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>
            Esta ação removerá <strong>todos os {leadsCount} leads</strong> do CRM.
            Ela é <strong>irreversível</strong> e não pode ser desfeita.
          </p>
          <div
            className="p-3 rounded-lg text-xs flex items-start gap-2"
            style={{ background: "#FEF2F2", color: "var(--danger)", border: "1px solid #FECACA" }}
          >
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            <span>Dados sincronizados com o Supabase serão excluídos do banco de dados permanentemente.</span>
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--text-dim)" }}>
              Digite <strong style={{ color: "var(--text)" }}>LIMPAR</strong> para confirmar
            </label>
            <input
              type="text"
              value={clearTyped}
              onChange={e => setClearTyped(e.target.value)}
              placeholder="LIMPAR"
              autoFocus
              className="w-full text-sm rounded-lg border px-3 py-2 outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
              onFocus={e => { e.currentTarget.style.borderColor = "var(--danger)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setClearConfirmOpen(false)}
              className="px-4 py-2 text-sm rounded-lg border"
              style={{ borderColor: "var(--border)", color: "var(--text-dim)", background: "var(--surface)" }}
            >
              Cancelar
            </button>
            <button
              onClick={handleClearConfirm}
              disabled={clearTyped !== "LIMPAR"}
              className="px-4 py-2 text-sm rounded-lg font-semibold text-white transition-opacity"
              style={{
                background: "var(--danger)",
                opacity: clearTyped === "LIMPAR" ? 1 : 0.4,
                cursor: clearTyped === "LIMPAR" ? "pointer" : "not-allowed",
                border: "none",
              }}
            >
              Excluir todos os leads
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default SettingsView;
