import React from "react";

export function PageHeader({ icon: Icon, title, subtitle, actions }) {
  return (
    <div
      className="flex items-start justify-between gap-4 flex-wrap"
      style={{ marginBottom: 22, paddingBottom: 20, borderBottom: "1px solid var(--border)" }}
    >
      <div>
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 38, height: 38, borderRadius: 10, background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text)" }}
            >
              <Icon size={18} />
            </div>
          )}
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)", margin: 0 }}>
            {title}
          </h1>
        </div>
        {subtitle && (
          <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "4px 0 0 48px" }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center flex-wrap gap-2.5 flex-shrink-0">{actions}</div>}
    </div>
  );
}

export default PageHeader;
