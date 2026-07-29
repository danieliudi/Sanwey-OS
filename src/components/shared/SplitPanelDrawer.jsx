import React, { useEffect, useState } from "react";
import { X, Trash2 } from "lucide-react";
import { useBodyScrollLock } from "../../hooks/use-body-scroll-lock";

// Chrome estrutural do drawer de detalhe no padrão do CRM (LeadDetailDrawer):
// modal centralizado (não desliza da lateral), 3 colunas — info à esquerda,
// formulário/etapa no centro, movimentação+comentários à direita. Em mobile
// as 3 colunas empilham em sequência com scroll único (mais simples e sem
// esconder nada, diferente do CRM que esconde a coluna direita no mobile).
//
// onDelete (opcional): botão de excluir no header, com confirmação inline —
// mesmo padrão do LeadDetailDrawer (Trash2 → "Confirmar exclusão"/"Cancelar"),
// pra dar paridade de exclusão aos kanbans de RH que usam este shell.
export function SplitPanelDrawer({ onClose, header, left, center, right, onDelete, deleteLabel = "Excluir card" }) {
  // Componente só existe montado quando o drawer está aberto (o pai
  // renderiza condicionalmente) — trava o scroll do body enquanto estiver
  // montado, destrava no unmount. Achado da auditoria de fricção de 18/07.
  useBodyScrollLock(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleDeleteConfirmed = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex lg:items-center lg:justify-center lg:p-6"
      style={{ background: "var(--overlay-scrim)", backdropFilter: "blur(3px)" }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full flex-1 flex flex-col lg:flex-none lg:max-w-6xl lg:rounded-2xl lg:max-h-[92vh]"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-pop)", overflow: "hidden", height: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sticky top-0 z-10 px-5 py-3.5 border-b flex items-start justify-between gap-3 shrink-0"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex-1 min-w-0">{header}</div>
          <div className="flex items-center gap-1 shrink-0">
            {onDelete && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="min-w-10 min-h-10 flex items-center justify-center rounded-lg transition-colors duration-150 cursor-pointer"
                style={{ color: "var(--text-dim)", background: "transparent", border: "none" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.color = "#B91C1C"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
                aria-label={deleteLabel}
                title={deleteLabel}
              >
                <Trash2 size={16} />
              </button>
            )}
            {onDelete && confirmDelete && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleDeleteConfirmed}
                  disabled={deleting}
                  className="px-3 min-h-10 flex items-center justify-center rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  style={{ background: "#B91C1C", color: "#FFFFFF", border: "none", opacity: deleting ? 0.6 : 1 }}
                >
                  {deleting ? "Excluindo…" : "Confirmar exclusão"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 min-h-10 flex items-center justify-center rounded-lg text-xs cursor-pointer transition-colors"
                  style={{ color: "var(--text-dim)", background: "transparent", border: "none" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  Cancelar
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="min-w-10 min-h-10 flex items-center justify-center rounded-lg transition-colors duration-150 cursor-pointer shrink-0"
              style={{ color: "var(--text-dim)", background: "transparent", border: "none" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
          <aside
            className="w-full lg:w-[300px] lg:flex-none lg:shrink-0 lg:overflow-y-auto border-b lg:border-b-0 lg:border-r p-5 space-y-4"
            style={{ borderColor: "var(--border)" }}
          >
            {left}
          </aside>
          <main className="flex-1 min-w-0 lg:overflow-y-auto p-5 space-y-4">
            {center}
          </main>
          <aside
            className="w-full lg:w-[300px] lg:flex-none lg:shrink-0 lg:overflow-y-auto border-t lg:border-t-0 lg:border-l p-5 space-y-4"
            style={{ borderColor: "var(--border)" }}
          >
            {right}
          </aside>
        </div>
      </div>
    </div>
  );
}
