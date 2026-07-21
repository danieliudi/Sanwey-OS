import { supabase } from "../lib/supabase";

// Envia e-mail transacional de RH via edge function rh-send-email —
// fire-and-forget com log de erro (nunca trava o fluxo chamador). Só
// RH/gerente_rh/admin conseguem disparar (checado pela própria função).
export async function sendRhEmail(type, to, variables = {}) {
  if (!to) return false;
  try {
    const { error } = await supabase.functions.invoke("rh-send-email", {
      body: { type, to, variables: { APP_URL: window.location.origin, ...variables } },
    });
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn(`[rh-send-email] falha ao enviar "${type}" para ${to}:`, err);
    return false;
  }
}
