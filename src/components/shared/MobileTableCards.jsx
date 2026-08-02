import React from "react";
import { stageTextColor } from "../../utils/stage-colors";

// Decisão 4A (mockup aprovado 02/08/2026): abaixo de md a <table> das visões
// "Tabela" cortava colunas inteiras em silêncio — no mobile a mesma lista vira
// cards empilhados, molde do Funil de Vendas (CRMView.jsx, visão table).
// Este componente renderiza só a metade mobile (md:hidden); a <table> de cada
// tela ganha hidden md:block e fica intacta no desktop.
export function MobileTableCards({
  rows,
  rowKey,
  onRowClick,
  emptyMessage,
  title,
  chips,
  right,
  meta,
  metaRight,
}) {
  if (rows.length === 0) {
    return (
      <div
        className="md:hidden rounded-2xl border text-center py-10 text-sm"
        style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
      >
        {emptyMessage}
      </div>
    );
  }
  return (
    <div className="md:hidden space-y-2">
      {rows.map((row) => {
        const chipList = (chips ? chips(row) : []).filter(Boolean);
        const rightNode = right ? right(row) : null;
        const metaNode = meta ? meta(row) : null;
        const metaRightNode = metaRight ? metaRight(row) : null;
        return (
          <div
            key={rowKey ? rowKey(row) : row.id}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className="rounded-xl border p-3"
            style={{ borderColor: "var(--border)", background: "var(--surface)", cursor: onRowClick ? "pointer" : "default" }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate" style={{ color: "var(--text)" }}>{title(row)}</div>
                {chipList.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    {chipList.map((chip, i) => (
                      <span
                        key={i}
                        className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ background: chip.color + "18", color: stageTextColor(chip.color), border: `1px solid ${chip.color}40` }}
                      >
                        {chip.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {rightNode != null && <div className="shrink-0">{rightNode}</div>}
            </div>
            {(metaNode != null || metaRightNode != null) && (
              <div className="flex items-center justify-between gap-2 mt-2 text-xs" style={{ color: "var(--text-dim)" }}>
                <div className="flex items-center gap-1.5 min-w-0 truncate">{metaNode}</div>
                {metaRightNode != null && <div className="flex items-center gap-1.5 shrink-0">{metaRightNode}</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
