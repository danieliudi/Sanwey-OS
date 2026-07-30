import { useCallback, useState } from "react";

// Ordenação por COLUNA (30/07/2026, pedido do Daniel: "pra cada etapa, eu
// poder organizar como eu quero ver ela") — evolução do que existia antes
// (um critério só pra dashboard/board inteiro). Guarda um mapa
// { [stageId]: criteria } no localStorage, uma chave por board — mesma
// preferência de navegador de sempre (item 6 original), não vira coluna de
// servidor nem afeta o que outras pessoas veem.
export function useKanbanColumnSort(boardKey, defaultValue = "recent") {
  const storageKey = `kanban-sort:${boardKey}`;
  const [map, setMap] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });

  const getCriteria = useCallback((stageId) => map[stageId] || defaultValue, [map, defaultValue]);

  const setCriteria = useCallback((stageId, next) => {
    setMap((prev) => {
      const merged = { ...prev, [stageId]: next };
      try { localStorage.setItem(storageKey, JSON.stringify(merged)); } catch { /* modo privado — só não persiste */ }
      return merged;
    });
  }, [storageKey]);

  return { getCriteria, setCriteria };
}

export default useKanbanColumnSort;
