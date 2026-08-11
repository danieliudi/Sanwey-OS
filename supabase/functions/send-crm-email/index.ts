import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================================
// send-crm-email — Edge Function
//
// Envia (via Resend) um e-mail composto pelo vendedor/consultor/gerente pra
// um lead do Funil de Vendas — aba "Email" do LeadDetailDrawer. Substitui o
// mailto: que existia antes (handleStartOutreach), que só registrava
// "iniciado" sem nunca confirmar envio de verdade.
//
// Substituição de variável ({{contato}}/{{empresa}}/{{vendedor}}) já
// acontece no client, antes de chamar esta função — o client manda subject/
// bodyHtml finais (já escapados — ver src/utils/html.js), pra o vendedor ver
// exatamente o que vai ser enviado enquanto edita. Esta função não
// reprocessa variáveis, só valida acesso ao lead e envia.
//
// Checagem de acesso: revisão de QA (11/08/2026) achou que a 1ª versão
// reimplementava o predicado de leads_select à mão em TypeScript — e já
// tinha divergido dele (checava profile.role singular em vez de roles[],
// lead.owner em vez de owner_ids, sem ramo de consultor, sem fronteira de
// setor). Em vez de reimplementar (e arriscar divergir nova vez que a RLS
// mudar), a checagem agora usa um client autenticado como o PRÓPRIO usuário
// (JWT dele, não service role) só pra ler o lead — se `leads_select` (RLS)
// não deixar, a query volta vazia e a gente nega. RLS de `leads` passa a ser
// a única fonte de verdade, nunca dessincroniza.
// ============================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return jsonResponse({ error: "Autenticação necessária" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  // Service role — só pra auth.getUser, ler o nome do perfil (cosmético, pro
  // "from" do e-mail) e gravar o log (lead_emails não tem policy de INSERT
  // pro client de propósito).
  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Client autenticado como o usuário de verdade — é ESTE que decide se o
  // usuário enxerga o lead (RLS leads_select), não uma reimplementação manual.
  const supabaseAsUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return jsonResponse({ error: "Sessão inválida" }, 401);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonResponse({ error: "Invalid JSON body" }, 400); }
  const leadId = String(body?.leadId || "");
  const toEmail = String(body?.toEmail || "").trim();
  const subject = String(body?.subject || "").trim();
  const bodyHtml = String(body?.bodyHtml || "");
  const templateId = body?.templateId ? String(body.templateId) : null;

  if (!leadId || !toEmail || !subject || !bodyHtml) {
    return jsonResponse({ error: "leadId, toEmail, subject e bodyHtml são obrigatórios" }, 400);
  }
  if (!isValidEmail(toEmail)) return jsonResponse({ error: "Endereço de e-mail inválido" }, 400);

  // RLS (leads_select) decide aqui — sem linha de volta = sem acesso, ponto.
  const { data: lead } = await supabaseAsUser
    .from("leads")
    .select("id, company")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return jsonResponse({ error: "Você não tem acesso a este lead" }, 403);

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("name")
    .eq("id", userData.user.id)
    .single();

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    await supabaseAdmin.from("lead_emails").insert({
      lead_id: leadId, template_id: templateId, to_email: toEmail, subject, body_html: bodyHtml,
      sent_by: userData.user.id, status: "failed", error_message: "RESEND_API_KEY não configurada",
    });
    return jsonResponse({ error: "RESEND_API_KEY não configurada" }, 503);
  }

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${profile?.name || "Grupo Sanwey"} <noreply@sanwey.com.br>`,
      to: toEmail,
      subject,
      html: bodyHtml,
    }),
  });

  if (!resendRes.ok) {
    const errBody = await resendRes.text();
    await supabaseAdmin.from("lead_emails").insert({
      lead_id: leadId, template_id: templateId, to_email: toEmail, subject, body_html: bodyHtml,
      sent_by: userData.user.id, status: "failed", error_message: `${resendRes.status} ${errBody.slice(0, 200)}`,
    });
    return jsonResponse({ error: `Falha ao enviar e-mail: ${resendRes.status}` }, 502);
  }

  const resendData = await resendRes.json().catch(() => ({}));

  await supabaseAdmin.from("lead_emails").insert({
    lead_id: leadId, template_id: templateId, to_email: toEmail, subject, body_html: bodyHtml,
    sent_by: userData.user.id, status: "sent", resend_message_id: resendData?.id || null,
  });

  // NÃO grava em public.activities (tabela separada, usada por outro fluxo —
  // agent_suggestion/agent_enrich/etc., ver RLS activities_diretoria_read).
  // A aba "Atividades" do lead lê `leads.activities` (array jsonb na própria
  // linha, via onAddActivity/use-leads.js), não essa tabela — quem chama esta
  // função (LeadDetailDrawer) grava lá depois de um 200 daqui, mesmo padrão
  // que handleStartOutreach já usava pro mailto:.
  return jsonResponse({ success: true, resendId: resendData?.id || null });
});
