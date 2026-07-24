import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePersistentState } from "./use-persistent-state";
import { STORAGE_KEYS } from "../constants/storage-keys";
import { getLeadOwnerIds } from "../utils/pipeline-metrics";

const MAX_NOTIFICATIONS = 50;

function createNotification({ type, title, body, leadId, companyId }) {
  return {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    title,
    body,
    leadId: leadId || null,
    companyId: companyId || null,
    read: false,
    createdAt: new Date().toISOString(),
  };
}

export function useNotifications({ currentUser, leads = [] } = {}) {
  const [notifications, setNotifications] = usePersistentState(
    STORAGE_KEYS.notifications || "crm_notifications",
    []
  );
  const [desktopPermission, setDesktopPermission] = useState(() =>
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  const seenLeadIds = useRef(new Set());

  // Retorna o resultado pro componente poder dar feedback visível — antes o
  // clique em "Ativar" não mostrava nada quando a API não existe (Notification
  // undefined, ex: navegador sem suporte, contexto não-seguro) ou quando o
  // navegador já tinha negado antes (requestPermission() resolve "denied"
  // silenciosamente, sem reabrir o prompt nativo).
  const requestDesktopPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return "unsupported";
    try {
      const perm = await Notification.requestPermission();
      setDesktopPermission(perm);
      return perm;
    } catch {
      return "error";
    }
  }, []);

  function sendDesktopNotification(title, body, { leadId } = {}) {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const n = new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: leadId || undefined,
    });
    n.onclick = () => { window.focus(); n.close(); };
  }

  const push = useCallback((notifData) => {
    const notif = createNotification(notifData);
    setNotifications(prev => [notif, ...prev].slice(0, MAX_NOTIFICATIONS));
    sendDesktopNotification(notif.title, notif.body, { leadId: notif.leadId });
  }, [setNotifications]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, [setNotifications]);

  const markRead = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, [setNotifications]);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, [setNotifications]);

  // Check for follow-ups due today for this user
  useEffect(() => {
    if (!currentUser || !leads.length) return;
    // getLeadOwnerIds cobre co-responsáveis (owner_ids) — filtrar só pelo
    // owner escalar deixava co-responsável sem aviso de follow-up.
    const myLeads = leads.filter(l => getLeadOwnerIds(l).includes(currentUser.id) && l.nextFollowUp);
    for (const lead of myLeads) {
      const today = new Date().toDateString();
      const followUpDate = new Date(lead.nextFollowUp).toDateString();
      if (followUpDate === today) {
        const key = `followup-${lead.id}-${today}`;
        if (!seenLeadIds.current.has(key)) {
          seenLeadIds.current.add(key);
          // Only push if not already in recent notifications
          setNotifications(prev => {
            const alreadyExists = prev.some(n => n.type === 'followup' && n.leadId === lead.id && new Date(n.createdAt).toDateString() === today);
            if (alreadyExists) return prev;
            const notif = createNotification({
              type: 'followup',
              title: 'Follow-up para hoje',
              body: `${lead.company} — acompanhamento agendado para hoje.`,
              leadId: lead.id,
              companyId: lead.companyId,
            });
            return [notif, ...prev].slice(0, MAX_NOTIFICATIONS);
          });
          sendDesktopNotification(
            'Follow-up para hoje',
            `${lead.company} — acompanhamento agendado para hoje.`,
            { leadId: lead.id }
          );
        }
      }
    }
  }, [leads, currentUser, setNotifications]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  return {
    notifications,
    unreadCount,
    push,
    markAllRead,
    markRead,
    clearAll,
    desktopPermission,
    requestDesktopPermission,
  };
}
