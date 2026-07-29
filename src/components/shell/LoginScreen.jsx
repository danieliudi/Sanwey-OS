import React, { useState } from "react";
import {
  ArrowRight, ChevronRight, Loader2, Mail, Lock, Eye, EyeOff,
  Heart, ShieldCheck, BarChart3, Globe, ChevronDown,
  Megaphone, Calendar, BookOpen, Headphones, CheckCircle2, KeyRound,
} from "lucide-react";
import { COMPANIES } from "../../constants/companies";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";

// Traduz as mensagens de erro mais comuns do Supabase Auth (vêm em inglês
// da API) — achado da auditoria: o resto da UI é 100% PT-BR, mas esses
// erros apareciam crus. Sem correspondência, mantém a mensagem original.
const AUTH_ERROR_TRANSLATIONS = [
  [/invalid login credentials/i,                    "E-mail ou senha incorretos."],
  [/user already registered/i,                       "Este e-mail já está cadastrado."],
  [/email not confirmed/i,                           "E-mail ainda não confirmado — verifique sua caixa de entrada."],
  [/password should be at least (\d+) characters/i,  (m) => `A senha deve ter ao menos ${m[1]} caracteres.`],
  [/unable to validate email address/i,              "Formato de e-mail inválido."],
  [/new password should be different from the old password/i, "A nova senha deve ser diferente da anterior."],
  [/for security purposes, you can only request this after (\d+) seconds/i, (m) => `Aguarde ${m[1]} segundos antes de tentar de novo.`],
  [/email rate limit exceeded/i,                     "Muitas tentativas — aguarde um pouco antes de tentar de novo."],
  [/token has expired or is invalid/i,                "O link expirou ou é inválido — solicite um novo."],
];

function translateAuthError(message) {
  if (!message) return message;
  for (const [pattern, replacement] of AUTH_ERROR_TRANSLATIONS) {
    const m = message.match(pattern);
    if (m) return typeof replacement === "function" ? replacement(m) : replacement;
  }
  return message;
}

const ACCENT_RED = "#C7212B";   // usado APENAS no painel esquerdo institucional (fundo escuro)
const DARK_BG    = "#1A1414";   // painel esquerdo
const ACCENT     = "var(--accent)";     // painel direito — token white-label
const ACCENT_RING = "rgba(55,53,47,0.10)";

// LoginScreen com layout split institucional, espelhando o mockup novo:
// - Esquerda escura com watermark grande do logo, headline e valores
// - Direita creme com form + barra inferior de atalhos

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
    <div className="min-h-screen flex" style={{ background: "var(--bg)" }}>
      <LeftPanel />

      <div className="flex-1 flex flex-col relative">
        {/* Top-right: language selector */}
        <div className="absolute top-4 right-4 md:top-6 md:right-6 z-10">
          <LangSelector />
        </div>

        <div className="flex-1 flex items-center justify-center p-6 md:p-10 pt-16 md:pt-10">
          <div className="w-full max-w-md">
            {/* Brand mark — logo institucional completo já inclui símbolo,
                wordmark "Sanwey", "desde 1984" e tagline */}
            <div className="flex flex-col items-center text-center mb-6">
              <img
                src="/sanwey-logo.png"
                alt="Sanwey — A marca que valoriza o seu produto"
                style={{ width: 260, height: "auto", objectFit: "contain" }}
                className="mb-3"
              />
              <div className="text-xs font-semibold uppercase mb-3" style={{ color: "var(--text-dim)", letterSpacing: "0.12em" }}>
                Gestão Sanwey
              </div>
              <p className="text-sm max-w-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>
                Plataforma unificada de inteligência comercial<br />para as empresas do Grupo
              </p>
              <span className="block mt-3" style={{ width: 36, height: 2, background: "var(--accent)", borderRadius: 1 }} />
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

        <ResourceFooter />
      </div>
    </div>
  );
}

// ── Left panel ─────────────────────────────────────────────────────────────

