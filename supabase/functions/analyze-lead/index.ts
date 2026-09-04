import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Desativada 20/08/2026 (achado AL-03 da auditoria de segurança, decisão do
// Daniel): órfã, nenhuma tela usa. Não dá pra apagar o slug via ferramenta
// MCP disponível nesta sessão — só redeploy. Isto substitui o corpo original
// por um stub inerte: nunca mais chama a API da Anthropic, só responde 410.
// Remoção completa do slug (se desejada) é manual, no painel do Supabase.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }
  return new Response(
    JSON.stringify({ error: "Function desativada (achado AL-03, 20/08/2026) — sem substituto direto; ver aba IA do lead." }),
    { status: 410, headers: { "Content-Type": "application/json" } },
  );
});
