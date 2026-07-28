import React from "react";
import { X } from "lucide-react";
import { useEscToClose } from "../../hooks/use-esc-to-close";
import { useBodyScrollLock } from "../../hooks/use-body-scroll-lock";
import { DetailDrawerTabs } from "./DetailDrawerTabs";

// Shell genérico de "perfil de uma entidade" (Colaborador, Cliente, e
// qualquer outra tela futura de perfil — Fornecedor etc.): header com
// avatar/nome/subtítulo/status + abas + conteúdo. Não decide QUAIS abas
// existem nem o que cada uma mostra — só a casca (header + tab strip +
// área de conteúdo com scroll). Nasceu junto com `ConnectionsPanel` pra
// dar ao Colaborador (RHFuncionariosView) e ao Cliente (ClientsManager) o
// mesmo padrão visual, em vez de dois modais parecidos construídos à mão.
export function EntityProfileModal({
  open,
  onClose,
  avatarLabel,
  avatarColor = "var(--accent)",
  avatarUrl,
  title,
  subtitle,
  statusBadge,
  headerExtra,
  tabs,
  activeTab,
  onTabChange,
  width = 640,
  children,
}) {
  useEscToClose(onClose, open);
  useBodyScrollLock(open);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--overlay-scrim)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="rounded-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        style={{ background: "var(--surface)", maxWidth: width, boxShadow: "var(--shadow-pop)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3.5 px-6 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="rounded-full flex-shrink-0" style={{ width: 48, height: 48, objectFit: "cover" }} />
          ) : (
            <div
              className="rounded-full flex items-center justify-center flex-shrink-0 font-bold"
              style={{ width: 48, height: 48, background: avatarColor, color: "#FFF", fontSize: 16 }}
            >
              {avatarLabel}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="font-bold truncate" style={{ fontSize: 17, color: "var(--text)", letterSpacing: "-0.01em" }}>{title}</h2>
            {subtitle && <div className="text-xs mt-0.5 truncate" style={{ color: "var(--text-dim)" }}>{subtitle}</div>}
            {statusBadge && <div className="mt-1.5">{statusBadge}</div>}
          </div>
          {headerExtra}
          <button
            onClick={onClose}
            className="p-1.5 rounded-md flex-shrink-0"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {tabs?.length > 0 && (
          <div className="px-6 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <DetailDrawerTabs tabs={tabs} activeId={activeTab} onChange={onTabChange} />
          </div>
        )}

        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export default EntityProfileModal;
