import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

function rowToInvitation(r) {
  return {
    id: r.id,
    email: r.email,
    role: r.role,
    companies: Array.isArray(r.companies) ? r.companies : [],
    invitedBy: r.invited_by,
    createdAt: r.created_at,
    acceptedAt: r.accepted_at,
    acceptedBy: r.accepted_by,
    lastSentAt: r.last_sent_at ?? null,
  };
}

export function useInvitations({ enabled = true } = {}) {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(isSupabaseConfigured && enabled);
  const [error, setError] = useState(null);
  const activeRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !enabled) return;
    setError(null);
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from("invitations")
        .select("*")
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      if (err) throw err;
      if (!activeRef.current) return;
      setInvitations((data || []).map(rowToInvitation));
    } catch (e) {
      if (!activeRef.current) return;
      setError(e);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    activeRef.current = true;
    if (!isSupabaseConfigured || !enabled) {
      setInvitations([]);
      setLoading(false);
      return;
    }
    fetchAll();
    const channel = supabase
      .channel("invitations-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "invitations" }, (payload) => {
        if (!activeRef.current) return;
        if (payload.eventType === "DELETE") {
          setInvitations(prev => prev.filter(i => i.id !== payload.old.id));
        } else if (payload.eventType === "INSERT") {
          if (payload.new.accepted_at) return;
          setInvitations(prev => {
            if (prev.some(i => i.id === payload.new.id)) return prev;
            return [rowToInvitation(payload.new), ...prev];
          });
        } else if (payload.eventType === "UPDATE") {
          if (payload.new.accepted_at) {
            setInvitations(prev => prev.filter(i => i.id !== payload.new.id));
          } else {
            setInvitations(prev => prev.map(i => i.id === payload.new.id ? rowToInvitation(payload.new) : i));
          }
        }
      })
      .subscribe();
    return () => {
      activeRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [enabled, fetchAll]);

  const createInvitation = useCallback(async ({ email, role, companies, invitedBy }) => {
    if (!isSupabaseConfigured) throw new Error("Supabase não configurado.");
    const normalizedEmail = (email || "").trim().toLowerCase();
    if (!normalizedEmail) throw new Error("Informe o e-mail.");
    const { data, error: err } = await supabase
      .from("invitations")
      .insert({
        email: normalizedEmail,
        role,
        companies: Array.isArray(companies) ? companies : [],
        invited_by: invitedBy || null,
      })
      .select()
      .single();
    if (err) throw err;
    setInvitations(prev => prev.some(i => i.id === data.id) ? prev : [rowToInvitation(data), ...prev]);
    return rowToInvitation(data);
  }, []);

  const revokeInvitation = useCallback(async (id) => {
    if (!isSupabaseConfigured) throw new Error("Supabase não configurado.");
    setInvitations(prev => prev.filter(i => i.id !== id));
    const { error: err } = await supabase.from("invitations").delete().eq("id", id);
    if (err) {
      setError(err);
      fetchAll();
      throw err;
    }
  }, [fetchAll]);

  const resendInvitation = useCallback(async (id) => {
    if (!isSupabaseConfigured) throw new Error("Supabase não configurado.");
    const { error: err } = await supabase.functions.invoke("resend-invite", {
      body: { invitation_id: id },
    });
    if (err) throw err;
    const now = new Date().toISOString();
    setInvitations(prev => prev.map(i => i.id === id ? { ...i, lastSentAt: now } : i));
  }, []);

  return useMemo(() => ({
    invitations,
    loading,
    error,
    createInvitation,
    revokeInvitation,
    resendInvitation,
    refetch: fetchAll,
  }), [invitations, loading, error, createInvitation, revokeInvitation, resendInvitation, fetchAll]);
}
