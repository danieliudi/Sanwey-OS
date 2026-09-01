import React from "react";
import { createPortal } from "react-dom";
import { Sparkles, X, ArrowRight } from "lucide-react";
import { Badge } from "../ui/Badge";

// Apresentação própria pro toast de "Novidades" — não reaproveita AppToast.jsx
// de propósito (esse componente também serve o toast de erro em 4 telas;
// mudar o shell dele mudaria os dois). Mockup aprovado com o Daniel
// (30/07/2026): mais respiro, etiqueta por kind igual à aba "Novidades", só
// os 3 itens mais importantes (kind "novo" primeiro) com link pro resto.
const KIND_LABEL = { novo: "Novo", correcao: "Correção", ajuste: "Ajuste" };
const KIND_VARIANT = { novo: "secondary", correcao: "success", ajuste: "neutral" };
const KIND_PRIORITY = { novo: 0, correcao: 1, ajuste: 2 };

export function ChangelogToast({ items, onDismiss, onViewAll }) {
  if (!items || items.length === 0) return null;
  const shown = [...items].sort((a, b) => (KIND_PRIORITY[a.kind] ?? 1) - (KIND_PRIORITY[b.kind] ?? 1)).slice(0, 3);

  // 2100, portalado — mesma razão do AppToast (ver comentário longo lá):
  // `z-50` perdia por aritmética pra escala inline de ~40 modais feitos à mão
  // (999 a 2101), então "Novidades" sumia com qualquer um deles aberto.
  // Fica 100 ABAIXO do AppToast (2200) de propósito: se um erro e um aviso de
  // novidade coincidirem, o erro é o que precisa ser lido.
  const node = (
    <div
      className="fixed rounded-2xl overflow-hidden"
      style={{ zIndex: 2100, bottom: 20, right: 20, width: 440, maxWidth: "92vw", background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-pop)" }}
    >
      <div className="flex items-center gap-3" style={{ padding: "18px 20px 14px" }}>
        <span className="shrink-0 flex items-center justify-center" style={{ width: 38, height: 38, borderRadius: 10, background: "var(--accent-tint)", color: "var(--accent)" }}>
          <Sparkles size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold" style={{ fontSize: 15.5, letterSpacing: "-0.01em" }}>Coisas novas por aqui</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
            {items.length === 1 ? "1 novidade desde a sua última visita" : `${items.length} novidades desde a sua última visita`}
          </div>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="shrink-0" style={{ color: "var(--text-faint)", background: "none", border: "none", cursor: "pointer" }} aria-label="Fechar">
            <X size={16} />
          </button>
        )}
      </div>

      <div style={{ padding: "4px 20px 6px" }}>
        {shown.map((item, i) => (
          <div key={i} className="flex items-start gap-2.5" style={{ padding: "10px 0", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
            <Badge variant={KIND_VARIANT[item.kind] || "neutral"}>{KIND_LABEL[item.kind] || item.kind}</Badge>
            <span className="flex-1" style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--text)" }}>{item.text ?? item}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between" style={{ padding: "14px 20px 18px", marginTop: 4 }}>
        <button
          onClick={onViewAll}
          className="inline-flex items-center gap-1 font-bold cursor-pointer"
          style={{ fontSize: 12.5, color: "var(--accent)", background: "none", border: "none", padding: 0 }}
        >
          Ver tudo que mudou <ArrowRight size={13} />
        </button>
        <button
          onClick={onDismiss}
          className="font-bold cursor-pointer"
          style={{ fontSize: 12.5, color: "var(--on-accent)", background: "var(--accent)", border: "none", padding: "8px 16px", borderRadius: 8 }}
        >
          Entendi
        </button>
      </div>
    </div>
  );

  return typeof document === "undefined" ? node : createPortal(node, document.body);
}

export default ChangelogToast;
