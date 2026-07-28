import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// Autocomplete de endereço (Google Places, via proxy places-autocomplete) —
// debounced, com abort da busca anterior. Falha "limpa": qualquer erro (sem
// chave configurada, Google fora do ar, sem resultado) só zera as sugestões,
// nunca trava o campo — ele continua sendo texto livre por baixo.
export function usePlacesAutocomplete({ minLength = 3, delayMs = 350 } = {}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef(null);
  const requestIdRef = useRef(0);

  const search = useCallback((query) => {
    clearTimeout(timeoutRef.current);
    const text = (query || "").trim();
    if (text.length < minLength || !isSupabaseConfigured) {
      setSuggestions([]);
      return;
    }
    const myRequestId = ++requestIdRef.current;
    timeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("places-autocomplete", { body: { input: text } });
        if (myRequestId !== requestIdRef.current) return; // resposta de uma busca já obsoleta
        if (error || data?.error) { setSuggestions([]); return; }
        setSuggestions(data?.suggestions || []);
      } catch {
        if (myRequestId === requestIdRef.current) setSuggestions([]);
      } finally {
        if (myRequestId === requestIdRef.current) setLoading(false);
      }
    }, delayMs);
  }, [minLength, delayMs]);

  const clear = useCallback(() => {
    clearTimeout(timeoutRef.current);
    requestIdRef.current++;
    setSuggestions([]);
    setLoading(false);
  }, []);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  return { suggestions, loading, search, clear };
}

export default usePlacesAutocomplete;
