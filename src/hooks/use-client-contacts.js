import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Comitê de compra de um cliente — Procurement, EHS, Logística, CFO, Board,
// cada um com seu próprio contato, em vez do único `decision_maker` solto
// que o lead carregava (ver LeadDetailDrawer). A tabela e a RLS já existiam
// dormentes (20260918_pedidos_catalogo_portal_b2b.sql) — este hook é o
// primeiro consumidor real dela.

export function useClientContacts(clientId) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured || !clientId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("client_contacts")
      .select("id, client_id, name, email, phone, job_title, active, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });
    if (!error) setRows(data || []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const create = useCallback(async (contact) => {
    const { error } = await supabase.from("client_contacts").insert({
      client_id: clientId,
      name: contact.name,
      email: contact.email || null,
      phone: contact.phone || null,
      job_title: contact.jobTitle || null,
    });
    if (error) throw new Error(error.message);
    await fetchAll();
  }, [clientId, fetchAll]);

  const update = useCallback(async (id, contact) => {
    const { data, error } = await supabase.from("client_contacts").update({
      name: contact.name,
      email: contact.email || null,
      phone: contact.phone || null,
      job_title: contact.jobTitle || null,
    }).eq("id", id).select();
    if (error) throw new Error(error.message);
    // Zero linha = RLS barrou (UPDATE bloqueado volta error:null/data:[]).
    if (!data || data.length === 0) throw new Error("Não foi possível salvar o contato — verifique suas permissões.");
    await fetchAll();
  }, [fetchAll]);

  // Sem throw em linha-zero de propósito: ClientContactsTab.jsx:224 chama sem
  // await e sem catch, então lançar viraria rejeição sem dono, sem avisar
  // ninguém. O `fetchAll()` abaixo já cobre o caso — recarrega a verdade do
  // banco, e o botão volta sozinho pro estado real em vez de exibir uma troca
  // que não foi gravada. O `.select()` fica porque é ele que faz o UPDATE
  // devolver linha (ou nenhuma) em vez de mascarar a recusa da RLS.
  const setActive = useCallback(async (id, active) => {
    const { error } = await supabase.from("client_contacts").update({ active }).eq("id", id).select();
    if (error) throw new Error(error.message);
    await fetchAll();
  }, [fetchAll]);

  const remove = useCallback(async (id) => {
    const { error } = await supabase.from("client_contacts").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await fetchAll();
  }, [fetchAll]);

  return { rows, loading, create, update, setActive, remove, refetch: fetchAll };
}

export default useClientContacts;
