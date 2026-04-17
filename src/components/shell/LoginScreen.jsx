import React, { useState } from "react";
import { Shield, ChevronRight, Loader2 } from "lucide-react";
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
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div
              className="w-14 h-14 rounded-sm flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #FFFFFF20 0%, #FFFFFF10 100%)",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <Shield size={28} color="#FFFFFF" strokeWidth={2.5} />
            </div>
            <div className="text-left">
              <div className="font-bold text-white" style={{ fontSize: 24, letterSpacing: "-0.02em" }}>
                Grupo Sanwey
              </div>
              <div className="text-white/70 uppercase text-xs" style={{ letterSpacing: "0.14em" }}>
                Comercial Intelligence
              </div>
            </div>
          </div>
          <p className="text-white/80 text-sm mt-4 max-w-sm mx-auto">
            Plataforma unificada de inteligência comercial para as 4 empresas do Grupo
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
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
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
    <div className="rounded-sm p-6" style={{ background: "#FFFFFF" }}>
      <div
        className="text-[10px] uppercase font-bold tracking-widest mb-4"
        style={{ color: NEUTRAL.slate, letterSpacing: "0.15em" }}
      >
        {mode === "signin" ? "Acessar sua conta" : "Criar conta"}
      </div>

      <form onSubmit={submit} className="space-y-3">
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
            className="text-xs px-3 py-2 rounded-sm"
            style={{ background: "#FEE2E2", color: "#991B1B", border: "1px solid #FCA5A5" }}
          >
            {err.message || "Não foi possível autenticar. Tente novamente."}
          </div>
        )}

        <button
          type="submit"
          disabled={authLoading}
          className="w-full p-3 rounded-sm font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60"
          style={{ background: NEUTRAL.graphite, fontSize: 13, letterSpacing: "0.02em" }}
        >
          {authLoading ? <Loader2 size={16} className="animate-spin" /> : null}
          {mode === "signin" ? "Entrar" : "Criar conta"}
        </button>
      </form>

      <div
        className="mt-5 pt-4 border-t text-xs text-center"
        style={{ borderColor: "#EFEFEF", color: NEUTRAL.slate }}
      >
        {mode === "signin" ? (
          <>
            Não tem conta?{" "}
            <button
              type="button"
              onClick={() => { setMode("signup"); setLocalError(null); }}
              className="font-semibold underline"
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
              className="font-semibold underline"
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
  return (
    <label className="block">
      <div
        className="text-[10px] uppercase font-bold tracking-widest mb-1"
        style={{ color: NEUTRAL.slate, letterSpacing: "0.15em" }}
      >
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="w-full px-3 py-2 rounded-sm border text-sm outline-none transition-all focus:ring-2"
        style={{ borderColor: "#EFEFEF", color: NEUTRAL.graphite, background: "#FAFAF8" }}
      />
    </label>
  );
}

function MockLoginCard({ users, onMockLogin }) {
  return (
    <div className="rounded-sm p-6" style={{ background: "#FFFFFF" }}>
      <div
        className="text-[10px] uppercase font-bold tracking-widest mb-4"
        style={{ color: NEUTRAL.slate, letterSpacing: "0.15em" }}
      >
        Selecione seu perfil
      </div>
      <div className="space-y-2">
        {users.map(u => {
          const companies = u.companies.map(id => COMPANIES[id]?.short).filter(Boolean);
          return (
            <button
              key={u.id}
              onClick={() => onMockLogin(u)}
              className="w-full p-3 rounded-sm border flex items-center gap-3 transition-all text-left hover:shadow-md"
              style={{ borderColor: "#EFEFEF", background: "#FFFFFF" }}
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white shrink-0"
                style={{ background: u.avatarBg, fontSize: 13 }}
              >
                {u.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm" style={{ color: NEUTRAL.graphite }}>
                  {u.name}
                </div>
                <div className="text-xs" style={{ color: NEUTRAL.slate }}>
                  {u.role === "gerente" ? "Gerente Comercial" : "Vendedor"} ·{" "}
                  {u.role === "gerente" ? "Acesso total" : companies.join(" · ")}
                </div>
              </div>
              <ChevronRight size={16} color={NEUTRAL.slate} />
            </button>
          );
        })}
      </div>
      <div
        className="mt-5 pt-4 border-t text-xs text-center"
        style={{ borderColor: "#EFEFEF", color: NEUTRAL.slate }}
      >
        Login simulado — configure Supabase para autenticação real.
      </div>
    </div>
  );
}

export default LoginScreen;
