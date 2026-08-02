import { useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const PROBE_TIMEOUT_MS = 4000;
const RETRY_DELAY_MS = 5000;

// navigator.onLine sozinho não é confiável (fica true em wifi conectado sem
// internet de verdade) — sondagem real com uma chamada leve já existente no
// client, com timeout curto pra não travar a UI esperando um socket morto.
async function probeConnection() {
  if (!isSupabaseConfigured) return navigator.onLine;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const { error } = await supabase
      .from("profiles")
      .select("id")
      .limit(1)
      .abortSignal(controller.signal);
    return !error;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function useConnectivity() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const retryTimerRef = useRef(null);

  useEffect(() => {
    let active = true;

    const clearRetry = () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const tryProbe = async () => {
      const ok = await probeConnection();
      if (!active) return;
      if (ok) {
        setIsOnline(true);
        clearRetry();
      } else {
        setIsOnline(false);
        retryTimerRef.current = setTimeout(tryProbe, RETRY_DELAY_MS);
      }
    };

    // Evento "offline" do browser é imediato e confiável — marca na hora,
    // sem sondagem. "online" só é confirmado depois da sondagem passar.
    const handleOnline = () => { clearRetry(); tryProbe(); };
    const handleOffline = () => { clearRetry(); setIsOnline(false); };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      active = false;
      clearRetry();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline };
}
