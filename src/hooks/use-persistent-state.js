import { useEffect, useRef, useState } from "react";
import { loadJSON, saveJSON } from "../utils/storage";

const DEFAULT_DEBOUNCE_MS = 300;

// Drop-in replacement for `useState + useEffect(saveJSON)` pair.
// - Reads initial value from localStorage (or falls back to `fallback`).
// - Debounces writes (fix P2: one write per pause instead of per keystroke/drag).
// - Skips the first write (the value we just loaded doesn't need to be re-saved).
export function usePersistentState(key, fallback, { debounceMs = DEFAULT_DEBOUNCE_MS } = {}) {
  const [value, setValue] = useState(() => loadJSON(key, fallback));
  const isFirstWrite = useRef(true);
  const timeoutRef = useRef(null);

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

  // Flush any pending write on unmount / tab close.
  useEffect(() => {
    const flush = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        saveJSON(key, value);
      }
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      flush();
      window.removeEventListener("beforeunload", flush);
    };
  }, [key, value]);

  return [value, setValue];
}
