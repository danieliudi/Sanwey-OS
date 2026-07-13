import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

const REMEMBER_KEY = "sanwey-remember-me";

// "Lembrar-me" no login (LoginScreen.jsx) gravava esse valor mas nada lia —
// a sessão sempre persistia em localStorage independente do checkbox
// (achado da auditoria completa). A escolha de storage do client precisa
// ser decidida na criação (não dá pra trocar depois), então lemos aqui a
// preferência salva na sessão ANTERIOR: "false" explícito usa sessionStorage
// (sessão morre ao fechar a aba/navegador); qualquer outro valor (ou
// ausência dele) mantém o comportamento padrão de sempre — persistir em
// localStorage. LoginScreen.jsx grava essa preferência a cada login; ela só
// passa a valer de fato a partir do próximo carregamento da página.
const rememberPref = typeof window !== "undefined" ? window.localStorage.getItem(REMEMBER_KEY) : null;
const authStorage = rememberPref === "false" ? window.sessionStorage : undefined;

// Safe to export `null` when not configured — screens check `isSupabaseConfigured`
// before calling any method, and show a setup banner instead.
export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        ...(authStorage ? { storage: authStorage } : {}),
      },
    })
  : null;
