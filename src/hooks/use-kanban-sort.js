import { useState, useCallback } from "react";

// Persiste o critério de ordenação por board no localStorage — preferência
// de navegador, não precisa virar coluna de servidor pra isso (item 6).
export function useKanbanSort(boardKey, defaultValue = "recent") {
  const storageKey = `kanban-sort:${boardKey}`;
  const [criteria, setCriteriaState] = useState(() => {
    try {
      return localStorage.getItem(storageKey) || defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setCriteria = useCallback((next) => {
    setCriteriaState(next);
    try { localStorage.setItem(storageKey, next); } catch { /* localStorage indisponível (modo privado) — só não persiste */ }
  }, [storageKey]);

  return [criteria, setCriteria];
}

export default useKanbanSort;
