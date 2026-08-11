import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured, cameFromInviteLink, authLinkError } from "../lib/supabase";
import { clearAll as clearOfflineCache } from "./use-offline-cache";

// Loads the current user's profile row (role, companies, avatarBg, initials).
// Expects a `profiles` table keyed by auth.users.id — see README for SQL.
//
// ai_config/calendar_token vivem em `profile_secrets` (RLS own-only, ver
// migration 20260819_sec_profile_secrets_split.sql) — antes ficavam em
// `profiles`, lida por LINHA inteira por gerente/marketing/rh/agencia/
// supervisor via useProfiles(), o que vazava a chave de IA e o token de
// calendário de colegas (achado de segurança). O embed abaixo só funciona
// pro dono porque a RLS de profile_secrets é `id = auth.uid()`.
async function loadProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*, profile_secrets(ai_config, calendar_token)")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function useSupabaseAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  // Pré-popula com o erro do link (se veio um) — sem isso a tela de login
  // renderizava sem nenhum aviso, e a pessoa não tinha como saber que o
  // link tinha expirado (ver authLinkError em lib/supabase.js).
  const [error, setError] = useState(() => (authLinkError ? new Error(authLinkError.description || "Link inválido ou expirado.") : null));
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  // Link de convite não dispara PASSWORD_RECOVERY (só "type=recovery" faz
  // isso) — sem isso, quem aceita convite cai direto no painel de trabalho
  // sem nunca definir senha. cameFromInviteLink já foi lido de forma
  // síncrona em lib/supabase.js, antes do supabase-js consumir o hash.
  const [isInviteAcceptance, setIsInviteAcceptance] = useState(cameFromInviteLink);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    // Listener pode disparar antes da Promise inicial resolver. Marcamos
    // após a primeira notificação para não sobrescrever sessão mais nova
    // com o valor stale do getSession().
    let listenerHasFired = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!active || listenerHasFired) return;
      setSession(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!active) return;
      listenerHasFired = true;
      if (_event === "PASSWORD_RECOVERY") setIsPasswordRecovery(true);
      // Achado de segurança (M4): limpar aqui (não só no signOut explícito)
      // cobre também expiração/invalidação de sessão — sem isso, o snapshot
      // de leads e a fila de notas do usuário anterior ficavam em claro no
      // IndexedDB até um logout manual bem-sucedido.
      if (_event === "SIGNED_OUT") clearOfflineCache().catch(() => {});
      setSession(newSession);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id ?? null;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const refreshProfile = useCallback(() => {
    const id = userIdRef.current;
    if (!isSupabaseConfigured || !id) return;
    loadProfile(id)
      .then(p => setProfile(p))
      .catch(e => setError(e));
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    loadProfile(userId)
      .then(p => { if (active) setProfile(p); })
      .catch(e => { if (active) setError(e); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  // Refetch profile when the tab regains focus so role/company changes made
  // elsewhere (e.g. admin SQL update) reflect without requiring a re-login.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const onFocus = () => refreshProfile();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshProfile]);

  const signIn = useCallback(async (email, password) => {
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error); throw error; }
  }, []);

  const signUp = useCallback(async (email, password, metadata = {}) => {
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    if (error) { setError(error); throw error; }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // Fila/cache offline são escopados por sessão do navegador, não por
    // usuário — sem limpar aqui, o próximo login neste aparelho herdaria
    // leads cacheados/notas pendentes de quem saiu. Achado de segurança
    // (M4): antes era fire-and-forget (.catch sem await) — se a aba
    // navegasse/recarregasse antes da transação do IndexedDB terminar, o
    // cache podia sobreviver. Agora bloqueia o fim do signOut até limpar
    // de verdade. (onAuthStateChange acima também limpa em SIGNED_OUT —
    // clearAll é idempotente, cobre os dois caminhos sem duplicar risco.)
    await clearOfflineCache().catch(() => {});
  }, []);

  const updateAuthUser = useCallback(async (patch) => {
    const authPatch = {};
    if (patch.email) authPatch.email = patch.email;
    if (patch.password) authPatch.password = patch.password;
    if (Object.keys(authPatch).length === 0) return;
    const { error } = await supabase.auth.updateUser(authPatch);
    if (error) throw error;
    if (patch.email) refreshProfile();
  }, [refreshProfile]);

  const resetPasswordWithToken = useCallback(async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    setIsPasswordRecovery(false);
    setIsInviteAcceptance(false);
  }, []);

  // Shapes the profile + auth user in the format the rest of the app expects
  // (same keys the mock DEFAULT_USERS had).
  //
  // Memoizado por [session, profile]: sem isso, este objeto era recriado em
  // TODO render (mesmo sem session/profile mudarem de verdade), e qualquer
  // efeito rio abaixo com `currentUser` nas deps (ex.: o reset de formulário
  // do LeadCreateModal) disparava de novo a cada re-render alheio — inclusive
  // o refetch assíncrono do profile que resolve ~1-2s após o mount. Achado
  // da auditoria de QA (BUG-03: "Novo card" se autoapagava sozinho).
  const currentUser = useMemo(() => (
    session && profile
      ? {
          id: profile.id,
          name: profile.name || session.user.email,
          email: session.user.email,
          role: profile.role || "vendedor",
          roles: Array.isArray(profile.roles) && profile.roles.length ? profile.roles : (profile.role ? [profile.role] : ["vendedor"]),
          companies: profile.companies || [],
          initials: profile.initials || (profile.name || session.user.email).slice(0, 2).toUpperCase(),
          avatarBg: profile.avatar_bg || "#1D4ED8",
          avatarUrl: profile.avatar_url || null,
          sectors: Array.isArray(profile.sectors) ? profile.sectors : [],
          supervisorId: profile.supervisor_id || null,
          // profile_secrets vem embedado via FK (ver loadProfile acima) —
          // supabase-js retorna objeto (relação 1:1, PK=FK), nunca array.
          calendarToken: profile.profile_secrets?.calendar_token || null,
          // Só aqui — este fetch é escopado à própria linha (eq("id", userId)),
          // diferente do roster de useProfiles() (não deve expor ai_config de
          // ninguém além do próprio dono). Sem isso, o Provider/Model/Chave
          // salvos em Configurações nunca recarregavam após um refresh.
          aiConfig: profile.profile_secrets?.ai_config || null,
        }
      : null
  ), [session, profile]);

  return {
    session,
    currentUser,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    updateAuthUser,
    resetPasswordWithToken,
    refreshProfile,
    isPasswordRecovery,
    isInviteAcceptance,
    configured: isSupabaseConfigured,
  };
}