function LeftPanel() {
  return (
    <div
      className="hidden lg:flex lg:w-[30%] flex-col justify-between p-12 relative overflow-hidden"
      style={{ background: DARK_BG, color: "#FFFFFF" }}
    >
      {/* Watermark grande do símbolo no fundo (atrás de tudo, opacidade baixa).
          Usamos o símbolo (não o logo completo) porque o texto institucional
          do logo é preto e ficaria invisível sobre o fundo escuro mesmo
          com opacidade baixa. */}
      <img
        src="/sanwey-simbolo.png"
        alt=""
        aria-hidden
        className="absolute pointer-events-none select-none"
        style={{
          width: 580,
          height: 580,
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          opacity: 0.05,
          filter: "grayscale(1) brightness(2)",
        }}
      />

      {/* Middle: headline + features */}
      <div className="relative z-10 max-w-md">
        <p className="text-sm mb-3" style={{ opacity: 0.85 }}>
          Bem-vindo(a) <span style={{ color: ACCENT_RED, fontWeight: 700 }}>de volta!</span>
        </p>
        <h1 className="font-bold leading-[1.1] mb-10" style={{ fontSize: 42, letterSpacing: "-0.02em" }}>
          Vamos juntos<br />
          construir o<br />
          <span style={{ color: ACCENT_RED }}>futuro.</span>
        </h1>

        <div className="space-y-0">
          <ValuePoint
            icon={Heart}
            title="Um só time"
            desc="Colaboração e confiança que fortalecem nossos resultados."
          />
          <Divider />
          <ValuePoint
            icon={ShieldCheck}
            title="Segurança em primeiro lugar"
            desc="Seus dados e informações protegidos com os mais altos padrões."
          />
          <Divider />
          <ValuePoint
            icon={BarChart3}
            title="Informação que impulsiona"
            desc="Ferramentas e dados para decisões mais assertivas."
          />
        </div>
      </div>

      {/* Bottom: valores */}
      <div className="relative z-10 text-xs" style={{ opacity: 0.9 }}>
        <div className="flex items-center gap-2 mb-1">
          <Heart size={13} style={{ color: ACCENT_RED, fill: ACCENT_RED }} />
          <span className="font-semibold">Respeito • Integridade • Excelência • Pioneirismo</span>
        </div>
        <div style={{ opacity: 0.65 }}>
          Esses são os valores que nos conectam.
        </div>
      </div>
    </div>
  );
}

function ValuePoint({ icon: Icon, title, desc }) {
  return (
    <div className="flex items-start gap-3 py-4">
      <span
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: "rgba(200, 32, 46, 0.12)", color: ACCENT_RED }}
      >
        <Icon size={17} />
      </span>
      <div>
        <div className="font-bold text-[15px] leading-tight mb-1">{title}</div>
        <div className="text-[12.5px] leading-snug" style={{ opacity: 0.7 }}>{desc}</div>
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "#FFFFFF12" }} />;
}

// ── Language selector (cosmético por enquanto) ─────────────────────────────

function LangSelector() {
  return (
    <button
      type="button"
      className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium cursor-pointer transition-colors"
      style={{ background: "#FFFFFF", borderColor: "#E5E7EB", color: "var(--text)" }}
      onMouseEnter={e => { e.currentTarget.style.background = "#F8F4EF"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "#FFFFFF"; }}
      title="Idioma (em breve)"
    >
      <Globe size={13} style={{ color: "var(--text-dim)" }} />
      Português (BR)
      <ChevronDown size={12} style={{ color: "var(--text-dim)" }} />
    </button>
  );
}

// ── Right: Supabase auth ───────────────────────────────────────────────────

