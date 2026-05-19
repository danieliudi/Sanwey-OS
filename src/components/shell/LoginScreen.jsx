import React, { useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { COMPANIES, NEUTRAL } from "../../constants/companies";

// Two modes:
//   - Supabase configured → email/password form wired to `useSupabaseAuth`.
//   - Not configured → legacy user-picker (mock mode) so the app still runs
//     without a backend, which is useful for design review and screenshots.
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
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: `linear-gradient(135deg, ${NEUTRAL.graphite} 0%, ${NEUTRAL.graphite}dd 100%)` }}
    >
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <img
              src="/sanwey-logo.png"
              alt="Sanwey"
              className="w-14 h-14 rounded-2xl"
              style={{
                background: "#FFFFFF",
                padding: 6,
                objectFit: "contain",
                boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
              }}
            />
            <div className="text-left">
              <div className="font-bold text-white" style={{ fontSize: 24, letterSpacing: "-0.02em" }}>
                Grupo Sanwey
              </div>
              <div className="text-white/60 text-xs font-medium" style={{ letterSpacing: "0.06em" }}>
                Comercial Intelligence
              </div>
            </div>
          </div>
          <p className="text-white/70 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
            Plataforma unificada de inteligência comercial para as empresas do Grupo
          </p>
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
  );
}

function SupabaseAuthCard({ authError, authLoading, onSignIn, onSignUp }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
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
    } catch (err) {
      // swallowed — the parent hook already surfaces it via authError
    }
  };

  const err = localError || authError;

  return (
    <div
      className="rounded-2xl p-7"
      style={{ background: "#FFFFFF", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
    >
      <div className="mb-5">
        <h2 className="font-bold" style={{ fontSize: 18, color: NEUTRAL.graphite, letterSpacing: "-0.01em" }}>
          {mode === "signin" ? "Acessar sua conta" : "Criar conta"}
        </h2>
        <p className="text-sm mt-1" style={{ color: NEUTRAL.slate }}>
          {mode === "signin" ? "Entre com e-mail e senha." : "Preencha os dados para criar um acesso."}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {mode === "signup" && (
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
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="voce@empresa.com"
          autoComplete="email"
          required
        />
        <Field
          label="Senha"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          required
        />

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
          className="w-full p-3 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60"
          style={{ background: NEUTRAL.graphite, fontSize: 14 }}
          onMouseEnter={e => { if (!authLoading) e.currentTarget.style.filter = "brightness(0.88)"; }}
          onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
          onMouseDown={e => { e.currentTarget.style.filter = "brightness(0.80)"; }}
          onMouseUp={e => { e.currentTarget.style.filter = "brightness(0.88)"; }}
        >
          {authLoading ? <Loader2 size={16} className="animate-spin" /> : null}
          {mode === "signin" ? "Entrar" : "Criar conta"}
        </button>
      </form>

      <div
        className="mt-5 pt-4 border-t text-xs text-center"
        style={{ borderColor: "#F0F0F0", color: NEUTRAL.slate }}
      >
        {mode === "signin" ? (
          <>
            Não tem conta?{" "}
            <button
              type="button"
              onClick={() => { setMode("signup"); setLocalError(null); }}
              className="font-semibold underline underline-offset-2 transition-opacity hover:opacity-70"
              style={{ color: NEUTRAL.graphite }}
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
              className="font-semibold underline underline-offset-2 transition-opacity hover:opacity-70"
              style={{ color: NEUTRAL.graphite }}
            >
              Entrar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange, placeholder, autoComplete, required }) {
  const [focused, setFocused] = useState(false);
  return (
    <label className="block">
      <div className="text-xs font-semibold mb-1.5" style={{ color: NEUTRAL.slate }}>
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full px-3.5 py-2.5 rounded-lg border text-sm outline-none transition-all"
        style={{
          borderColor: focused ? NEUTRAL.graphite : "#D4D4D4",
          boxShadow: focused ? `0 0 0 3px ${NEUTRAL.graphite}18` : "none",
          color: NEUTRAL.graphite,
          background: "#FAFAF8",
        }}
      />
    </label>
  );
}

function MockLoginCard({ users, onMockLogin }) {
  return (
    <div
      className="rounded-2xl p-7"
      style={{ background: "#FFFFFF", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
    >
      <div className="mb-5">
        <h2 className="font-bold" style={{ fontSize: 18, color: NEUTRAL.graphite, letterSpacing: "-0.01em" }}>
          Selecione seu perfil
        </h2>
        <p className="text-sm mt-1" style={{ color: NEUTRAL.slate }}>
          Modo demo — configure Supabase para autenticação real.
        </p>
      </div>
      <div className="space-y-2">
        {users.map(u => {
          const companies = u.companies.map(id => COMPANIES[id]?.short).filter(Boolean);
          return (
            <button
              key={u.id}
              onClick={() => onMockLogin(u)}
              className="w-full p-3.5 rounded-xl border flex items-center gap-3 transition-all duration-150 text-left"
              style={{
                borderColor: "#E8E8E8",
                background: "#FFFFFF",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                e.currentTarget.style.borderColor = "#D0D0D0";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
                e.currentTarget.style.borderColor = "#E8E8E8";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shrink-0"
                style={{ background: u.avatarBg, fontSize: 13 }}
              >
                {u.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm" style={{ color: NEUTRAL.graphite }}>
                  {u.name}
                </div>
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

export default LoginScreen;
