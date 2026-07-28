import React from "react";
import { Combobox } from "./Combobox";
import { SORT_OPTIONS } from "../../utils/kanban-sort";

// Seletor "Ordenar por" do board inteiro (item 6, 28/07/2026) — um só pro
// board, não por coluna individual (mais simples de revisar, mesma decisão
// registrada no plano). Reaproveita o Combobox custom já criado pro item 1.
//
// `include` (opcional): restringe as opções aos critérios que fazem sentido
// pro domínio (ex.: Entregas não tem valor monetário — sem isso, escolher
// "Valor" pareceria não fazer nada, já que o sortKanbanItems cai de volta
// pro "recent" quando falta o getter).
export function KanbanSortSelect({ value, onChange, className = "", include }) {
  const options = include ? SORT_OPTIONS.filter(o => o.value === "recent" || include.includes(o.value)) : SORT_OPTIONS;
  return (
    <Combobox
      value={value}
      onChange={onChange}
      options={options}
      className={className}
      size="sm"
    />
  );
}

export default KanbanSortSelect;
