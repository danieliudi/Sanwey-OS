import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

// Listbox custom pra substituir o <select> nativo onde o popup aberto
// importa visualmente (filtros do Funil de Vendas, item 1 do backlog de
// 28/07/2026) — o popup de um <select> é desenhado pelo SO/navegador e não
// é estilável por CSS em nenhum browser (sem border-radius, sem sombra).
// Mesma API de props que `ui/Select.jsx` (value/onChange/options/size) pra
// trocar sem reescrever quem chama; `onChange` aqui recebe o valor direto
// (não um evento), já que não existe <select> por baixo.
const SIZE_CLASSES = {
  md: "py-2 pl-3 pr-9 text-sm rounded-lg",
  sm: "py-1.5 pl-3 pr-8 text-xs rounded-xl",
};

export function Combobox({ value, onChange, options, placeholder, className = "", size = "md" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  const normalized = options.map(opt => (typeof opt === "string" ? { value: opt, label: opt } : opt));
  const selected = normalized.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (optValue) => {
    onChange(optValue);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center text-left ${sizeClass} border transition-colors duration-150 cursor-pointer`}
        style={{
          // `#E5E7EB` fixo aqui era o único hex solto do arquivo: cinza claro
          // que não escurece no dark mode, então a borda deste seletor ficava
          // acesa no meio de uma tela escura. `--border` é o token que o
          // irmão mais próximo (AssigneeMultiSelect, mesmo botão-gatilho de
          // dropdown) já usa, e tem variante dark automática.
          borderColor: open ? "var(--accent)" : "var(--border)",
          background: "var(--surface)",
          color: selected ? "var(--text)" : "var(--text-dim)",
          boxShadow: open ? "0 0 0 3px color-mix(in srgb, var(--accent) 8%, transparent)" : "none",
        }}
      >
        <span className="flex-1 truncate">{selected?.label ?? placeholder ?? ""}</span>
      </button>
      <ChevronDown
        size={14}
        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
        color="var(--text-dim)"
      />

      {open && (
        <div
          className="absolute z-20 mt-1.5 py-1 overflow-y-auto"
          style={{
            top: "100%", left: 0, minWidth: "100%", maxHeight: 280,
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 10, boxShadow: "var(--shadow-pop)",
          }}
        >
          {normalized.map(opt => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => pick(opt.value)}
                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-xs cursor-pointer"
                style={{
                  fontWeight: active ? 700 : 500,
                  background: active ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text)",
                  border: "none",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <span className="truncate">{opt.label}</span>
                {active && <Check size={12} className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Combobox;
