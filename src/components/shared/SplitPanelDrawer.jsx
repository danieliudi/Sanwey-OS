import React, { useEffect } from "react";
import { X } from "lucide-react";

// Chrome estrutural do drawer de detalhe no padrão do CRM (LeadDetailDrawer):
// modal centralizado (não desliza da lateral), 3 colunas — info à esquerda,
// formulário/etapa no centro, movimentação+comentários à direita. Em mobile
// as 3 colunas empilham em sequência com scroll único (mais simples e sem
// esconder nada, diferente do CRM que esconde a coluna direita no mobile).
export function SplitPanelDrawer({ onClose, header, left, center, right }) {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex lg:items-center lg:justify-center lg:p-6"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
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
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors duration-150 cursor-pointer shrink-0"
            style={{ color: "var(--text-dim)", background: "transparent", border: "none" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
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
