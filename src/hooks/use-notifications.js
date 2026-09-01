import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePersistentState } from "./use-persistent-state";
import { STORAGE_KEYS } from "../constants/storage-keys";
import { NOTIFICATION_TYPE_TO_PREF } from "../constants/user-settings";
import { getLeadOwnerIds } from "../utils/pipeline-metrics";
import { isTaskDone } from "../constants/personal-tasks";
import { parseDateInput } from "../utils/date";

const MAX_NOTIFICATIONS = 50;

// Gate central pelos toggles de Configurações > Notificações. Preferência
// ausente (id novo que o usuário nunca configurou, ou tipo sem toggle) =
// ligada — só desliga o que está explicitamente `false` nas preferências.
function isTypeEnabled(prefs, type) {
  const prefId = NOTIFICATION_TYPE_TO_PREF[type];
  if (!prefId) return true;
  return prefs?.[prefId] !== false;
}

function createNotification({ type, title, body, leadId, companyId, link }) {
  return {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    title,
    body,
    leadId: leadId || null,
    companyId: companyId || null,
    // Mesmo formato genérico { module, id } que use-server-notifications.js já
    // usa pras notificações de @menção — permite o NotificationCenter navegar
    // até o card certo em vez de só marcar como lida (App.jsx:handleNotificationNavigate).
    link: link || null,
    read: false,
    createdAt: new Date().toISOString(),
  };
}

export function useNotifications({ currentUser, leads = [], personalTasks = [], notificationPrefs } = {}) {
  const [notifications, setNotifications] = usePersistentState(
    STORAGE_KEYS.notifications || "crm_notifications",
    []
  );
  const [desktopPermission, setDesktopPermission] = useState(() =>
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  const seenLeadIds = useRef(new Set());
  const seenTaskIds = useRef(new Set());

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
    if (!isTypeEnabled(notificationPrefs, notifData?.type)) return;
    const notif = createNotification(notifData);
    setNotifications(prev => [notif, ...prev].slice(0, MAX_NOTIFICATIONS));
    sendDesktopNotification(notif.title, notif.body, { leadId: notif.leadId });
  }, [setNotifications, notificationPrefs]);

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
    if (!isTypeEnabled(notificationPrefs, "followup")) return;
    // getLeadOwnerIds cobre co-responsáveis (owner_ids) — filtrar só pelo
    // owner escalar deixava co-responsável sem aviso de follow-up.
    const myLeads = leads.filter(l => getLeadOwnerIds(l).includes(currentUser.id) && l.nextFollowUp);
    for (const lead of myLeads) {
      const today = new Date().toDateString();
      // parseDateInput, não `new Date(...)`: coluna `date` chega como
      // "AAAA-MM-DD" puro e `new Date` interpreta isso como meia-noite UTC —
      // em BRT (UTC-3) isso é 21h do dia ANTERIOR, então o alerta de
      // "follow-up hoje" disparava um dia antes.
      const followUpDate = parseDateInput(lead.nextFollowUp).toDateString();
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
  }, [leads, currentUser, setNotifications, notificationPrefs]);

  // Lembrete de Lista Pessoal vencendo hoje — mesmo mecanismo do follow-up
  // de Lead acima (checagem client-side a cada render com `leads`/
  // `personalTasks` novos, dedupe via ref pra não reinserir a cada
  // re-render, link genérico {module,id} pro sino navegar até a Lista
  // Pessoal — ver App.jsx NOTIFICATION_LINK_SECTIONS.personal_tasks).
  useEffect(() => {
    if (!currentUser || !personalTasks.length) return;
    if (!isTypeEnabled(notificationPrefs, "task_due")) return;
    const today = new Date().toDateString();
    for (const task of personalTasks) {
      if (isTaskDone(task.status) || !task.dueDate) continue;
      if (parseDateInput(task.dueDate).toDateString() !== today) continue;  // idem follow-up acima: coluna `date` em UTC voltaria um dia
      const key = `task_due-${task.id}-${today}`;
      if (seenTaskIds.current.has(key)) continue;
      seenTaskIds.current.add(key);
      setNotifications(prev => {
        const alreadyExists = prev.some(n => n.type === "task_due" && n.link?.id === task.id && new Date(n.createdAt).toDateString() === today);
        if (alreadyExists) return prev;
        const body = task.dueTime ? `Vence hoje às ${task.dueTime} — "${task.title}".` : `Vence hoje — "${task.title}".`;
        const notif = createNotification({
          type: "task_due",
          title: "Tarefa pessoal vencendo hoje",
          body,
          link: { module: "personal_tasks", id: task.id },
        });
        return [notif, ...prev].slice(0, MAX_NOTIFICATIONS);
      });
      sendDesktopNotification("Tarefa pessoal vencendo hoje", `"${task.title}"`, {});
    }
  }, [personalTasks, currentUser, setNotifications, notificationPrefs]);

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
