import { useCallback, useEffect, useRef, useState } from "react";
import { useConnectivity } from "./use-connectivity";
import { listPending, updateStatus, removeFromQueue } from "./use-offline-cache";

// Sincroniza a fila de notas/atividades enfileiradas offline (ver
// use-leads.js addLeadActivity) assim que a conexão volta — sem retorno de
// UI direto, só efeito colateral + um state pequeno pra quem monta o toast
// (App.jsx) e pra quem precisa saber o status por item (LeadDetailDrawer,
// via `pending`/retry).
export function useOfflineSync({ leads, updateLead }) {
  const { isOnline } = useConnectivity();
  const [pending, setPending] = useState([]);
  const [syncMessage, setSyncMessage] = useState(null);
  const syncingRef = useRef(false);
  const wasOnlineRef = useRef(isOnline);

  const leadsRef = useRef(leads);
  leadsRef.current = leads;
  const updateLeadRef = useRef(updateLead);
  updateLeadRef.current = updateLead;

  const refreshPending = useCallback(async () => {
    const items = await listPending();
    setPending(items);
    return items;
  }, []);

  // Reaproveita a mesma chamada Supabase que updateLead já faz online — não
  // duplica a query, só monta o patch de activities com o item sincronizado.
  const syncItem = useCallback(async (item) => {
    const lead = leadsRef.current.find(l => l.id === item.leadId);
    if (!lead) {
      await removeFromQueue(item.id);
      return { ok: false };
    }
    await updateStatus(item.id, "syncing");
    await refreshPending();
    try {
      const hasLocalEntry = (lead.activities || []).some(a => a.id === item.id);
      const activities = hasLocalEntry
        ? (lead.activities || []).map(a => {
            if (a.id !== item.id) return a;
            const { pending: _pending, ...rest } = a;
            return rest;
          })
        : [...(lead.activities || []), item.activity];
      await updateLeadRef.current(item.leadId, { activities });
      await removeFromQueue(item.id);
      return { ok: true };
    } catch (err) {
      await updateStatus(item.id, "failed", err?.message || "Não foi possível sincronizar.");
      return { ok: false };
    } finally {
      await refreshPending();
    }
  }, [refreshPending]);

  const syncQueue = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      const items = await refreshPending();
      let syncedCount = 0;
      for (const item of items.filter(i => i.status !== "syncing")) {
        const result = await syncItem(item);
        if (result.ok) syncedCount++;
      }
      if (syncedCount > 0) {
        setSyncMessage(syncedCount === 1 ? "1 nota sincronizada" : `${syncedCount} notas sincronizadas`);
      }
    } finally {
      syncingRef.current = false;
    }
  }, [refreshPending, syncItem]);

  // No mount: sincroniza já se a fila foi deixada de uma sessão anterior que
  // fechou antes de sincronizar (cobre o caso "abriu o app já online").
  useEffect(() => {
    refreshPending();
    if (isOnline) syncQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Transição offline → online.
  useEffect(() => {
    if (isOnline && !wasOnlineRef.current) syncQueue();
    wasOnlineRef.current = isOnline;
  }, [isOnline, syncQueue]);

  useEffect(() => {
    if (!syncMessage) return;
    const t = setTimeout(() => setSyncMessage(null), 5000);
    return () => clearTimeout(t);
  }, [syncMessage]);

  const retry = useCallback(async (id) => {
    const items = await listPending();
    const item = items.find(i => i.id === id);
    if (!item) return;
    const result = await syncItem(item);
    if (result.ok) setSyncMessage("1 nota sincronizada");
  }, [syncItem]);

  return {
    pending,
    syncMessage,
    dismissSyncMessage: () => setSyncMessage(null),
    retry,
  };
}
