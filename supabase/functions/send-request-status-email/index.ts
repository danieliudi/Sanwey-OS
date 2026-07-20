import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================================
// send-request-status-email — Edge Function
//
// Avisa por e-mail (via Resend) o solicitante de uma Solicitação de
// Marketing (marketing_requests) quando ela é aprovada ou rejeitada —
// antes só a tela mostrava o status, sem nenhum aviso pro autor. Chamada
// pelo cliente logo depois de approve_marketing_request()/rejectRequest()
// terem sucesso (admin/marketing/gerente_marketing). Mesmo padrão de
// send-quote-request: re-deriva tudo do banco a partir de request_id (não
// aceita `to`/`html` livres do cliente) e, se o envio falhar, grava
// email_error na própria solicitação pra tela oferecer "tentar de novo"
// sem precisar re-aprovar/rejeitar.
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

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function applyVars(html: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), escapeHtml(value ?? "")),
    html,
  );
}

function shell(inner: string, accent: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#F9F5F1;font-family:Inter,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F9F5F1;"><tr><td align="center" style="padding:48px 16px;">
    <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
      <tr><td align="center" style="padding-bottom:28px;"><img src="https://sanwey-crm.netlify.app/sanwey-logo.png" width="170" alt="Grupo Sanwey" style="display:block;height:auto;" /></td></tr>
      <tr><td style="background:#FFFFFF;border-radius:16px;border:1px solid #E5E0DA;padding:40px 40px 36px;">
        <div style="width:36px;height:3px;background:${accent};border-radius:2px;margin-bottom:28px;"></div>
        ${inner}
      </td></tr>
      <tr><td style="padding:28px 0 8px;text-align:center;">
        <p style="margin:0 0 4px;font-size:12px;color:#8A8680;line-height:1.6;">&copy; Grupo Sanwey &mdash; Commercial Intelligence Platform</p>
        <p style="margin:0;font-size:11px;color:#A09A94;line-height:1.5;">Este é um e-mail automático do sistema de Marketing.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function tplAprovado(vars: Record<string, string>): string {
  const inner = `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2C2C2B;line-height:1.25;letter-spacing:-0.01em;">Sua solicitação foi aprovada ✓</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#8A8680;line-height:1.6;">Olá, <strong style="color:#2C2C2B;">{{REQUESTER_NAME}}</strong>. Sua solicitação de marketing foi aprovada e já está em produção.</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9F5F1;border:1px solid #E5E0DA;border-radius:10px;margin-bottom:28px;"><tr><td style="padding:16px 20px;"><table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td width="35%" style="padding:5px 0;font-size:13px;color:#8A8680;">Protocolo</td><td width="65%" style="padding:5px 0;font-size:13px;color:#2C2C2B;font-weight:700;">{{PROTOCOL}}</td></tr>
      <tr><td style="padding:5px 0;font-size:13px;color:#8A8680;">Título</td><td style="padding:5px 0;font-size:13px;color:#2C2C2B;font-weight:600;">{{TITLE}}</td></tr>
    </table></td></tr></table>
    <p style="margin:0 0 0;font-size:13px;color:#8A8680;line-height:1.5;">Nossa equipe entra em contato caso precise de mais alguma informação.</p>`;
  return applyVars(shell(inner, "#16A34A"), vars);
}

function tplRejeitado(vars: Record<string, string>): string {
  const inner = `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2C2C2B;line-height:1.25;letter-spacing:-0.01em;">Solicitação não aprovada</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#8A8680;line-height:1.6;">Olá, <strong style="color:#2C2C2B;">{{REQUESTER_NAME}}</strong>. Sua solicitação de marketing não pôde ser aprovada no momento.</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9F5F1;border:1px solid #E5E0DA;border-radius:10px;margin-bottom:28px;"><tr><td style="padding:16px 20px;"><table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td width="35%" style="padding:5px 0;font-size:13px;color:#8A8680;">Protocolo</td><td width="65%" style="padding:5px 0;font-size:13px;color:#2C2C2B;font-weight:700;">{{PROTOCOL}}</td></tr>
      <tr><td style="padding:5px 0;font-size:13px;color:#8A8680;">Título</td><td style="padding:5px 0;font-size:13px;color:#2C2C2B;font-weight:600;">{{TITLE}}</td></tr>
      <tr><td style="padding:5px 0;font-size:13px;color:#8A8680;vertical-align:top;padding-top:8px;">Motivo</td><td style="padding:5px 0;font-size:13px;color:#2C2C2B;padding-top:8px;line-height:1.5;">{{REASON}}</td></tr>
    </table></td></tr></table>
    <p style="margin:0;font-size:13px;color:#8A8680;line-height:1.5;">Em caso de dúvidas, fale com a equipe de Marketing.</p>`;
  return applyVars(shell(inner, "#DC2626"), vars);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return jsonResponse({ error: "Autenticação necessária" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return jsonResponse({ error: "Sessão inválida" }, 401);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, roles")
    .eq("id", userData.user.id)
    .single();
  const profileRoles: string[] = Array.isArray(profile?.roles) && profile.roles.length
    ? profile.roles
    : (profile?.role ? [profile.role] : []);
  if (!profile || !profileRoles.some((r) => ["admin", "marketing", "gerente_marketing"].includes(r))) {
    return jsonResponse({ error: "Sem permissão para enviar e-mails de solicitação" }, 403);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonResponse({ error: "Invalid JSON body" }, 400); }
  const requestId = String(body?.request_id || "");
  if (!requestId) return jsonResponse({ error: "request_id é obrigatório" }, 400);

  const { data: request, error: reqErr } = await supabase
    .from("marketing_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (reqErr || !request) return jsonResponse({ error: "Solicitação não encontrada" }, 404);

  if (request.status !== "aprovado" && request.status !== "rejeitado") {
    return jsonResponse({ error: "Solicitação precisa estar aprovada ou rejeitada antes de enviar o e-mail" }, 400);
  }

  // E-mail do solicitante é opcional no formulário público — sem ele não
  // tem pra quem avisar; não é erro, só não há o que fazer.
  if (!request.requester_email) {
    return jsonResponse({ success: true, sent: 0 });
  }

  const vars = {
    REQUESTER_NAME: request.requester_name || "",
    PROTOCOL: request.request_number || "—",
    TITLE: request.title || "",
    REASON: request.rejection_reason || "Não informado.",
  };

  const isApproved = request.status === "aprovado";
  const subject = isApproved
    ? "Sua solicitação foi aprovada — Grupo Sanwey"
    : "Sobre sua solicitação de marketing — Grupo Sanwey";
  const html = isApproved ? tplAprovado(vars) : tplRejeitado(vars);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    await supabase.from("marketing_requests")
      .update({ email_error: "RESEND_API_KEY não configurada — e-mail não enviado" })
      .eq("id", requestId);
    return jsonResponse({ error: "RESEND_API_KEY não configurada" }, 503);
  }

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "noreply@sanwey.com.br",
      to: request.requester_email,
      subject,
      html,
    }),
  });

  if (!resendRes.ok) {
    const errBody = await resendRes.text();
    await supabase.from("marketing_requests")
      .update({ email_error: `Falha ao enviar: ${resendRes.status} ${errBody.slice(0, 200)}` })
      .eq("id", requestId);
    return jsonResponse({ error: `Falha ao enviar e-mail: ${resendRes.status}` }, 502);
  }

  await supabase.from("marketing_requests")
    .update({ email_error: null })
    .eq("id", requestId);

  return jsonResponse({ success: true, sent: 1 });
});
