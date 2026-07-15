import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Item 12 — recebe os callbacks do D4Sign (documento assinado, recusado
// etc.) e atualiza rh_signature_requests. Público (sem JWT — o D4Sign não
// tem sessão nossa); autenticação própria via HMAC (D4SIGN_WEBHOOK_SECRET,
// o mesmo valor passado no registerwebhook em d4sign-send).
//
// AINDA NÃO testado contra um callback real do D4Sign (sem credenciais até
// o momento) — o nome exato do campo de evento/hash no payload deve ser
// conferido contra a conta real assim que a chave chegar; por ora segue a
// documentação pública da API (hash = sha256(uuid_documento + secret)).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Eventos do D4Sign que indicam assinatura concluída — nomes conforme a
// documentação pública; ajustar se a conta real usar rótulos diferentes.
const SIGNED_EVENTS = new Set(["documents-finish", "document-signed", "signature-completed"]);
const REFUSED_EVENTS = new Set(["signer-refused", "document-refused"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const webhookSecret = Deno.env.get("D4SIGN_WEBHOOK_SECRET");
    const body = await req.json().catch(() => ({}));

    const documentUuid = body.uuid || body.uuid_document || body.document_uuid;
    const eventType = body.type_post || body.event || body.type;

    if (!documentUuid) return jsonResponse({ error: "Payload sem uuid do documento." }, 400);

    // Verificação de assinatura do webhook — só pula se ainda não temos
    // secret configurado (fase de preparo, antes das credenciais reais).
    if (webhookSecret) {
      const receivedHash = req.headers.get("hash") || req.headers.get("x-d4sign-hash") || "";
      const expectedHash = await sha256Hex(`${documentUuid}${webhookSecret}`);
      if (!receivedHash || receivedHash !== expectedHash) {
        return jsonResponse({ error: "Assinatura do webhook inválida." }, 401);
      }
    }

    const { data: existing } = await supabase
      .from("rh_signature_requests")
      .select("id")
      .eq("d4sign_document_uuid", documentUuid)
      .maybeSingle();

    if (!existing) return jsonResponse({ error: "Documento não encontrado." }, 404);

    const patch: Record<string, unknown> = {
      last_webhook_event: eventType || null,
      last_webhook_at: new Date().toISOString(),
    };
    if (eventType && SIGNED_EVENTS.has(eventType)) {
      patch.status = "assinado";
      patch.signed_at = new Date().toISOString();
    } else if (eventType && REFUSED_EVENTS.has(eventType)) {
      patch.status = "recusado";
    }

    const { error: updateErr } = await supabase
      .from("rh_signature_requests")
      .update(patch)
      .eq("id", existing.id);
    if (updateErr) return jsonResponse({ error: updateErr.message }, 500);

    return jsonResponse({ ok: true });
  } catch (err: any) {
    return jsonResponse({ error: err.message || "Erro inesperado." }, 500);
  }
});
