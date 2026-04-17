import { useCallback, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export function useCnpjLookup() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const lookup = useCallback(async (cnpj, { refresh = false } = {}) => {
    if (!isSupabaseConfigured) {
      setError(new Error("Supabase não configurado."));
      return null;
    }
    setError(null);
    setLoading(true);
    try {
      const { data: res, error: err } = await supabase.functions.invoke("cnpj-lookup", {
        body: { cnpj, refresh },
      });
      if (err) throw err;
      if (res?.error) throw new Error(res.error + (res.hint ? ` ${res.hint}` : ""));
      setData(res);
      return res;
    } catch (e) {
      setError(e);
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => { setData(null); setError(null); }, []);

  return { loading, error, data, lookup, reset };
}
