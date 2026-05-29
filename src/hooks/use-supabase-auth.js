import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Loads the current user's profile row (role, companies, avatarBg, initials).
// Expects a `profiles` table keyed by auth.users.id — see README for SQL.
async function loadProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function useSupabaseAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState(null);

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
  }, []);

  // Shapes the profile + auth user in the format the rest of the app expects
  // (same keys the mock DEFAULT_USERS had).
  const currentUser = session && profile
    ? {
        id: profile.id,
        name: profile.name || session.user.email,
        email: session.user.email,
        role: profile.role || "vendedor",
        companies: profile.companies || [],
        initials: profile.initials || (profile.name || session.user.email).slice(0, 2).toUpperCase(),
        avatarBg: profile.avatar_bg || "#1E4D8C",
        sector: profile.sector || null,
        supervisorId: profile.supervisor_id || null,
      }
    : null;

  return {
    session,
    currentUser,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    configured: isSupabaseConfigured,
  };
}
