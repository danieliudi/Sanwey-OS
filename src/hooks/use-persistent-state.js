import { useEffect, useRef, useState } from "react";
import { loadJSON, saveJSON } from "../utils/storage";

const DEFAULT_DEBOUNCE_MS = 300;

// Drop-in replacement for `useState + useEffect(saveJSON)` pair.
// - Reads initial value from localStorage (or falls back to `fallback`).
// - Debounces writes (fix P2: one write per pause instead of per keystroke/drag).
// - Skips the first write (the value we just loaded doesn't need to be re-saved).
// - Sincroniza entre abas via 'storage' event.
export function usePersistentState(key, fallback, { debounceMs = DEFAULT_DEBOUNCE_MS } = {}) {
  const [value, setValue] = useState(() => loadJSON(key, fallback));
  const isFirstWrite = useRef(true);
  const timeoutRef = useRef(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Debounced write. Cleanup só limpa o timeout — NÃO faz flush síncrono
  // (o flush antigo escrevia o `value` capturado a cada mudança, desfazendo
  // o debounce e gerando race com a próxima escrita).
  useEffect(() => {
    if (isFirstWrite.current) {
      isFirstWrite.current = false;
      return;
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => saveJSON(key, value), debounceMs);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [key, value, debounceMs]);

  // Flush pendente apenas no unmount real / fechamento de aba.
  useEffect(() => {
    const flush = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
        saveJSON(key, valueRef.current);
      }
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      flush();
      window.removeEventListener("beforeunload", flush);
    };
  }, [key]);

  // Sync entre abas: se outra aba escrever a mesma key, refletir aqui.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e) => {
      if (e.key !== key || e.newValue == null) return;
      try {
        const parsed = JSON.parse(e.newValue);
        setValue(parsed);
      } catch {
        // ignora valor inválido vindo de outra origem
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  return [value, setValue];
}
