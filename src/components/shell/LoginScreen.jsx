import React, { useState } from "react";
import {
  ArrowRight, ChevronRight, Loader2, Mail, Lock, Eye, EyeOff,
  Shield, BarChart3, Users as UsersIcon, Award, BadgeCheck,
} from "lucide-react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";

const ACCENT_RED = NEUTRAL.red;        // #CC2936
const DARK_BG    = "#1A1414";          // bem escuro pra dar peso industrial
const CREAM      = "#F5F0EA";          // creme do painel direito

// LoginScreen — layout split de 2 colunas. Esquerda: branding institucional
// com foto industrial (gradient como fallback). Direita: form de auth +
// certificações.

export function LoginScreen({
  supabaseEnabled,
  authError,
  authLoading,
  onSignIn,
  onSignUp,
  users,
  onMockLogin,
}) {
  return (
    <div className="min-h-screen flex" style={{ background: CREAM }}>
      {/* Painel esquerdo — só desktop, esconde no mobile pra dar foco no form */}
      <LeftPanel />

      {/* Painel direito */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-6 md:p-10">
          <div className="w-full max-w-md">
            {/* Brand mark */}
            <div className="flex flex-col items-center text-center mb-7">
              <div className="flex items-center gap-3 mb-2">
                <img src="/sanwey-logo.png" alt="Sanwey" className="w-12 h-12" style={{ objectFit: "contain" }} />
                <div className="text-left">
                  <div className="font-bold leading-tight" style={{ fontSize: 22, color: NEUTRAL.graphite, letterSpacing: "-0.02em" }}>
                    Grupo Sanwey
                  </div>
                  <div className="text-xs font-semibold" style={{ color: NEUTRAL.slate, letterSpacing: "0.08em" }}>
                    COMMERCIAL INTELLIGENCE
                  </div>
                </div>
              </div>
              <p className="text-sm max-w-xs leading-relaxed" style={{ color: NEUTRAL.slate }}>
                Plataforma unificada de inteligência comercial para as empresas do Grupo
              </p>
              <span
                className="block mt-3"
                style={{ width: 40, height: 2, background: ACCENT_RED, borderRadius: 1 }}
              />
            </div>

            {supabaseEnabled ? (
              <SupabaseAuthCard
                authError={authError}
                authLoading={authLoading}
                onSignIn={onSignIn}
                onSignUp={onSignUp}
              />
            ) : (
              <MockLoginCard users={users} onMockLogin={onMockLogin} />
            )}
          </div>
        </div>

        <CertificationFooter />
      </div>
    </div>
  );
}

// ── Left panel ─────────────────────────────────────────────────────────────

function LeftPanel() {
  return (
    <div
      className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
      style={{
        background: `
          linear-gradient(135deg, ${DARK_BG}EE 0%, ${DARK_BG}CC 50%, ${DARK_BG}EE 100%),
          radial-gradient(circle at 30% 20%, rgba(204, 41, 54, 0.15), transparent 40%),
          radial-gradient(circle at 80% 80%, rgba(196, 155, 42, 0.08), transparent 40%),
          ${DARK_BG}
        `,
        color: "#FFFFFF",
      }}
    >
      {/* Padrão de fundo: grid sutil */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#FFFFFF 1px, transparent 1px), linear-gradient(90deg, #FFFFFF 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Top: logo */}
      <div className="relative z-10 flex items-center gap-3">
        <img src="/sanwey-logo.png" alt="Sanwey" className="w-12 h-12" style={{ objectFit: "contain" }} />
        <span className="text-2xl italic font-light tracking-tight" style={{ fontFamily: "Georgia, serif" }}>
          Sanwey
        </span>
        <span className="ml-2" style={{ width: 60, height: 1.5, background: ACCENT_RED }} />
      </div>

      {/* Middle: headline */}
      <div className="relative z-10 max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <span
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "#C49B2A", color: DARK_BG }}
          >
            <Award size={18} />
          </span>
          <span style={{ width: 2, height: 50, background: "#C49B2A", opacity: 0.4 }} />
        </div>
        <h1 className="font-bold leading-[1.05] mb-5" style={{ fontSize: 44, letterSpacing: "-0.02em" }}>
          Inteligência<br />
          que <span style={{ color: ACCENT_RED }}>constrói</span><br />
          resultados.
        </h1>
        <span className="block mb-6" style={{ width: 60, height: 3, background: ACCENT_RED }} />
        <p className="text-sm leading-relaxed opacity-80 mb-8">
          Plataforma unificada de inteligência comercial para as empresas do Grupo Sanwey.
        </p>

        <div className="space-y-4">
          <FeatureRow
            icon={Shield}
            iconColor="#CC2936"
            iconBg="rgba(204, 41, 54, 0.18)"
            title="Segurança e Conformidade"
            desc="Seus dados protegidos com os mais altos padrões."
          />
          <FeatureRow
            icon={BarChart3}
            iconColor="#C49B2A"
            iconBg="rgba(196, 155, 42, 0.18)"
            title="Informação que gera valor"
            desc="Dados, análises e ferramentas para decisões melhores."
          />
          <FeatureRow
            icon={UsersIcon}
            iconColor="#3B82F6"
            iconBg="rgba(59, 130, 246, 0.18)"
            title="Acesso integrado"
            desc="Uma única conta para todas as soluções do Grupo."
          />
        </div>
      </div>

      {/* Bottom: trust strip */}
      <div className="relative z-10 flex items-center gap-4 text-xs opacity-70 flex-wrap">
        <span className="flex items-center gap-1.5">
          <BadgeCheck size={13} style={{ color: "#C49B2A" }} />
          Ambiente seguro e monitorado
        </span>
        <span style={{ width: 1, height: 12, background: "#FFFFFF40" }} />
        <span>LGPD Compliant</span>
      </div>
    </div>
  );
}

