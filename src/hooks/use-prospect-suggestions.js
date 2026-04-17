import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export function useProspectSuggestions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [seeds, setSeeds] = useState([]);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError(new Error("Supabase não configurado."));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from("prospect_seeds")
        .select("*")
        .eq("enabled", true)
        .order("fit_score", { ascending: false });
      if (err) throw err;
      setSeeds(data || []);
    } catch (e) {
      setError(e);
      setSeeds([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { loading, error, seeds, reload: load };
}
