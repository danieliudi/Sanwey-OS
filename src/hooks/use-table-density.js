import { useState, useCallback } from "react";

// Densidade de linha de tabela (Confortável/Compacta), persistida por
// usuário via localStorage — mesmo espírito do toggle grade/lista já usado
// em CardGrid (src/components/shared/Card.jsx), generalizado pro padrão
// "Tabela com filtro" (mockup Focus Flutter UI Kit aprovado 03/08).
export function useTableDensity(storageKey) {
  const [density, setDensityState] = useState(() => {
    try {
      return window.localStorage.getItem(storageKey) === "compact" ? "compact" : "comfortable";
    } catch {
      return "comfortable";
    }
  });

  const setDensity = useCallback((next) => {
    setDensityState(next);
    try { window.localStorage.setItem(storageKey, next); } catch {}
  }, [storageKey]);

  return [density, setDensity];
}

export default useTableDensity;
