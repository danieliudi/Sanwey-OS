import React from "react";
import { Search, X } from "lucide-react";

// ui/Input e ui/Select não entram por baixo de propósito: Select fixa
// #FFFFFF/#E5E7EB (quebra dark mode) e Input é text-sm/rounded-sm — o visual
// dominante das toolbars (RHFuncionariosView:1483-1570, RHCargosView:663-683)
// é o compacto text-xs/rounded-xl com tokens, extraído aqui.
const selectStyle = {
  borderColor: "var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
};

export function FilterBar({ search, filters = [], children, trailing }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {search && (
        <div
          className="flex items-center gap-2"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "6px 12px",
            flex: "1 1 180px",
            maxWidth: 280,
            transition: "border-color 150ms, box-shadow 150ms",
          }}
          // Foco visível no wrapper (equivalente a :focus-within) — o input
          // interno tem outline none, então sem isto o foco fica invisível.
          onFocus={e => {
            e.currentTarget.style.borderColor = "var(--border-strong)";
            e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-tint)";
          }}
          onBlur={e => {
            if (e.currentTarget.contains(e.relatedTarget)) return;
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <Search size={13} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
          <input
            type="text"
            value={search.value}
            onChange={search.onChange}
            placeholder={search.placeholder}
            style={{
              border: "none",
              outline: "none",
              fontSize: 12,
              color: "var(--text)",
              background: "transparent",
              width: "100%",
            }}
          />
          {search.value && (
            <button
              // Evento sintético mínimo pra limpar sem exigir um onClear à
              // parte — os chamadores já escrevem e => set(e.target.value).
              onClick={() => search.onChange({ target: { value: "" } })}
              aria-label="Limpar busca"
              style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: 0, display: "flex" }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}
      {filters.map(f => (
        <select
          key={f.id}
          value={f.value}
          onChange={f.onChange}
          aria-label={f.label}
          className="text-xs rounded-xl border px-3 py-1.5 outline-none cursor-pointer"
          style={{ ...selectStyle, transition: "border-color 150ms, box-shadow 150ms" }}
          onFocus={e => {
            e.currentTarget.style.borderColor = "var(--border-strong)";
            e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-tint)";
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          {(f.options || []).map(opt =>
            typeof opt === "string"
              ? <option key={opt} value={opt}>{opt}</option>
              : <option key={opt.value} value={opt.value}>{opt.label}</option>
          )}
        </select>
      ))}
      {children}
      {trailing && <div className="flex items-center gap-2 ml-auto">{trailing}</div>}
    </div>
  );
}

export default FilterBar;
