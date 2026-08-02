import React, { useEffect, useMemo } from "react";
import { X, ArrowRight, Lock, User } from "lucide-react";
import { COMPANIES } from "../../constants/companies";

// Modal "Preview vendedor" — mostra explicitamente, etapa por etapa,
// quais transições o vendedor pode fazer no kanban.
//
// Não é uma simulação interativa do kanban — é a documentação visual
// das regras configuradas, do ponto de vista de quem usa o sistema.

export function SellerPreviewModal({ open, onClose, companyId, stages, transitions }) {
  const company = COMPANIES[companyId];
  const accent = company?.primary || "var(--text)";
  const hasCustomRules = Boolean(transitions.rules[companyId]);

  // Pra cada etapa de origem não-terminal, calcula destinos permitidos e
  // separa entre "Avançar" (índice maior, não-perdido), "Voltar" (índice
  // menor) e "Fechar" (terminais).
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  const flow = useMemo(() => {
    if (!open) return [];
    const allIds = stages.map(s => s.id);
    const idxById = Object.fromEntries(stages.map((s, i) => [s.id, i]));
    return stages
      .filter(s => !s.lost)
      .map(from => {
        const allowed = transitions.getAllowedDestinations(companyId, from.id, allIds)
          .filter(id => id !== from.id);
        const advance = [];
        const back = [];
        const terminals = [];
        for (const toId of allowed) {
          const to = stages.find(s => s.id === toId);
          if (!to) continue;
          if (to.terminal) terminals.push(to);
          else if (idxById[toId] > idxById[from.id]) advance.push(to);
          else back.push(to);
        }
        return { from, advance, back, terminals, locked: allowed.length === 0 };
      });
  }, [open, stages, companyId, transitions]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--overlay-scrim)" }}
    >
      <div
        className="rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col"
        style={{ background: "var(--surface)", maxHeight: "90vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <User size={18} style={{ color: accent }} />
            <div>
              <h2 className="font-bold" style={{ fontSize: 16, color: "var(--text)" }}>
                Como o vendedor vê · {company?.short || companyId}
              </h2>
              <p className="text-xs" style={{ color: "var(--text-dim)" }}>
                {hasCustomRules ? "Regras personalizadas ativas" : "Modo aberto · todas transições permitidas"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg cursor-pointer"
            style={{ color: "var(--text-dim)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Fluxo */}
        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {flow.map(({ from, advance, back, terminals, locked }) => (
            <div
              key={from.id}
              className="rounded-xl border p-3"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              {/* Origem */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: from.color + "20", color: from.color }}
                >
                  {from.code}
                </span>
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  Em {from.name}
                </span>
                {Number.isFinite(from.slaDays) && (
                  <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>
                    · SLA {from.slaDays}d
                  </span>
                )}
              </div>

              {locked ? (
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--danger)" }}>
                  <Lock size={12} />
                  Vendedor não pode mover esse lead pra nenhuma outra etapa. Etapa travada.
                </div>
              ) : (
                <div className="space-y-1.5">
                  <PreviewRow label="Pode avançar para" stages={advance} fallback="Nenhum destino à frente." />
                  <PreviewRow label="Pode voltar para"  stages={back}    fallback="Nenhuma volta permitida." />
                  <PreviewRow label="Pode fechar como"  stages={terminals} fallback="Sem permissão de fechamento aqui." />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t flex items-center justify-end" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer"
            style={{ background: accent, color: "#FFFFFF" }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ label, stages, fallback }) {
  if (!stages.length) {
    return (
      <div className="flex items-start gap-2 text-xs" style={{ color: "var(--text-dim)" }}>
        <span className="font-semibold shrink-0" style={{ minWidth: 130 }}>{label}:</span>
        <span className="italic">{fallback}</span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="font-semibold shrink-0 mt-1" style={{ minWidth: 130, color: "var(--text-dim)" }}>{label}:</span>
      <div className="flex flex-wrap gap-1.5">
        {stages.map(s => (
          <span
            key={s.id}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold"
            style={{ background: s.color, color: "#FFFFFF" }}
          >
            <ArrowRight size={10} />
            <span className="opacity-70 text-[9px] font-bold">{s.code}</span>
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export default SellerPreviewModal;
