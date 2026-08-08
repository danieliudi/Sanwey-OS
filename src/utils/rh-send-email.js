import { supabase } from "../lib/supabase";

// Envia e-mail transacional de RH via edge function rh-send-email —
// fire-and-forget com log de erro (nunca trava o fluxo chamador). Só
// RH/gerente_rh/admin conseguem disparar (checado pela própria função).
// `to`/`variables` continuam indo no body por compatibilidade de payload,
// mas pros tipos "endurecidos" (ver rh-send-email/index.ts, auditoria de
// 08/08/2026) a edge function IGNORA esses dois e re-deriva tudo a partir
// do id de registro passado em `extra` (ex.: `{ colaboradorId }`,
// `{ contratoId }`, `{ agendamentoId }`) — sem o id certo pro tipo, a
// função responde 400 em vez de mandar com o valor não confiável.
export async function sendRhEmail(type, to, variables = {}, extra = {}) {
  if (!to) return false;
  try {
    const { error } = await supabase.functions.invoke("rh-send-email", {
      body: { type, to, variables: { APP_URL: window.location.origin, ...variables }, ...extra },
    });
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn(`[rh-send-email] falha ao enviar "${type}" para ${to}:`, err);
    return false;
  }
}
