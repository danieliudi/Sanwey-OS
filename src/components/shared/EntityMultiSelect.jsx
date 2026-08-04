import React, { useMemo, useState } from "react";
import { X, ChevronDown, Check } from "lucide-react";

// Mesma arquitetura de interação do AssigneeMultiSelect (chips removíveis +
// dropdown de checklist, overlay pra fechar ao clicar fora) mas sem o círculo
// de avatar — pensado pra registros (Entrega, Tarefa), não pessoas. Reaproveitar
// o AssigneeMultiSelect direto reintroduziria o fundo hex fixo `#1D4ED8` (feito
// pra iniciais de pessoa) num contexto onde não faz sentido.
export function EntityMultiSelect({ value = [], onChange, options = [], placeholder = "Selecionar…", emptyLabel = "Nenhum item disponível.", disabled = false }) {
  const [open, setOpen] = useState(false);

  const selectedItems = useMemo(
    () => value.map(id => options.find(o => o.id === id)).filter(Boolean),
    [value, options]
  );

  const toggle = (id) => {
    if (disabled) return;
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
  };

  const remove = (id) => {
    if (disabled) return;
    onChange(value.filter(v => v !== id));
  };

  return (
    <div style={{ position: "relative" }}>
      <div
        onClick={() => !disabled && setOpen(v => !v)}
        className="flex items-center flex-wrap gap-1.5 rounded-lg border px-2 py-1.5"
        style={{ borderColor: "var(--border)", background: "var(--surface)", cursor: disabled ? "default" : "pointer", minHeight: 34 }}
      >
        {selectedItems.length === 0 ? (
          <span className="text-xs" style={{ color: "var(--text-dim)" }}>{placeholder}</span>
        ) : (
          selectedItems.map(item => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ background: "var(--surface-alt)", color: "var(--text)" }}
            >
              {item.label}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); remove(item.id); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", display: "flex" }}
                >
                  <X size={10} />
                </button>
              )}
            </span>
          ))
        )}
        {!disabled && <ChevronDown size={13} style={{ color: "var(--text-dim)", marginLeft: "auto" }} />}
      </div>

      {open && !disabled && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 20 }} onClick={() => setOpen(false)} />
          <div
            className="rounded-lg border overflow-hidden"
            style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-pop)", zIndex: 21, maxHeight: 220, overflowY: "auto" }}
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-xs" style={{ color: "var(--text-dim)" }}>{emptyLabel}</div>
            ) : (
              options.map(item => {
                const checked = value.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item.id)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left cursor-pointer"
                    style={{ background: checked ? "var(--surface-alt)" : "none", border: "none" }}
                    onMouseEnter={e => { if (!checked) e.currentTarget.style.background = "var(--surface-alt)"; }}
                    onMouseLeave={e => { if (!checked) e.currentTarget.style.background = "none"; }}
                  >
                    <span className="text-xs font-medium flex-1" style={{ color: "var(--text)" }}>{item.label}</span>
                    {checked && <Check size={13} style={{ color: "var(--accent)" }} />}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default EntityMultiSelect;
