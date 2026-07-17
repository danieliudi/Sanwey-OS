import React, { useEffect, useRef, useState } from "react";
import { Bell, Check, GitBranch, Calendar, User, Trash2, X, AtSign, Megaphone } from "lucide-react";
import { formatDateBR } from "../../utils/date";

const TYPE_ICON = {
  followup: Calendar,
  stage_changed: GitBranch,
  lead_assigned: User,
  mention: AtSign,
  comunicado: Megaphone,
  comunicado_importante: Megaphone,
  default: Bell,
};

const TYPE_COLOR = {
  followup: "#F59E0B",
  stage_changed: "var(--text-dim)",
  lead_assigned: "var(--accent)",
  mention: "var(--accent)",
  comunicado: "var(--accent)",
  comunicado_importante: "var(--danger)",
  default: "var(--text-dim)",
};

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  return formatDateBR(iso);
}

export function NotificationCenter({
  notifications,
  unreadCount,
  onMarkAllRead,
  onMarkRead,
  onClearAll,
  desktopPermission,
  onRequestDesktopPermission,
  onSelectLead,
  onNavigate,
}) {
  const [open, setOpen] = useState(false);
  const [permissionFeedback, setPermissionFeedback] = useState(null);
  const panelRef = useRef(null);

  const handleRequestPermission = async () => {
    setPermissionFeedback(null);
    const result = await onRequestDesktopPermission?.();
    if (result === "granted") setPermissionFeedback(null); // banner some sozinho (desktopPermission muda)
    else if (result === "denied") setPermissionFeedback("Permissão negada. Habilite manualmente nas configurações do navegador (ícone de cadeado/sino na barra de endereço).");
    else if (result === "unsupported") setPermissionFeedback("Seu navegador não suporta notificações de desktop.");
    else if (result === "error") setPermissionFeedback("Não foi possível pedir permissão agora. Tente de novo.");
    else if (result === "default") setPermissionFeedback("Nenhuma resposta do navegador — verifique se um pedido de permissão apareceu na barra de endereço.");
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    setOpen(v => !v);
  };

  const handleNotifClick = (notif) => {
    onMarkRead(notif.id);
    // Notificações de servidor (@menção, ver use-server-notifications.js)
    // trazem um link genérico { module, id } — não sabemos abrir o card
    // exato de qualquer módulo a partir daqui, então onNavigate pelo menos
    // leva pra tela certa; notificações locais de lead continuam abrindo o
    // lead direto via onSelectLead.
    if (notif.link && onNavigate) {
      onNavigate(notif.link);
      setOpen(false);
    } else if (notif.leadId && onSelectLead) {
      onSelectLead(notif.leadId);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center rounded-xl transition-colors"
        style={{
          width: 36, height: 36,
          background: open ? "var(--surface-alt)" : "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--text)",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = "transparent"; }}
        title="Notificações"
      >
        <Bell size={18} strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span
            className="absolute flex items-center justify-center rounded-full font-bold text-white"
            style={{
              top: 4, right: 4,
              width: unreadCount > 9 ? 16 : 14,
              height: 14,
              fontSize: 9,
              background: "var(--accent)",
              lineHeight: 1,
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel — fixed on mobile (avoids overflow anchoring bug), absolute on desktop */}
      {open && (
        <div
          className="fixed top-14 left-2 right-2 lg:absolute lg:top-full lg:left-auto lg:right-0 lg:mt-2 lg:w-[340px] flex flex-col rounded-2xl border overflow-hidden z-50"
          style={{
            maxHeight: 480,
            background: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-pop)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}
          >
            <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>
              Notificações {unreadCount > 0 && <span style={{ color: "var(--accent)" }}>({unreadCount})</span>}
            </span>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllRead}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors"
                  style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                  title="Marcar todas como lidas"
                >
                  <Check size={12} /> Lidas
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={onClearAll}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors"
                  style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                  title="Limpar tudo"
                >
                  <Trash2 size={12} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="flex items-center justify-center rounded-lg transition-colors"
                style={{ width: 24, height: 24, color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#E5E7EB"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Desktop permission banner */}
          {desktopPermission === "default" && (
            <div className="border-b" style={{ borderColor: "var(--border)", background: "var(--amber-bg)" }}>
              <div className="flex items-center justify-between px-4 py-2.5 text-xs">
                <span style={{ color: "var(--warning)" }}>Ativar notificações do navegador?</span>
                <button
                  onClick={handleRequestPermission}
                  className="font-semibold px-2.5 py-1 rounded-lg"
                  style={{ background: "var(--amber)", color: "#FFFFFF", border: "none", cursor: "pointer", fontSize: 11 }}
                >
                  Ativar
                </button>
              </div>
              {permissionFeedback && (
                <div className="px-4 pb-2.5 text-xs" style={{ color: "var(--warning)" }}>
                  {permissionFeedback}
                </div>
              )}
            </div>
          )}

          {/* Notification list */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Bell size={28} style={{ color: "var(--text-faint)" }} strokeWidth={1.5} />
                <span className="text-sm" style={{ color: "var(--text-dim)" }}>Nenhuma notificação</span>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {notifications.map((notif) => {
                  const Icon = TYPE_ICON[notif.type] || TYPE_ICON.default;
                  const color = TYPE_COLOR[notif.type] || TYPE_COLOR.default;
                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleNotifClick(notif)}
                      className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors"
                      style={{ background: notif.read ? "var(--surface)" : "var(--surface-alt)" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--border)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = notif.read ? "var(--surface)" : "var(--surface-alt)"; }}
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: color + "18" }}
                      >
                        <Icon size={13} style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold leading-snug" style={{ color: "var(--text)" }}>
                          {notif.title}
                        </div>
                        <div className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-dim)" }}>
                          {notif.body}
                        </div>
                        <div className="text-[10px] mt-1" style={{ color: "var(--text-faint)" }}>
                          {timeAgo(notif.createdAt)}
                        </div>
                      </div>
                      {!notif.read && (
                        <div
                          className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                          style={{ background: "var(--accent)" }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationCenter;
