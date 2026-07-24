import React, { useState } from "react";
import { LayoutGrid, List } from "lucide-react";

// Padrão C da spec (docs/design-spec-padroes-de-pagina.md, seção 3): uma
// casca só pras variantes catálogo (interactive — card é link, eleva no
// hover, kebab/"ver detalhes" por affordance progressiva) e seletor
// (não-interactive — card agrupa checkboxes, não eleva). Densidade
// grade/lista no mesmo componente (decisão fechada 23/07).

export function CardGrid({ density = "grid", children }) {
  if (density === "list") {
    return <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
      {children}
    </div>
  );
}

export function Card({
  icon,
  iconBg,
  title,
  meta,
  badges,
  status,
  footer,
  menu,
  onClick,
  interactive = Boolean(onClick),
  density = "grid",
  children,
}) {
  const [hovered, setHovered] = useState(false);
  const lifted = interactive && hovered;

  const shell = {
    position: "relative",
    background: "var(--surface)",
    border: `1px solid ${lifted ? "var(--border-strong)" : "var(--border)"}`,
    borderRadius: "var(--radius-lg)",
    boxShadow: lifted ? "var(--shadow-pop)" : "var(--shadow-card)",
    transform: lifted ? "translateY(-1px)" : "none",
    transition: "box-shadow 150ms, border-color 150ms, transform 150ms",
    cursor: interactive ? "pointer" : "default",
  };

  // div com role="button" em vez de <button>: o kebab é um botão dentro do
  // card, e button aninhado em button é HTML inválido.
  const interactiveProps = interactive
    ? {
        role: "button",
        tabIndex: 0,
        onClick,
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.(e);
          }
        },
      }
    : {};

  const hoverProps = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  };

  if (density === "list") {
    return (
      <div
        {...interactiveProps}
        {...hoverProps}
        style={{ ...shell, display: "flex", alignItems: "center", gap: 12, minHeight: 56, padding: "8px 14px" }}
      >
        {icon && (
          <div
            style={{
              width: 26, height: 26, borderRadius: 6, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: iconBg || "var(--surface-alt)", color: "var(--text-dim)",
            }}
          >
            {icon}
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {title}
          </span>
          {meta && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>{meta}</span>}
        </div>
        {status && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "var(--text-dim)", flexShrink: 0 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: status.color || "var(--text-dim)" }} />
            {status.label}
          </span>
        )}
        {footer != null && (
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", flexShrink: 0, marginLeft: "auto" }}>
            {footer}
          </div>
        )}
        {interactive && menu && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ opacity: hovered ? 1 : 0, transition: "opacity 120ms", flexShrink: 0 }}
          >
            {menu}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      {...interactiveProps}
      {...hoverProps}
      style={{ ...shell, display: "flex", flexDirection: "column", gap: 8, padding: 16 }}
    >
      {interactive && menu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ position: "absolute", top: 10, right: 10, opacity: hovered ? 1 : 0, transition: "opacity 120ms" }}
        >
          {menu}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {icon && (
          <div
            style={{
              width: 38, height: 38, borderRadius: 8, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: iconBg || "var(--surface-alt)", color: "var(--text-dim)",
            }}
          >
            {icon}
          </div>
        )}
        <div style={{ minWidth: 0, paddingRight: menu ? 22 : 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{title}</div>
          {meta && <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>{meta}</div>}
        </div>
      </div>
      {badges && <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>{badges}</div>}
      {children}
      {(footer != null || interactive) && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            marginTop: "auto",
            paddingTop: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            fontSize: 12,
          }}
        >
          <div style={{ color: "var(--text)", fontWeight: 600, minWidth: 0 }}>{footer}</div>
          {interactive && (
            <span style={{ color: "var(--accent)", fontWeight: 600, whiteSpace: "nowrap", opacity: hovered ? 1 : 0, transition: "opacity 120ms" }}>
              Ver detalhes
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// animate-pulse do Tailwind faz o shimmer — não há keyframe global em
// index.css e a spec pede pra não criar um sem necessidade.
export function CardSkeleton({ density = "grid" }) {
  const block = { background: "var(--surface-alt)", borderRadius: 6 };
  const shell = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-card)",
  };

  if (density === "list") {
    return (
      <div
        className="animate-pulse"
        aria-hidden="true"
        style={{ ...shell, display: "flex", alignItems: "center", gap: 12, minHeight: 56, padding: "8px 14px" }}
      >
        <div style={{ ...block, width: 26, height: 26 }} />
        <div style={{ ...block, height: 10, width: "40%" }} />
        <div style={{ ...block, height: 10, width: 56, marginLeft: "auto" }} />
      </div>
    );
  }

  return (
    <div
      className="animate-pulse"
      aria-hidden="true"
      style={{ ...shell, display: "flex", flexDirection: "column", gap: 10, padding: 16 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ ...block, width: 38, height: 38, borderRadius: 8 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
          <div style={{ ...block, height: 11, width: "60%" }} />
          <div style={{ ...block, height: 9, width: "40%" }} />
        </div>
      </div>
      <div style={{ ...block, height: 9, width: "80%" }} />
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 2 }}>
        <div style={{ ...block, height: 10, width: "35%" }} />
      </div>
    </div>
  );
}

// Oficializa o idioma que existia 1× em RHCargosView (Movimentações) —
// mesmo visual, só o rótulo vira prop.
export function GridListToggle({ value, onChange, labels = { grid: "Cards", list: "Lista" } }) {
  const options = [
    { id: "grid", label: labels.grid, Icon: LayoutGrid },
    { id: "list", label: labels.list, Icon: List },
  ];
  return (
    <div className="inline-flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      {options.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          aria-pressed={value === id}
          className="flex items-center gap-1.5"
          style={{
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            background: value === id ? "var(--accent)" : "transparent",
            color: value === id ? "#FFF" : "var(--text-dim)",
          }}
        >
          <Icon size={13} /> {label}
        </button>
      ))}
    </div>
  );
}

export default Card;
