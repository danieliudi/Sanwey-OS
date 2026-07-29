import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

function rowToInvitation(r) {
  return {
    id: r.id,
    email: r.email,
    name: r.name || null,
    role: r.role,
    companies: Array.isArray(r.companies) ? r.companies : [],
    sectors: Array.isArray(r.sectors) ? r.sectors : [],
    supplierId: r.supplier_id || null,
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
    const channelName = `invitations-list-${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
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

  const createInvitation = useCallback(async ({ email, name, role, companies, sectors, supervisorId, supplierId, invitedBy }) => {
    if (!isSupabaseConfigured) throw new Error("Supabase não configurado.");
    const normalizedEmail = (email || "").trim().toLowerCase();
    if (!normalizedEmail) throw new Error("Informe o e-mail.");
    const { data, error: err } = await supabase
      .from("invitations")
      .insert({
        email: normalizedEmail,
        name: (name || "").trim() || null,
        role,
        companies: Array.isArray(companies) ? companies : [],
        sectors: Array.isArray(sectors) ? sectors : [],
        supervisor_id: supervisorId || null,
        supplier_id: supplierId || null,
        invited_by: invitedBy || null,
      })
      .select()
      .single();
    if (err) throw err;
    setInvitations(prev => prev.some(i => i.id === data.id) ? prev : [rowToInvitation(data), ...prev]);
    // Envia e-mail de convite via Edge Function
    const { data: emailData, error: emailErr } = await supabase.functions.invoke("resend-invite", { body: { invitation_id: data.id } });
    if (emailErr) console.warn("Falha ao enviar e-mail de convite:", emailErr);
    return { ...rowToInvitation(data), alreadyRegistered: Boolean(emailData?.already_registered) };
  }, []);

  const revokeInvitation = useCallback(async (id) => {
    if (!isSupabaseConfigured) throw new Error("Supabase não configurado.");
    const target = invitations.find(i => i.id === id);
    setInvitations(prev => prev.filter(i => i.id !== id));

    // O convite cria a conta de verdade em auth.users/profiles no ENVIO
    // (resend-invite → auth.admin.inviteUserByEmail), não na aceitação —
    // revogar só a linha de invitations deixava esse "fantasma" pra trás,
    // e como o badge "Convite pendente" na lista geral só existe enquanto
    // a linha de invitations existe, a pessoa reaparecia ali como usuário
    // ativo comum assim que o convite era revogado — nunca dava pra
    // removê-la de vez por essa tela (causa real do "não consigo deletar
    // usuários", achado só depois do fix de exclusão em 922541f).
    if (target?.email) {
      const { data: ghost } = await supabase
        .from("profiles").select("id").ilike("email", target.email).maybeSingle();
      if (ghost?.id) {
        const { error: ghostErr } = await supabase.functions.invoke("delete-user", { body: { user_id: ghost.id } });
        if (ghostErr) console.warn("Falha ao remover conta do convite revogado:", ghostErr);
      }
    }

    const { error: err } = await supabase.from("invitations").delete().eq("id", id);
    if (err) {
      setError(err);
      fetchAll();
      throw err;
    }
  }, [invitations, fetchAll]);

  const resendInvitation = useCallback(async (id) => {
    if (!isSupabaseConfigured) throw new Error("Supabase não configurado.");
    const { data, error: err } = await supabase.functions.invoke("resend-invite", {
      body: { invitation_id: id },
    });
    if (err) throw err;
    if (data?.already_registered) return { alreadyRegistered: true };
    const now = new Date().toISOString();
    setInvitations(prev => prev.map(i => i.id === id ? { ...i, lastSentAt: now } : i));
    return { alreadyRegistered: false };
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
