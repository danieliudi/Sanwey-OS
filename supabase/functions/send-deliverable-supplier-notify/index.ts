import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================================
// send-deliverable-supplier-notify — Edge Function
//
// Avisa por e-mail (via Resend) o fornecedor vinculado à Campanha quando
// uma Entrega de Marketing (marketing_deliverables) é criada. Entregas não
// têm fornecedor próprio — o vínculo é sempre via Campanha
// (marketing_campaigns.supplier_id → marketing_suppliers), então dispara
// só quando a Campanha da Entrega já tem um fornecedor cadastrado; sem
// campanha, ou campanha sem fornecedor, ou fornecedor sem e-mail, não é
// erro — só não há pra quem avisar (mesmo espírito de
// send-deliverable-complete-email quando requester_email está vazio).
//
// Mesmo padrão dos demais: re-deriva tudo do banco a partir de
// deliverable_id (não aceita `to`/`html` livres do cliente).
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

function formatDateBR(dateStr: string | null): string {
  if (!dateStr) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!m) return dateStr;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

// Mesmo hex já usado em send-request-status-email para o estado
// "vermelho" da família de e-mails (rejeitado) — reaproveitado aqui como a
// cor de marca pedida ("vermelho e branco, sempre"), não um tom novo.
const BRAND_RED = "#DC2626";

const PRIORITY_LABELS: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta" };
const PRIORITY_COLORS: Record<string, string> = { baixa: "#16A34A", media: "#D97706", alta: "#DC2626" };

function shell(inner: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#F9F5F1;font-family:Inter,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F9F5F1;"><tr><td align="center" style="padding:48px 16px;">
    <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
      <tr><td align="center" style="padding-bottom:28px;"><img src="https://sanwey-crm.netlify.app/sanwey-logo.png" width="170" alt="Grupo Sanwey" style="display:block;height:auto;" /></td></tr>
      <tr><td style="background:#FFFFFF;border-radius:16px;border:1px solid #E5E0DA;padding:40px 40px 36px;">
        <div style="width:36px;height:3px;background:${BRAND_RED};border-radius:2px;margin-bottom:28px;"></div>
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

function tplNovaEntrega(vars: Record<string, string>): string {
  const inner = `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2C2C2B;line-height:1.25;letter-spacing:-0.01em;">Nova entrega para vocês</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#8A8680;line-height:1.6;">Olá, <strong style="color:#2C2C2B;">{{SUPPLIER_NAME}}</strong>. Uma nova entrega foi cadastrada vinculada à campanha de vocês no Grupo Sanwey.</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9F5F1;border:1px solid #E5E0DA;border-radius:10px;margin-bottom:28px;"><tr><td style="padding:16px 20px;"><table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td width="35%" style="padding:5px 0;font-size:13px;color:#8A8680;">Campanha</td><td width="65%" style="padding:5px 0;font-size:13px;color:#2C2C2B;font-weight:600;">{{CAMPAIGN_NAME}}</td></tr>
      <tr><td style="padding:5px 0;font-size:13px;color:#8A8680;">Entrega</td><td style="padding:5px 0;font-size:13px;color:#2C2C2B;font-weight:700;">{{TITLE}}</td></tr>
      <tr><td style="padding:5px 0;font-size:13px;color:#8A8680;">Prioridade</td><td style="padding:5px 0;font-size:13px;"><span style="background:{{PRIORITY_BG}};color:{{PRIORITY_COLOR}};font-weight:700;font-size:11px;padding:2px 8px;border-radius:999px;">{{PRIORITY_LABEL}}</span></td></tr>
      <tr><td style="padding:5px 0;font-size:13px;color:#8A8680;">Prazo</td><td style="padding:5px 0;font-size:13px;color:#2C2C2B;font-weight:600;">{{DEADLINE}}</td></tr>
      <tr><td style="padding:5px 0;font-size:13px;color:#8A8680;">Solicitado por</td><td style="padding:5px 0;font-size:13px;color:#2C2C2B;">{{REQUESTED_BY}}</td></tr>
    </table></td></tr></table>
    <p style="margin:0;font-size:13px;color:#8A8680;line-height:1.5;">Em caso de dúvidas, fale com a equipe de Marketing do Grupo Sanwey.</p>`;
  return applyVars(shell(inner), vars);
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
    return jsonResponse({ error: "Sem permissão para enviar e-mails de entrega" }, 403);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonResponse({ error: "Invalid JSON body" }, 400); }
  const deliverableId = String(body?.deliverable_id || "");
  if (!deliverableId) return jsonResponse({ error: "deliverable_id é obrigatório" }, 400);

  const { data: deliverable, error: delErr } = await supabase
    .from("marketing_deliverables")
    .select("*")
    .eq("id", deliverableId)
    .single();
  if (delErr || !deliverable) return jsonResponse({ error: "Entrega não encontrada" }, 404);

  if (!deliverable.campaign_id) return jsonResponse({ success: true, sent: 0 });

  const { data: campaign } = await supabase
    .from("marketing_campaigns")
    .select("name, supplier_id")
    .eq("id", deliverable.campaign_id)
    .single();
  if (!campaign?.supplier_id) return jsonResponse({ success: true, sent: 0 });

  const { data: supplier } = await supabase
    .from("marketing_suppliers")
    .select("name, email")
    .eq("id", campaign.supplier_id)
    .single();
  if (!supplier?.email) return jsonResponse({ success: true, sent: 0 });

  const priority = String(deliverable.priority || "media");
  const vars = {
    SUPPLIER_NAME: supplier.name || "",
    CAMPAIGN_NAME: campaign.name || "",
    TITLE: deliverable.title || "",
    PRIORITY_LABEL: PRIORITY_LABELS[priority] || priority,
    PRIORITY_COLOR: PRIORITY_COLORS[priority] || "#5C574E",
    PRIORITY_BG: `${PRIORITY_COLORS[priority] || "#5C574E"}18`,
    // Prazo passou a ser obrigatório em Entregas novas — vazio aqui só
    // acontece pra entregas criadas antes dessa regra existir.
    DEADLINE: formatDateBR(deliverable.deadline),
    REQUESTED_BY: deliverable.requester_name || "Grupo Sanwey",
  };

  const subject = "Nova entrega para vocês — Grupo Sanwey";
  const html = tplNovaEntrega(vars);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return jsonResponse({ error: "RESEND_API_KEY não configurada" }, 503);

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "noreply@sanwey.com.br",
      to: supplier.email,
      subject,
      html,
    }),
  });

  if (!resendRes.ok) {
    const errBody = await resendRes.text();
    return jsonResponse({ error: `Falha ao enviar e-mail: ${resendRes.status} ${errBody.slice(0, 200)}` }, 502);
  }

  return jsonResponse({ success: true, sent: 1 });
});
