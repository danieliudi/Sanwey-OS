import React from "react";

// Idioma fechado na spec (docs/design-spec-padroes-de-pagina.md): trilho
// var(--surface-alt) + item ativo var(--surface) com sombra leve — extraído
// de TutoriaisView/RHRecrutamentoView; as barras com item ativo em
// var(--accent) (RHFornecedores/RHCargos) migram pra este idioma.
// Sombra do item ativo usa var(--shadow-card) em vez do rgba hardcoded das
// origens, pra acompanhar o dark mode.
const SIZES = {
  md: { padding: "6px 14px", fontSize: 12, icon: 13 },
  sm: { padding: "4px 10px", fontSize: 11, icon: 12 },
};

export function Tabs({ tabs, active, onChange, size = "md" }) {
  const sz = SIZES[size] || SIZES.md;
  return (
    <div
      role="tablist"
      style={{
        display: "inline-flex",
        gap: 4,
        padding: 3,
        background: "var(--surface-alt)",
        border: "1px solid var(--border)",
        borderRadius: 10,
      }}
    >
      {tabs.map(t => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className="transition-all duration-150"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: sz.padding,
              fontSize: sz.fontSize,
              fontWeight: 700,
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              background: isActive ? "var(--surface)" : "transparent",
              color: isActive ? "var(--text)" : "var(--text-dim)",
              boxShadow: isActive ? "var(--shadow-card)" : "none",
            }}
          >
            {Icon && <Icon size={sz.icon} style={{ flexShrink: 0 }} />}
            <span>{t.label}</span>
            {t.count != null && (
              <span style={{ fontWeight: 600, opacity: 0.75 }}>({t.count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
