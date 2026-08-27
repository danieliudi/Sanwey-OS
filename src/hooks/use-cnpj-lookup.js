import { useCallback, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

// supabase-js resolve QUALQUER resposta não-2xx como `{ data: null, error:
// FunctionsHttpError }` e não parseia o corpo — então o `res?.error` do fluxo
// feliz nunca dispara num erro real, e o que chegava na tela era o
// "Edge Function returned a non-2xx status code" cru, em inglês, igual pra
// "CNPJ não encontrado na Receita" e pra "BrasilAPI fora do ar". As 4
// mensagens em português já existem no servidor (cnpj-lookup/index.ts); só
// precisam ser lidas do corpo da resposta, que vem pendurado em `e.context`.
async function readServerError(e) {
  const res = e?.context;
  if (typeof res?.json !== "function") return e;
  try {
    const body = await res.json();
    if (body?.error) return new Error(body.error + (body.hint ? ` ${body.hint}` : ""));
  } catch {
    // Corpo não-JSON ou já consumido — mantém o erro original.
  }
  return e;
}

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
      setError(await readServerError(e));
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => { setData(null); setError(null); }, []);

  return { loading, error, data, lookup, reset };
}
