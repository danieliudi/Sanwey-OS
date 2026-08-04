import React from "react";
import { AlignJustify, Rows3 } from "lucide-react";

// Segmentado Confortável/Compacta pro padrão "Tabela com filtro" (mockup
// Focus Flutter UI Kit aprovado 03/08) — mesmo visual de segmented control
// já usado pra Kanban/Tabela/Calendário/Análise (ver ViewToggleButton.jsx),
// escala reduzida por ser um controle secundário, não a navegação principal
// da tela.
export function TableDensityToggle({ density, onChange }) {
  return (
    <div
      className="inline-flex items-center rounded-lg border overflow-hidden"
      style={{ borderColor: "var(--border-strong)" }}
      role="tablist"
      aria-label="Densidade da tabela"
    >
      <button
        onClick={() => onChange("comfortable")}
        role="tab"
        aria-selected={density === "comfortable"}
        title="Confortável"
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
        style={{
          background: density === "comfortable" ? "var(--accent)" : "var(--surface)",
          color: density === "comfortable" ? "var(--on-accent)" : "var(--text-dim)",
        }}
      >
        <AlignJustify size={13} />
        <span className="hidden sm:inline">Confortável</span>
      </button>
      <button
        onClick={() => onChange("compact")}
        role="tab"
        aria-selected={density === "compact"}
        title="Compacta"
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
        style={{
          background: density === "compact" ? "var(--accent)" : "var(--surface)",
          color: density === "compact" ? "var(--on-accent)" : "var(--text-dim)",
        }}
      >
        <Rows3 size={13} />
        <span className="hidden sm:inline">Compacta</span>
      </button>
    </div>
  );
}

export default TableDensityToggle;
