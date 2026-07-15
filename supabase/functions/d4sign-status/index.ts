import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Só reporta se os secrets do D4Sign estão presentes (sem expor os valores) —
// pra Configurações mostrar um status de "ativo"/"não configurado" sem o
// admin precisar checar os Secrets do Supabase manualmente.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return jsonResponse({ error: "Autenticação necessária" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) return jsonResponse({ error: "Sessão inválida" }, 401);

    const apiToken = Deno.env.get("D4SIGN_API_TOKEN");
    const cryptKey = Deno.env.get("D4SIGN_CRYPT_KEY");
    const safeUuid = Deno.env.get("D4SIGN_SAFE_UUID");
    const webhookSecret = Deno.env.get("D4SIGN_WEBHOOK_SECRET");
    const baseUrl = Deno.env.get("D4SIGN_BASE_URL") || "https://secure.d4sign.com.br/api/v1";

    return jsonResponse({
      configured: Boolean(apiToken && cryptKey && safeUuid),
      webhookConfigured: Boolean(webhookSecret),
      sandbox: baseUrl.includes("sandbox") || baseUrl.includes("hml"),
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Erro inesperado" }, 500);
  }
});