function FeatureRow({ icon: Icon, iconColor, iconBg, title, desc }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{ background: iconBg, color: iconColor }}
      >
        <Icon size={16} />
      </span>
      <div>
        <div className="font-bold text-sm leading-tight">{title}</div>
        <div className="text-[12px] mt-0.5 opacity-75 leading-snug">{desc}</div>
      </div>
    </div>
  );
}

// ── Right: Supabase auth ───────────────────────────────────────────────────

function SupabaseAuthCard({ authError, authLoading, onSignIn, onSignUp }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [localError, setLocalError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    try {
      if (mode === "signin") {
        await onSignIn(email, password);
      } else {
        if (password.length < 6) {
          setLocalError({ message: "Senha deve ter ao menos 6 caracteres." });
          return;
        }
        await onSignUp(email, password, { name });
      }
    } catch {
      // erro tratado pelo parent via authError
    }
  };

  const err = localError || authError;
  const isSignin = mode === "signin";

  return (
    <div
      className="rounded-2xl p-7 md:p-8"
      style={{
        background: "#FFFFFF",
        border: "1px solid #ECE5DE",
        boxShadow: "0 30px 80px -20px rgba(20, 14, 14, 0.12), 0 8px 16px -8px rgba(20, 14, 14, 0.08)",
      }}
    >
      {/* Lock badge */}
      <div className="flex flex-col items-center mb-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: "#FBEAEC" }}
        >
          <Lock size={22} style={{ color: ACCENT_RED }} />
        </div>
      </div>

      <h2 className="text-center font-bold mb-1" style={{ fontSize: 22, color: NEUTRAL.graphite, letterSpacing: "-0.01em" }}>
        {isSignin ? "Acessar sua conta" : "Criar conta"}
      </h2>
      <p className="text-center text-sm mb-6" style={{ color: NEUTRAL.slate }}>
        {isSignin ? "Entre com seu e-mail e senha para continuar." : "Preencha os dados para criar um acesso."}
      </p>

      <form onSubmit={submit} className="space-y-3.5">
        {!isSignin && (
          <Field
            label="Nome"
            type="text"
            value={name}
            onChange={setName}
            placeholder="Seu nome"
            required
          />
        )}
        <Field
          label="E-mail"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="voce@empresa.com"
          autoComplete="email"
          required
          icon={Mail}
        />
        <PasswordField
          value={password}
          onChange={setPassword}
          autoComplete={isSignin ? "current-password" : "new-password"}
          show={showPwd}
          onToggleShow={() => setShowPwd(v => !v)}
        />

        {isSignin && (
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <CheckBox checked={remember} onChange={setRemember} />
              <span style={{ color: NEUTRAL.graphite }}>Lembrar-me</span>
            </label>
            <button
              type="button"
              className="font-semibold hover:underline"
              style={{ color: ACCENT_RED }}
              onClick={() => alert("Recurso de recuperação ainda não habilitado. Procure o administrador.")}
            >
              Esqueci minha senha
            </button>
          </div>
        )}

        {err && (
          <div
            className="text-xs px-3.5 py-2.5 rounded-lg"
            style={{ background: "#FEE2E2", color: "#991B1B", border: "1px solid #FCA5A5" }}
          >
            {err.message || "Não foi possível autenticar. Tente novamente."}
          </div>
        )}

        <button
          type="submit"
          disabled={authLoading}
          className="w-full p-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60 mt-2"
          style={{ background: ACCENT_RED, fontSize: 15, boxShadow: "0 6px 16px -4px rgba(204, 41, 54, 0.45)" }}
          onMouseEnter={e => { if (!authLoading) e.currentTarget.style.filter = "brightness(0.92)"; }}
          onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
        >
          {authLoading ? <Loader2 size={16} className="animate-spin" /> : null}
          {isSignin ? "Entrar" : "Criar conta"}
          {!authLoading && <ArrowRight size={16} />}
        </button>
      </form>

      <div className="mt-5 text-xs text-center" style={{ color: NEUTRAL.slate }}>
        {isSignin ? (
          <>
            Não tem conta?{" "}
            <button
              type="button"
              onClick={() => { setMode("signup"); setLocalError(null); }}
              className="font-bold underline underline-offset-2 transition-opacity hover:opacity-70"
              style={{ color: ACCENT_RED }}
            >
              Criar conta
            </button>
          </>
        ) : (
          <>
            Já tem conta?{" "}
            <button
              type="button"
              onClick={() => { setMode("signin"); setLocalError(null); }}
              className="font-bold underline underline-offset-2 transition-opacity hover:opacity-70"
              style={{ color: ACCENT_RED }}
            >
              Entrar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Form atoms ──────────────────────────────────────────────────────────────

function Field({ label, type, value, onChange, placeholder, autoComplete, required, icon: Icon }) {
  const [focused, setFocused] = useState(false);
  const borderColor = focused ? ACCENT_RED : "#E0D6CB";
  return (
    <label className="block">
      <div className="text-xs font-semibold mb-1.5" style={{ color: NEUTRAL.graphite }}>
        {label}
      </div>
      <div
        className="flex items-center gap-2 rounded-xl border px-3.5 py-2.5 transition-all"
        style={{
          borderColor,
          background: "#FFFFFF",
          boxShadow: focused ? `0 0 0 3px ${ACCENT_RED}22` : "none",
        }}
      >
        {Icon && <Icon size={15} style={{ color: NEUTRAL.slate }} />}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="flex-1 outline-none text-sm bg-transparent"
          style={{ color: NEUTRAL.graphite }}
        />
      </div>
    </label>
  );
}

function PasswordField({ value, onChange, autoComplete, show, onToggleShow }) {
  const [focused, setFocused] = useState(false);
  const borderColor = focused ? ACCENT_RED : "#E0D6CB";
  return (
    <label className="block">
      <div className="text-xs font-semibold mb-1.5" style={{ color: NEUTRAL.graphite }}>
        Senha
      </div>
      <div
        className="flex items-center gap-2 rounded-xl border px-3.5 py-2.5 transition-all"
        style={{
          borderColor,
          background: "#FFFFFF",
          boxShadow: focused ? `0 0 0 3px ${ACCENT_RED}22` : "none",
        }}
      >
        <Lock size={15} style={{ color: NEUTRAL.slate }} />
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="••••••••"
          autoComplete={autoComplete}
          required
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="flex-1 outline-none text-sm bg-transparent"
          style={{ color: NEUTRAL.graphite }}
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="p-0.5 cursor-pointer"
          style={{ color: NEUTRAL.slate }}
          tabIndex={-1}
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </label>
  );
}

function CheckBox({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      role="checkbox"
      aria-checked={checked}
      className="w-4 h-4 rounded flex items-center justify-center transition-colors cursor-pointer shrink-0"
      style={{
        background: checked ? ACCENT_RED : "#FFFFFF",
        border: `1.5px solid ${checked ? ACCENT_RED : "#D4D4D4"}`,
      }}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M2 6.5L4.5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

// ── Mock mode ───────────────────────────────────────────────────────────────

function MockLoginCard({ users, onMockLogin }) {
  return (
    <div
      className="rounded-2xl p-7"
      style={{
        background: "#FFFFFF",
        border: "1px solid #ECE5DE",
        boxShadow: "0 30px 80px -20px rgba(20, 14, 14, 0.12)",
      }}
    >
      <h2 className="font-bold text-center mb-1" style={{ fontSize: 20, color: NEUTRAL.graphite }}>
        Selecione seu perfil
      </h2>
      <p className="text-center text-sm mb-5" style={{ color: NEUTRAL.slate }}>
        Modo demo — configure Supabase para autenticação real.
      </p>
      <div className="space-y-2">
        {users.map(u => {
          const companies = u.companies.map(id => COMPANIES[id]?.short).filter(Boolean);
          return (
            <button
              key={u.id}
              onClick={() => onMockLogin(u)}
              className="w-full p-3 rounded-xl border flex items-center gap-3 transition-all duration-150 text-left cursor-pointer"
              style={{
                borderColor: "#ECE5DE",
                background: "#FFFFFF",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = ACCENT_RED;
                e.currentTarget.style.background = "#FFF7F8";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "#ECE5DE";
                e.currentTarget.style.background = "#FFFFFF";
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shrink-0"
                style={{ background: u.avatarBg, fontSize: 13 }}
              >
                {u.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm" style={{ color: NEUTRAL.graphite }}>{u.name}</div>
                <div className="text-xs mt-0.5" style={{ color: NEUTRAL.slate }}>
                  {u.role === "gerente" ? "Gerente Comercial" : "Vendedor"} ·{" "}
                  {u.role === "gerente" ? "Acesso total" : companies.join(" · ")}
                </div>
              </div>
              <ChevronRight size={15} color={NEUTRAL.slate} style={{ opacity: 0.5 }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Certificações no rodapé ─────────────────────────────────────────────────

function CertificationFooter() {
  return (
    <div
      className="border-t px-6 md:px-10 py-4 text-[10px] uppercase"
      style={{ borderColor: "#E0D6CB", color: NEUTRAL.slate, letterSpacing: "0.06em" }}
    >
      <div className="flex items-center justify-around flex-wrap gap-4">
        <CertItem title="Homologação" subtitle="INMETRO desde 2008" />
        <CertItem title="ISO 9001:2015" subtitle="FSSC 22000 · ANP" />
        <CertItem title="Res. ANTT · ABNT NBR 16029" subtitle="Ministério da Marinha" />
        <CertItem title="Fabricado" subtitle="Sob encomenda" />
      </div>
    </div>
  );
}

function CertItem({ title, subtitle }) {
  return (
    <div className="flex items-center gap-2 text-center">
      <BadgeCheck size={14} style={{ color: ACCENT_RED, opacity: 0.7 }} />
      <div className="text-left">
        <div className="font-bold leading-tight" style={{ color: NEUTRAL.graphite, fontSize: 9 }}>{title}</div>
        <div className="leading-tight" style={{ fontSize: 9 }}>{subtitle}</div>
      </div>
    </div>
  );
}

export default LoginScreen;
