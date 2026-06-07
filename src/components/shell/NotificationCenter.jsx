import React, { useEffect, useRef, useState } from "react";
import { Bell, Check, GitBranch, Calendar, User, Trash2, X } from "lucide-react";
import { NEUTRAL } from "../../constants/companies";
import { formatDateBR } from "../../utils/date";

const TYPE_ICON = {
  followup: Calendar,
  stage_changed: GitBranch,
  lead_assigned: User,
  default: Bell,
};

const TYPE_COLOR = {
  followup: "#F59E0B",
  stage_changed: NEUTRAL.slate,
  lead_assigned: "#b5000b",
  default: NEUTRAL.slate,
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
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

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
    if (notif.leadId && onSelectLead) {
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
          background: open ? "#F0EDE8" : "transparent",
          border: "none",
          cursor: "pointer",
          color: NEUTRAL.graphite,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "#F0EDE8"; }}
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
              background: "#b5000b",
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
            background: "#FFFFFF",
            borderColor: "#E5E0DA",
            boxShadow: "0 8px 32px rgba(44,44,43,0.14)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: "#E5E0DA", background: "#F9F5F1" }}
          >
            <span className="font-semibold text-sm" style={{ color: NEUTRAL.graphite }}>
              Notificações {unreadCount > 0 && <span style={{ color: "#b5000b" }}>({unreadCount})</span>}
            </span>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllRead}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors"
                  style={{ color: NEUTRAL.slate, background: "none", border: "none", cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#E5E0DA"; }}
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
                  style={{ color: NEUTRAL.slate, background: "none", border: "none", cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#E5E0DA"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                  title="Limpar tudo"
                >
                  <Trash2 size={12} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="flex items-center justify-center rounded-lg transition-colors"
                style={{ width: 24, height: 24, color: NEUTRAL.slate, background: "none", border: "none", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#E5E0DA"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Desktop permission banner */}
          {desktopPermission === "default" && (
            <div
              className="flex items-center justify-between px-4 py-2.5 border-b text-xs"
              style={{ borderColor: "#E5E0DA", background: "#FEF3C7" }}
            >
              <span style={{ color: "#92400E" }}>Ativar notificações do navegador?</span>
              <button
                onClick={onRequestDesktopPermission}
                className="font-semibold px-2.5 py-1 rounded-lg"
                style={{ background: "#F59E0B", color: "#FFFFFF", border: "none", cursor: "pointer", fontSize: 11 }}
              >
                Ativar
              </button>
            </div>
          )}

          {/* Notification list */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Bell size={28} style={{ color: "#D4CFC9" }} strokeWidth={1.5} />
                <span className="text-sm" style={{ color: NEUTRAL.slate }}>Nenhuma notificação</span>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "#F0EDE8" }}>
                {notifications.map((notif) => {
                  const Icon = TYPE_ICON[notif.type] || TYPE_ICON.default;
                  const color = TYPE_COLOR[notif.type] || TYPE_COLOR.default;
                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleNotifClick(notif)}
                      className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors"
                      style={{ background: notif.read ? "#FFFFFF" : "#FBF9F7" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#F9F5F1"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = notif.read ? "#FFFFFF" : "#FBF9F7"; }}
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: color + "18" }}
                      >
                        <Icon size={13} style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold leading-snug" style={{ color: NEUTRAL.graphite }}>
                          {notif.title}
                        </div>
                        <div className="text-xs mt-0.5 leading-relaxed" style={{ color: NEUTRAL.slate }}>
                          {notif.body}
                        </div>
                        <div className="text-[10px] mt-1" style={{ color: "#AEAAA5" }}>
                          {timeAgo(notif.createdAt)}
                        </div>
                      </div>
                      {!notif.read && (
                        <div
                          className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                          style={{ background: "#b5000b" }}
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
