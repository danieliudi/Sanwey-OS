import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const LINK_TTL_DAYS = 7;

// Token de 256 bits (2x crypto.randomUUID, sem hífen) — não é um slug
// adivinhável, e nunca aparece em nenhuma tabela lida por role anônima
// além do que a edge function manager-vaga-review resolve com service role.
function generateToken() {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
}

export function useRHManagerLinks(vagaId) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const activeRef = useRef(true);

  const fetchLinks = useCallback(async () => {
    if (!isSupabaseConfigured || !vagaId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("rh_vaga_manager_links")
      .select("*")
      .eq("vaga_id", vagaId)
      .order("created_at", { ascending: false });
    if (!activeRef.current) return;
    setLinks(data || []);
    setLoading(false);
  }, [vagaId]);

  useEffect(() => {
    activeRef.current = true;
    fetchLinks();
    return () => { activeRef.current = false; };
  }, [fetchLinks]);

  const createLink = useCallback(async ({ managerName, managerEmail, vagaTitle, userId }) => {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + LINK_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: link, error } = await supabase
      .from("rh_vaga_manager_links")
      .insert({
        vaga_id: vagaId,
        manager_name: managerName,
        manager_email: managerEmail,
        token,
        expires_at: expiresAt,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const linkUrl = `${window.location.origin}/gestor-vaga/${token}`;
    const { error: emailErr } = await supabase.functions.invoke("rh-send-email", {
      body: {
        type: "vaga_manager_link",
        to: managerEmail,
        // A edge function IGNORA to/variables abaixo e re-deriva tudo
        // (e-mail/nome do gestor, título da vaga, LINK_URL a partir do
        // token real) de `rh_vaga_manager_links` via managerLinkId — achado
        // de segurança de 08/08/2026. `to`/`variables` ficam só por
        // compatibilidade de payload.
        managerLinkId: link.id,
        variables: {
          MANAGER_NAME: managerName,
          VAGA_TITLE: vagaTitle || "",
          LINK_URL: linkUrl,
          EXPIRES_DAYS: String(LINK_TTL_DAYS),
        },
      },
    });

    setLinks(prev => [link, ...prev]);
    return { link, emailSent: !emailErr };
  }, [vagaId]);

  const revokeLink = useCallback(async (linkId) => {
    const { error } = await supabase
      .from("rh_vaga_manager_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", linkId);
    if (error) throw new Error(error.message);
    setLinks(prev => prev.map(l => l.id === linkId ? { ...l, revoked_at: new Date().toISOString() } : l));
  }, []);

  return { links, loading, createLink, revokeLink, refetch: fetchLinks };
}
