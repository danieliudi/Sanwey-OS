import React, { useRef } from "react";
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

// `search.dataTour` (opcional): id de ancoragem do tour guiado contextual
// (ver src/data/feature-spotlights.js) — vai no wrapper do campo de busca,
// que é o elemento visível. Mesmo padrão de ViewToggleButton/KanbanFab.
export function FilterBar({ search, filters = [], children, trailing }) {
  const searchInputRef = useRef(null);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {search && (
        <div
          className="flex items-center gap-2"
          data-tour={search.dataTour}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "6px 12px",
            flex: "1 1 180px",
            // min-width: 0 é obrigatório aqui. O `<input>` interno tem largura
            // MÍNIMA INTRÍNSECA (atributo `size`, ~20 caracteres), e num item
            // flex o `min-width: auto` impede o box de encolher abaixo dela —
            // então este wrapper não descia de ~220px e empurrava os vizinhos
            // pra fora da linha. É a MESMA classe de bug que já mordeu esta
            // plataforma três vezes (protocolo escapando do card, chip de data
            // saindo do card, "Cancelar" saindo do card nos Sinais). Levantado
            // pelo QA adversarial de 01/09/2026, quando este componente passou
            // a viver em 11 headers a mais — alguns lotados, como Compras.
            minWidth: 0,
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
          {/* `search.disabled`: mantém o campo MONTADO e inerte, em vez de
              removê-lo. Serve pra view onde a busca não tem o que filtrar (a
              aba Automações do Meu To-do, p.ex.). Desmontar mudaria a largura
              do header ao trocar de view, que é justamente o reflow que a
              regra 11 do CLAUDE.md proíbe. */}
          <input
            ref={searchInputRef}
            type="text"
            value={search.value}
            onChange={search.onChange}
            placeholder={search.placeholder}
            disabled={Boolean(search.disabled)}
            style={{
              border: "none",
              outline: "none",
              fontSize: 12,
              color: search.disabled ? "var(--text-faint)" : "var(--text)",
              background: "transparent",
              width: "100%",
              cursor: search.disabled ? "not-allowed" : "text",
            }}
          />
          {search.value && (
            <button
              // Evento sintético mínimo pra limpar sem exigir um onClear à
              // parte — os chamadores já escrevem e => set(e.target.value).
              // Refoca o input: o X some ao limpar, e remoção do elemento
              // focado não dispara focusout — o anel do wrapper ficaria preso.
              onClick={() => {
                search.onChange({ target: { value: "" } });
                searchInputRef.current?.focus();
              }}
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