function SupabaseAuthCard({ authError, authLoading, onSignIn, onSignUp }) {
  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "recovery"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [localError, setLocalError] = useState(null);
  const [recoverySent, setRecoverySent] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    if (mode === "recovery") {
      if (!email.trim()) return;
      setRecoveryLoading(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setRecoverySent(true);
      } catch (err) {
        setLocalError({ message: translateAuthError(err?.message) || "Não foi possível enviar o e-mail." });
      } finally {
        setRecoveryLoading(false);
      }
      return;
    }
    try {
      if (mode === "signin") {
        try { window.localStorage.setItem("sanwey-remember-me", String(remember)); } catch {}
        await onSignIn(email, password);
      } else {
        if (password.length < 6) {
          setLocalError({ message: "Senha deve ter ao menos 6 caracteres." });
          return;
        }
        await onSignUp(email, password, { name });
      }
    } catch {
      // parent trata via authError
    }
  };

  const err = localError || (mode !== "recovery" ? authError : null);
  const isSignin = mode === "signin";

  return (
    <div
      className="rounded-lg p-7 md:p-8"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-pop)",
      }}
    >
      {/* Lock badge */}
      <div className="flex flex-col items-center mb-3">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: "var(--surface-alt)" }}
        >
          <Lock size={22} style={{ color: "var(--text-dim)" }} />
        </div>
      </div>

      <h2 className="text-center font-bold mb-1" style={{ fontSize: 22, color: "var(--text)", letterSpacing: "-0.01em" }}>
        {mode === "recovery" ? "Recuperar senha" : isSignin ? "Acessar sua conta" : "Criar conta"}
      </h2>
      <p className="text-center text-sm mb-5" style={{ color: "var(--text-dim)" }}>
        {mode === "recovery"
          ? "Informe seu e-mail e enviaremos um link para redefinir a senha."
          : isSignin
            ? "Entre com seu e-mail e senha para continuar."
            : "Preencha os dados para criar um acesso."}
      </p>

      {/* Recovery: success state */}
      {mode === "recovery" && recoverySent && (
        <div
          className="rounded-xl p-4 flex flex-col items-center gap-2 text-center mb-4"
          style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}
        >
          <CheckCircle2 size={28} style={{ color: "#16A34A" }} />
          <div className="font-semibold text-sm" style={{ color: "#15803D" }}>E-mail enviado!</div>
          <div className="text-xs" style={{ color: "#166534" }}>
            Verifique sua caixa de entrada em <strong>{email}</strong> e clique no link para redefinir a senha.
          </div>
          <button
            type="button"
            onClick={() => { setMode("signin"); setRecoverySent(false); setLocalError(null); }}
            className="mt-1 text-xs font-semibold underline"
            style={{ color: ACCENT }}
          >
            Voltar ao login
          </button>
        </div>
      )}

      <form onSubmit={submit} className="space-y-3.5">
        {mode === "recovery" && !recoverySent && (
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
        )}
        {mode !== "recovery" && (
          <>
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
          </>
        )}

        {isSignin && mode !== "recovery" && (
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <CheckBox checked={remember} onChange={setRemember} />
              <span style={{ color: "var(--text-dim)" }}>Lembrar-me</span>
            </label>
            <button
              type="button"
              className="font-semibold hover:underline"
              style={{ color: ACCENT }}
              onClick={() => { setMode("recovery"); setLocalError(null); setRecoverySent(false); }}
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
            {translateAuthError(err.message) || "Não foi possível autenticar. Tente novamente."}
          </div>
        )}

        {!recoverySent && (
          <button
            type="submit"
            disabled={authLoading || recoveryLoading}
            className="w-full p-3.5 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60 mt-2"
            style={{ background: ACCENT, fontSize: 15, color: "var(--surface)" }}
            onMouseEnter={e => { if (!authLoading && !recoveryLoading) e.currentTarget.style.background = "var(--accent-hover)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = ACCENT; }}
          >
            {(authLoading || recoveryLoading) ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            {mode === "recovery" ? "Enviar link de recuperação" : isSignin ? "Entrar" : "Criar conta"}
            {!authLoading && !recoveryLoading && mode !== "recovery" && <ArrowRight size={16} />}
          </button>
        )}
      </form>

      <div className="mt-5 text-xs text-center" style={{ color: "var(--text-dim)" }}>
        {mode === "recovery" ? (
          <button
            type="button"
            onClick={() => { setMode("signin"); setLocalError(null); setRecoverySent(false); }}
            className="font-bold underline underline-offset-2 transition-opacity hover:opacity-70"
            style={{ color: ACCENT }}
          >
            ← Voltar ao login
          </button>
        ) : isSignin ? (
          <>
            Não tem conta?{" "}
            <button
              type="button"
              onClick={() => { setMode("signup"); setLocalError(null); }}
              className="font-bold underline underline-offset-2 transition-opacity hover:opacity-70"
              style={{ color: ACCENT }}
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
              style={{ color: ACCENT }}
            >
              Entrar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Password reset / primeiro login via convite ───────────────────────────────
// Mesmo shell pros dois casos (variant="recovery" | "invite") — o convite não
// dispara PASSWORD_RECOVERY (só "type=recovery" faz isso), então quem aceita
// convite hoje cai direto no painel de trabalho sem nunca definir senha.
// Reaproveita a tela de "Redefinir senha" (mesmo ícone/tom, só muda o texto),
// em vez de nascer uma tela nova do zero — mockup aprovado (opção A).

const PASSWORD_SCREEN_COPY = {
  recovery: {
    title: "Redefinir senha",
    subtitle: "Escolha uma nova senha para sua conta.",
    submitLabel: "Salvar nova senha",
    doneTitle: "Senha redefinida com sucesso!",
    doneSubtitle: "Você será redirecionado automaticamente.",
  },
  invite: {
    title: "Defina sua senha",
    subtitle: "Seu acesso à Sanwey Gestão já está liberado.",
    submitLabel: "Definir senha e entrar",
    doneTitle: "Tudo pronto!",
    doneSubtitle: "Você será levado(a) direto pro seu painel de trabalho.",
  },
};

export function PasswordResetScreen({ onReset, variant = "recovery" }) {
  const copy = PASSWORD_SCREEN_COPY[variant] || PASSWORD_SCREEN_COPY.recovery;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError("Senha deve ter ao menos 6 caracteres."); return; }
    if (password !== confirm) { setError("As senhas não coincidem."); return; }
    setLoading(true);
    try {
      await onReset(password);
      setDone(true);
    } catch (err) {
      setError(translateAuthError(err?.message) || "Não foi possível salvar a senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg)" }}>
      <div
        className="w-full max-w-md rounded-lg p-8"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-pop)" }}
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--surface-alt)" }}>
            <KeyRound size={22} style={{ color: "var(--text-dim)" }} />
          </div>
          <h2 className="font-bold text-center" style={{ fontSize: 22, color: "var(--text)" }}>
            {copy.title}
          </h2>
          <p className="text-sm text-center mt-1" style={{ color: "var(--text-dim)" }}>
            {copy.subtitle}
          </p>
        </div>

        {done ? (
          <div className="rounded-xl p-5 flex flex-col items-center gap-3 text-center" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
            <CheckCircle2 size={32} style={{ color: "#16A34A" }} />
            <div className="font-semibold" style={{ color: "#15803D" }}>{copy.doneTitle}</div>
            <div className="text-xs" style={{ color: "#166534" }}>{copy.doneSubtitle}</div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <PasswordField
              label="Nova senha"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              show={showPwd}
              onToggleShow={() => setShowPwd(v => !v)}
            />
            <PasswordField
              label="Confirmar senha"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              show={showPwd}
              onToggleShow={() => setShowPwd(v => !v)}
            />
            {error && (
              <div className="text-xs px-3.5 py-2.5 rounded-lg" style={{ background: "#FEE2E2", color: "#991B1B", border: "1px solid #FCA5A5" }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full p-3.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              style={{ background: ACCENT, color: "var(--surface)", fontSize: 15 }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "var(--accent-hover)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = ACCENT; }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {copy.submitLabel}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Form atoms ──────────────────────────────────────────────────────────────

function Field({ label, type, value, onChange, placeholder, autoComplete, required, icon: Icon }) {
  const [focused, setFocused] = useState(false);
  return (
    <label className="block">
      <div className="text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>
        {label}
      </div>
      <div
        className="flex items-center gap-2 rounded-sm border px-3.5 py-2.5 transition-all"
        style={{
          borderColor: focused ? "var(--accent)" : "var(--border-strong)",
          background: "var(--surface)",
          boxShadow: focused ? `0 0 0 3px ${ACCENT_RING}` : "none",
        }}
      >
        {Icon && <Icon size={15} style={{ color: "var(--text-faint)" }} />}
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
          style={{ color: "var(--text)" }}
        />
      </div>
    </label>
  );
}

function PasswordField({ value, onChange, autoComplete, show, onToggleShow, label = "Senha" }) {
  const [focused, setFocused] = useState(false);
  return (
    <label className="block">
      <div className="text-xs font-semibold mb-1.5" style={{ color: "var(--text)" }}>
        {label}
      </div>
      <div
        className="flex items-center gap-2 rounded-sm border px-3.5 py-2.5 transition-all"
        style={{
          borderColor: focused ? "var(--accent)" : "var(--border-strong)",
          background: "var(--surface)",
          boxShadow: focused ? `0 0 0 3px ${ACCENT_RING}` : "none",
        }}
      >
        <Lock size={15} style={{ color: "var(--text-faint)" }} />
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
          style={{ color: "var(--text)" }}
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="p-0.5 cursor-pointer"
          style={{ color: "var(--text-faint)" }}
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
        background: checked ? "var(--accent)" : "var(--surface)",
        border: `1.5px solid ${checked ? "var(--accent)" : "var(--border-strong)"}`,
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
      className="rounded-lg p-7"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-pop)",
      }}
    >
      <h2 className="font-bold text-center mb-1" style={{ fontSize: 20, color: "var(--text)" }}>
        Selecione seu perfil
      </h2>
      <p className="text-center text-sm mb-5" style={{ color: "var(--text-dim)" }}>
        Modo demo — configure Supabase para autenticação real.
      </p>
      <div className="space-y-2">
        {users.map(u => {
          const companies = u.companies.map(id => COMPANIES[id]?.short).filter(Boolean);
          return (
            <button
              key={u.id}
              onClick={() => onMockLogin(u)}
              className="w-full p-3 rounded-sm border flex items-center gap-3 transition-all duration-150 text-left cursor-pointer"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = "var(--border-strong)";
                e.currentTarget.style.background = "var(--surface-alt)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.background = "var(--surface)";
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shrink-0"
                style={{ background: u.avatarBg, fontSize: 13 }}
              >
                {u.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm" style={{ color: "var(--text)" }}>{u.name}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
                  {u.role === "gerente" ? "Gerente Comercial" : "Vendedor"} ·{" "}
                  {u.role === "gerente" ? "Acesso total" : companies.join(" · ")}
                </div>
              </div>
              <ChevronRight size={15} style={{ color: "var(--text-faint)", opacity: 0.7 }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Barra inferior de recursos ──────────────────────────────────────────────

function ResourceFooter() {
  return (
    <div className="px-6 md:px-10 pb-6">
      <div
        className="rounded-lg border p-4 grid grid-cols-2 md:grid-cols-4 gap-4"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <ResourceItem
          icon={Megaphone}
          title="Comunicação interna"
          desc="Fique por dentro das novidades e comunicados importantes."
        />
        <ResourceItem
          icon={Calendar}
          title="Agenda & Eventos"
          desc="Acompanhe eventos, reuniões e treinamentos."
        />
        <ResourceItem
          icon={BookOpen}
          title="Políticas & Processos"
          desc="Acesse documentos, políticas e manuais do Grupo."
        />
        <ResourceItem
          icon={Headphones}
          title="Suporte interno"
          desc="Precisa de ajuda? Abra sua solicitação de forma rápida."
        />
      </div>
    </div>
  );
}

function ResourceItem({ icon: Icon, title, desc }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={20} strokeWidth={1.5} style={{ color: "var(--text-faint)", marginTop: 2 }} className="shrink-0" />
      <div className="min-w-0">
        <div className="text-xs font-bold leading-tight mb-1" style={{ color: "var(--text)" }}>
          {title}
        </div>
        <div className="text-[11px] leading-snug" style={{ color: "var(--text-dim)" }}>
          {desc}
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;
