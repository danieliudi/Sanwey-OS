import React, { useState } from "react";
import {
  ArrowRight, ChevronRight, Loader2, Mail, Lock, Eye, EyeOff,
  Heart, ShieldCheck, BarChart3, Globe, ChevronDown,
  Megaphone, Calendar, BookOpen, Headphones, CheckCircle2, KeyRound,
} from "lucide-react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";

const ACCENT_RED = "#b5000b";   // primary DS
const DARK_BG    = "#1A1414";   // painel esquerdo
const CREAM      = "#fff8f7";   // surface

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
    <div className="min-h-screen flex" style={{ background: CREAM }}>
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
              <div className="text-xs font-semibold uppercase mb-3" style={{ color: NEUTRAL.slate, letterSpacing: "0.12em" }}>
                Commercial Intelligence
              </div>
              <p className="text-sm max-w-xs leading-relaxed" style={{ color: NEUTRAL.slate }}>
                Plataforma unificada de inteligência comercial<br />para as empresas do Grupo
              </p>
              <span className="block mt-3" style={{ width: 36, height: 2, background: ACCENT_RED, borderRadius: 1 }} />
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
      style={{ background: "#FFFFFF", borderColor: "#E5E7EB", color: NEUTRAL.graphite }}
      onMouseEnter={e => { e.currentTarget.style.background = "#F8F4EF"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "#FFFFFF"; }}
      title="Idioma (em breve)"
    >
      <Globe size={13} style={{ color: NEUTRAL.slate }} />
      Português (BR)
      <ChevronDown size={12} style={{ color: NEUTRAL.slate }} />
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
        setLocalError({ message: err?.message || "Não foi possível enviar o e-mail." });
      } finally {
        setRecoveryLoading(false);
      }
      return;
    }
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
      // parent trata via authError
    }
  };

  const err = localError || (mode !== "recovery" ? authError : null);
  const isSignin = mode === "signin";

  return (
    <div
      className="rounded-2xl p-7 md:p-8"
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        boxShadow: "0 30px 80px -20px rgba(20, 14, 14, 0.10), 0 8px 16px -8px rgba(20, 14, 14, 0.06)",
      }}
    >
      {/* Lock badge */}
      <div className="flex flex-col items-center mb-3">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: "#FBEAEC" }}
        >
          <Lock size={22} style={{ color: ACCENT_RED }} />
        </div>
      </div>

      <h2 className="text-center font-bold mb-1" style={{ fontSize: 22, color: NEUTRAL.graphite, letterSpacing: "-0.01em" }}>
        {mode === "recovery" ? "Recuperar senha" : isSignin ? "Acessar sua conta" : "Criar conta"}
      </h2>
      <p className="text-center text-sm mb-5" style={{ color: NEUTRAL.slate }}>
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
            style={{ color: ACCENT_RED }}
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
              <span style={{ color: NEUTRAL.graphite }}>Lembrar-me</span>
            </label>
            <button
              type="button"
              className="font-semibold hover:underline"
              style={{ color: ACCENT_RED }}
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
            {err.message || "Não foi possível autenticar. Tente novamente."}
          </div>
        )}

        {!recoverySent && (
          <button
            type="submit"
            disabled={authLoading || recoveryLoading}
            className="w-full p-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60 mt-2"
            style={{ background: ACCENT_RED, fontSize: 15, boxShadow: "0 6px 16px -4px rgba(200, 32, 46, 0.4)" }}
            onMouseEnter={e => { if (!authLoading && !recoveryLoading) e.currentTarget.style.filter = "brightness(0.92)"; }}
            onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
          >
            {(authLoading || recoveryLoading) ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            {mode === "recovery" ? "Enviar link de recuperação" : isSignin ? "Entrar" : "Criar conta"}
            {!authLoading && !recoveryLoading && mode !== "recovery" && <ArrowRight size={16} />}
          </button>
        )}
      </form>

      <div className="mt-5 text-xs text-center" style={{ color: NEUTRAL.slate }}>
        {mode === "recovery" ? (
          <button
            type="button"
            onClick={() => { setMode("signin"); setLocalError(null); setRecoverySent(false); }}
            className="font-bold underline underline-offset-2 transition-opacity hover:opacity-70"
            style={{ color: ACCENT_RED }}
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

// ── Password reset screen (shown after clicking recovery email link) ─────────

export function PasswordResetScreen({ onReset }) {
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
      setError(err?.message || "Não foi possível redefinir a senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: CREAM }}>
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", boxShadow: "0 20px 60px -20px rgba(20,14,14,0.12)" }}
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: "#FBEAEC" }}>
            <KeyRound size={22} style={{ color: ACCENT_RED }} />
          </div>
          <h2 className="font-bold text-center" style={{ fontSize: 22, color: NEUTRAL.graphite }}>
            Redefinir senha
          </h2>
          <p className="text-sm text-center mt-1" style={{ color: NEUTRAL.slate }}>
            Escolha uma nova senha para sua conta.
          </p>
        </div>

        {done ? (
          <div className="rounded-xl p-5 flex flex-col items-center gap-3 text-center" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
            <CheckCircle2 size={32} style={{ color: "#16A34A" }} />
            <div className="font-semibold" style={{ color: "#15803D" }}>Senha redefinida com sucesso!</div>
            <div className="text-xs" style={{ color: "#166534" }}>Você será redirecionado automaticamente.</div>
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
              className="w-full p-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              style={{ background: ACCENT_RED, fontSize: 15 }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Salvar nova senha
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
  const borderColor = focused ? ACCENT_RED : "#E5E7EB";
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
          boxShadow: focused ? `0 0 0 3px ${ACCENT_RED}1A` : "none",
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

function PasswordField({ value, onChange, autoComplete, show, onToggleShow, label = "Senha" }) {
  const [focused, setFocused] = useState(false);
  const borderColor = focused ? ACCENT_RED : "#E5E7EB";
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
          boxShadow: focused ? `0 0 0 3px ${ACCENT_RED}1A` : "none",
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
        border: `1.5px solid ${checked ? ACCENT_RED : "#E5E7EB"}`,
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
        border: "1px solid #E5E7EB",
        boxShadow: "0 30px 80px -20px rgba(20, 14, 14, 0.10)",
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
              style={{ borderColor: "#E5E7EB", background: "#FFFFFF" }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = ACCENT_RED;
                e.currentTarget.style.background = "#FFF7F8";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "#E5E7EB";
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

// ── Barra inferior de recursos ──────────────────────────────────────────────

function ResourceFooter() {
  return (
    <div className="px-6 md:px-10 pb-6">
      <div
        className="rounded-2xl border p-4 grid grid-cols-2 md:grid-cols-4 gap-4"
        style={{ background: "#FFFFFF", borderColor: "#E5E7EB" }}
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
      <Icon size={20} strokeWidth={1.5} style={{ color: NEUTRAL.slate, marginTop: 2 }} className="shrink-0" />
      <div className="min-w-0">
        <div className="text-xs font-bold leading-tight mb-1" style={{ color: NEUTRAL.graphite }}>
          {title}
        </div>
        <div className="text-[11px] leading-snug" style={{ color: NEUTRAL.slate }}>
          {desc}
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;
