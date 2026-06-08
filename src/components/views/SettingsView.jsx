import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  RotateCcw, Check, AlertTriangle, AlertCircle, Trash2, Database, Sparkles, Camera, Loader2,
  Bot, Key, Zap, ExternalLink, CheckCircle2, User, Bell, Sliders, Globe, X, UserCog,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { COMPANIES, COMPANY_IDS, NEUTRAL } from "../../constants/companies";
import { AI_PROVIDERS, AI_PROVIDER_MAP } from "../../constants/ai-providers";
import { DEFAULT_PIPELINE_STAGES } from "../../constants/pipelines";
import {
  DASHBOARD_WIDGETS, NOTIFICATION_GROUPS, DENSITY_OPTIONS,
} from "../../constants/user-settings";
import { Button } from "../ui/Button";

function Section({ title, description, children }) {
  return (
    <div
      className="p-5 rounded-xl border"
      style={{ background: "#FFFFFF", borderColor: "#E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
    >
      <div className="mb-4">
        <h2 className="font-semibold" style={{ fontSize: 15, color: NEUTRAL.graphite }}>
          {title}
        </h2>
        {description && (
          <p className="text-xs mt-1 leading-relaxed" style={{ color: NEUTRAL.slate }}>{description}</p>
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
        <div className="text-sm font-medium" style={{ color: NEUTRAL.graphite }}>{label}</div>
        {sublabel && (
          <div className="text-xs mt-0.5" style={{ color: NEUTRAL.slate }}>{sublabel}</div>
        )}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="w-4 h-4 cursor-pointer"
        style={{ accentColor: NEUTRAL.graphite }}
      />
    </label>
  );
}

const ROLE_LABEL = { admin: "Administrador", gerente: "Gerente", vendedor: "Vendedor", consultor: "Consultor" };

const BASE_TABS = [
  { id: "perfil",        label: "Perfil",           icon: User     },
  { id: "preferencias", label: "Preferências",      icon: Sliders  },
  { id: "notificacoes", label: "Notificações",      icon: Bell     },
  { id: "ia",           label: "Integrações IA",    icon: Bot      },
  { id: "dados",        label: "Dados",             icon: Database },
];

export function SettingsView({
  settings, onUpdate, onReset, onClearLocalData, currentUser,
  leadsCount = 0, onLoadDemoLeads, onClearAllLeads,
  onUpdateUser, onUpdateAuthUser, onUpdateMockUser, supabaseEnabled,
  usersPanel,
}) {
  const [activeTab, setActiveTab] = useState("perfil");
  const tabs = useMemo(
    () => usersPanel ? [...BASE_TABS, { id: "usuarios", label: "Usuários", icon: UserCog }] : BASE_TABS,
    [usersPanel],
  );
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearTyped, setClearTyped] = useState("");

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
        text = 'Anthropic requer Supabase Edge Function (deploy necessário)';
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
          <h1 className="font-bold leading-tight" style={{ fontSize: 26, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
            Configurações
          </h1>
          <p className="text-sm mt-0.5" style={{ color: NEUTRAL.slate }}>
            Gerencie seu perfil, preferências e integrações
          </p>
        </div>
        <Button variant="ghost" icon={RotateCcw} onClick={onReset}>
          Restaurar padrão
        </Button>
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
                  background: active ? "#FBE9EB" : "transparent",
                  color: active ? "#b5000b" : "#6B7280",
                  boxShadow: active ? "inset 3px 0 0 #b5000b" : "inset 3px 0 0 transparent",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.background = "#F1EDE8";
                    e.currentTarget.style.color = "#201a1a";
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#6B7280";
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
                    background: active ? "#b5000b" : "#F1EDE8",
                    color: active ? "#FFFFFF" : "#6B7280",
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
                          background: profileForm.avatarUrl ? "transparent" : (currentUser?.avatarBg || "#1E4D8C"),
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
                        style={{ background: NEUTRAL.red, color: "#FFF", border: "2px solid #FFF", cursor: "pointer" }}
                      >
                        <Camera size={11} />
                      </button>
                      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm" style={{ color: NEUTRAL.graphite }}>{currentUser?.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: NEUTRAL.slate }}>{currentUser?.email}</div>
                      <div className="text-xs mt-0.5" style={{ color: NEUTRAL.slate }}>{ROLE_LABEL[currentUser?.role] || currentUser?.role}</div>
                    </div>
                  </div>

                  {/* Fields */}
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Nome
                      </label>
                      <input
                        type="text"
                        value={profileForm.name}
                        onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite, outline: "none", background: "#fff8f7" }}
                        onFocus={e => { e.target.style.borderColor = NEUTRAL.red; e.target.style.boxShadow = `0 0 0 3px rgba(199,33,43,0.12)`; }}
                        onBlur={e => { e.target.style.borderColor = "#E5E7EB"; e.target.style.boxShadow = "none"; }}
                      />
                    </div>
                    <div>
                      <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Email
                      </label>
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite, outline: "none", background: "#fff8f7" }}
                        onFocus={e => { e.target.style.borderColor = NEUTRAL.red; e.target.style.boxShadow = `0 0 0 3px rgba(199,33,43,0.12)`; }}
                        onBlur={e => { e.target.style.borderColor = "#E5E7EB"; e.target.style.boxShadow = "none"; }}
                      />
                      {!supabaseEnabled && (
                        <p className="text-xs mt-1" style={{ color: NEUTRAL.slate }}>Modo offline — email salvo localmente.</p>
                      )}
                    </div>
                  </div>

                  {profileFeedback && (
                    <div
                      className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-3"
                      style={{
                        background: profileFeedback.type === "success" ? "#F0FDF4" : "#FEF2F2",
                        color: profileFeedback.type === "success" ? "#16A34A" : "#B91C1C",
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
                    style={{ background: NEUTRAL.red, opacity: profileSaving ? 0.7 : 1, cursor: profileSaving ? "not-allowed" : "pointer" }}
                  >
                    {profileSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Salvar alterações
                  </button>
                </Section>

                <Section title="Alterar senha" description="Disponível apenas com autenticação ativa.">
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Nova senha
                      </label>
                      <input
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite, outline: "none", background: "#fff8f7" }}
                        onFocus={e => { e.target.style.borderColor = NEUTRAL.red; e.target.style.boxShadow = `0 0 0 3px rgba(199,33,43,0.12)`; }}
                        onBlur={e => { e.target.style.borderColor = "#E5E7EB"; e.target.style.boxShadow = "none"; }}
                      />
                    </div>
                    <div>
                      <label className="block mb-1.5" style={{ fontSize: 11, fontWeight: 700, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Confirmar nova senha
                      </label>
                      <input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                        placeholder="Repita a nova senha"
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite, outline: "none", background: "#fff8f7" }}
                        onFocus={e => { e.target.style.borderColor = NEUTRAL.red; e.target.style.boxShadow = `0 0 0 3px rgba(199,33,43,0.12)`; }}
                        onBlur={e => { e.target.style.borderColor = "#E5E7EB"; e.target.style.boxShadow = "none"; }}
                      />
                    </div>
                  </div>

                  {passwordFeedback && (
                    <div
                      className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-3"
                      style={{
                        background: passwordFeedback.type === "success" ? "#F0FDF4" : "#FEF2F2",
                        color: passwordFeedback.type === "success" ? "#16A34A" : "#B91C1C",
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
                      background: "#FFF",
                      color: NEUTRAL.graphite,
                      borderColor: "#E5E7EB",
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
                  title="Densidade"
                  description="Ajusta o espaçamento geral da interface."
                >
                  <div className="flex gap-2">
                    {DENSITY_OPTIONS.map(opt => {
                      const active = settings.density === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => onUpdate({ density: opt.value })}
                          className="px-4 py-2 text-sm font-medium rounded-lg border transition-all duration-150"
                          style={{
                            background: active ? NEUTRAL.graphite : "#FFFFFF",
                            color: active ? "#FFFFFF" : NEUTRAL.slate,
                            borderColor: active ? NEUTRAL.graphite : "#E5E7EB",
                            boxShadow: active ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                          }}
                          onMouseEnter={e => {
                            if (!active) {
                              e.currentTarget.style.borderColor = "#B0B0B0";
                              e.currentTarget.style.background = "#F5F5F5";
                            }
                          }}
                          onMouseLeave={e => {
                            if (!active) {
                              e.currentTarget.style.borderColor = "#E5E7EB";
                              e.currentTarget.style.background = "#FFFFFF";
                            }
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </Section>

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
                            background: enabled ? c.light : "#FAFAFA",
                            borderColor: enabled ? c.primary + "80" : "#E5E7EB",
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
                              e.currentTarget.style.borderColor = "#E5E7EB";
                              e.currentTarget.style.background = "#FAFAFA";
                            }
                          }}
                        >
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.primary }} />
                          <span
                            className="font-medium text-sm flex-1 leading-tight"
                            style={{ color: enabled ? c.dark : NEUTRAL.graphite }}
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
                            style={{ fontSize: 10, color: NEUTRAL.slate, textTransform: "uppercase", letterSpacing: "0.08em" }}
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
                                style={{ color: NEUTRAL.slate, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
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
                    <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: "#DCFCE7", color: "#16A34A" }}>
                      <CheckCircle2 size={13} />
                      <span className="font-semibold">
                        {AI_PROVIDER_MAP[currentUser.aiConfig.provider]?.name} — {currentUser.aiConfig.model} conectado
                      </span>
                      <button
                        onClick={handleAiDisconnect}
                        className="ml-auto text-xs underline"
                        style={{ color: "#16A34A", background: "none", border: "none", cursor: "pointer" }}
                      >
                        Desconectar
                      </button>
                    </div>
                  )}

                  {/* Provider picker */}
                  <div>
                    <label className="text-xs font-semibold block mb-2" style={{ color: NEUTRAL.slate }}>
                      Provedor de IA
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {AI_PROVIDERS.map(p => (
                        <button
                          key={p.id}
                          onClick={() => handleAiProviderChange(p.id)}
                          className="py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all"
                          style={{
                            background: aiForm.provider === p.id ? NEUTRAL.red + "0F" : "#FFFFFF",
                            borderColor: aiForm.provider === p.id ? NEUTRAL.red : "#E5E7EB",
                            color: aiForm.provider === p.id ? NEUTRAL.red : NEUTRAL.graphite,
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
                      <label className="text-xs font-semibold block mb-2" style={{ color: NEUTRAL.slate }}>
                        Modelo
                      </label>
                      <div className="flex flex-col gap-1.5">
                        {selectedProvider.models.map(m => (
                          <label
                            key={m.id}
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all"
                            style={{
                              background: aiForm.model === m.id ? NEUTRAL.red + "0F" : "#FAFAFA",
                              borderColor: aiForm.model === m.id ? NEUTRAL.red : "#E5E7EB",
                            }}
                          >
                            <input
                              type="radio"
                              name="ai-model"
                              value={m.id}
                              checked={aiForm.model === m.id}
                              onChange={() => setAiForm(f => ({ ...f, model: m.id }))}
                              style={{ accentColor: NEUTRAL.red }}
                            />
                            <span className="text-xs font-medium" style={{ color: NEUTRAL.graphite }}>{m.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* API key */}
                  {selectedProvider && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold" style={{ color: NEUTRAL.slate }}>
                          <Key size={11} className="inline mr-1" />Chave de API
                        </label>
                        <a
                          href={selectedProvider.keyHint.includes('platform.openai') ? 'https://platform.openai.com/api-keys' :
                                selectedProvider.keyHint.includes('console.anthropic') ? 'https://console.anthropic.com/settings/keys' :
                                'https://aistudio.google.com/app/apikey'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs flex items-center gap-1"
                          style={{ color: NEUTRAL.red }}
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
                          style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite, background: "#FAFAFA", fontFamily: "monospace" }}
                          onFocus={e => { e.currentTarget.style.borderColor = NEUTRAL.red; }}
                          onBlur={e => { e.currentTarget.style.borderColor = "#E5E7EB"; }}
                        />
                        <button
                          type="button"
                          onClick={() => setAiKeyVisible(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                          style={{ color: NEUTRAL.slate, background: "none", border: "none", cursor: "pointer" }}
                        >
                          {aiKeyVisible ? "Ocultar" : "Mostrar"}
                        </button>
                      </div>
                      <p className="text-[11px] mt-1" style={{ color: NEUTRAL.slate }}>
                        {selectedProvider.keyHint}
                      </p>
                    </div>
                  )}

                  {/* Test result */}
                  {aiTestResult && (
                    <div
                      className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
                      style={{
                        background: aiTestResult === 'ok' ? "#DCFCE7" : "#FEE2E2",
                        color: aiTestResult === 'ok' ? "#16A34A" : "#DC2626",
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
                          background: "#FFFFFF",
                          borderColor: "#E5E7EB",
                          color: NEUTRAL.graphite,
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
                          background: aiSaving ? "#E5E7EB" : NEUTRAL.red,
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
                        background: aiSaveFeedback.type === "success" ? "#DCFCE7" : "#FEF2F2",
                        color: aiSaveFeedback.type === "success" ? "#16A34A" : "#B91C1C",
                      }}
                    >
                      {aiSaveFeedback.type === "success" ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                      {aiSaveFeedback.msg}
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* ── DADOS ── */}
            {activeTab === "dados" && (
              <div className="space-y-4">
                {!supabaseEnabled && (
                  <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D" }}>
                    Modo offline — dados armazenados localmente neste navegador.
                  </div>
                )}

                <Section
                  title="Dados de demonstração"
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
                      style={{ color: "#DC2626", borderColor: "#FECACA" }}
                    >
                      Limpar todos os leads
                    </Button>
                    {leadsCount > 0 && (
                      <span className="self-center text-xs flex items-center gap-1" style={{ color: "#DC2626" }}>
                        <AlertTriangle size={11} />
                        Ação irreversível
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: NEUTRAL.slate }}>
                    Gera ~68 empresas fictícias distribuídas nas 4 unidades, com setor, estado, porte e
                    funil. Preenche os dropdowns do Explorador, Kanban e Executivo para testes.
                  </p>
                </Section>

                <Section
                  title="Dados locais"
                  description="Apagar leads, configurações e sessão armazenados neste navegador."
                >
                  <div
                    className="p-3.5 rounded-lg mb-4 flex items-start gap-2.5 text-xs"
                    style={{ background: NEUTRAL.amber + "15" || "#FFF7ED", borderLeft: `3px solid ${NEUTRAL.amber || "#F59E0B"}`, color: NEUTRAL.amber || "#B45309" }}
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
          <p className="text-sm leading-relaxed" style={{ color: NEUTRAL.graphite }}>
            Esta ação removerá <strong>todos os {leadsCount} leads</strong> do CRM.
            Ela é <strong>irreversível</strong> e não pode ser desfeita.
          </p>
          <div
            className="p-3 rounded-lg text-xs flex items-start gap-2"
            style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}
          >
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            <span>Dados sincronizados com o Supabase serão excluídos do banco de dados permanentemente.</span>
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: NEUTRAL.slate }}>
              Digite <strong style={{ color: NEUTRAL.graphite }}>LIMPAR</strong> para confirmar
            </label>
            <input
              type="text"
              value={clearTyped}
              onChange={e => setClearTyped(e.target.value)}
              placeholder="LIMPAR"
              autoFocus
              className="w-full text-sm rounded-lg border px-3 py-2 outline-none"
              style={{ borderColor: "#E5E7EB", color: NEUTRAL.graphite }}
              onFocus={e => { e.currentTarget.style.borderColor = "#DC2626"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "#E5E7EB"; }}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setClearConfirmOpen(false)}
              className="px-4 py-2 text-sm rounded-lg border"
              style={{ borderColor: "#E5E7EB", color: NEUTRAL.slate, background: "#FFFFFF" }}
            >
              Cancelar
            </button>
            <button
              onClick={handleClearConfirm}
              disabled={clearTyped !== "LIMPAR"}
              className="px-4 py-2 text-sm rounded-lg font-semibold text-white transition-opacity"
              style={{
                background: "#DC2626",
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
