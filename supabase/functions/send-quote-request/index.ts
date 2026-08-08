import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================================
// send-quote-request — Edge Function
//
// Envia por e-mail (via Resend) uma solicitação de cotação já APROVADA
// pra um fornecedor de marketing, usando o template único e editável em
// marketing_quote_email_template. Chamada pelo cliente logo após
// approve_marketing_quote() ter sucesso (gerente_marketing/admin).
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

const COMPANY_NAMES: Record<string, string> = {
  industria: "Sanwey",
  resibag: "Resibag",
};

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function applyVars(text: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value ?? ""),
    text,
  );
}

function applyVarsHtml(html: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, escapeHtml(value ?? "")),
    html,
  );
}

function formatDateBR(dateStr: string | null): string {
  if (!dateStr) return "não informado";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!m) return dateStr;
  return `${m[3]}/${m[2]}/${m[1]}`;
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

  // Achado da 2ª auditoria: checava só o cargo principal escalar (profile.role)
  // — usuário com gerente_marketing/admin como cargo ADICIONAL (roles[]) tomava
  // 403 indevido. scalar ⊆ roles, então isso só negava acesso legítimo.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, roles, name, email")
    .eq("id", userData.user.id)
    .single();
  const profileRoles: string[] = Array.isArray(profile?.roles) && profile.roles.length
    ? profile.roles
    : (profile?.role ? [profile.role] : []);
  if (!profile || !profileRoles.some((r) => ["admin", "gerente_marketing"].includes(r))) {
    return jsonResponse({ error: "Somente gerente de marketing ou admin pode enviar cotações" }, 403);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonResponse({ error: "Invalid JSON body" }, 400); }
  const quoteId = String(body?.quote_id || "");
  if (!quoteId) return jsonResponse({ error: "quote_id é obrigatório" }, 400);

  const { data: quote, error: quoteErr } = await supabase
    .from("marketing_supplier_quotes")
    .select("*, marketing_suppliers(name, email)")
    .eq("id", quoteId)
    .single();
  if (quoteErr || !quote) return jsonResponse({ error: "Cotação não encontrada" }, 404);
  if (quote.status !== "aprovada") {
    return jsonResponse({ error: "Cotação precisa estar aprovada antes de enviar o e-mail" }, 400);
  }

  const supplier = quote.marketing_suppliers as { name: string; email: string } | null;
  if (!supplier?.email) {
    return jsonResponse({ error: "Fornecedor sem e-mail cadastrado" }, 400);
  }

  const { data: tpl } = await supabase
    .from("marketing_quote_email_template")
    .select("subject, body_html")
    .single();
  if (!tpl) return jsonResponse({ error: "Template de cotação não configurado" }, 500);

  const vars = {
    SUPPLIER_NAME: supplier.name,
    TITLE: quote.title,
    DESCRIPTION: quote.description || "",
    DEADLINE: formatDateBR(quote.deadline),
    REQUESTED_BY: profile.name || profile.email || "Grupo Sanwey",
    COMPANY_NAMES: (quote.company_ids || [])
      .map((c: string) => COMPANY_NAMES[c] || c)
      .join(", ") || "Grupo Sanwey",
  };

  const subject = applyVars(tpl.subject, vars);
  const html = applyVarsHtml(tpl.body_html, vars);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    await supabase.from("marketing_supplier_quotes")
      .update({ email_error: "RESEND_API_KEY não configurada — e-mail não enviado" })
      .eq("id", quoteId);
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
      to: supplier.email,
      subject,
      html,
    }),
  });

  if (!resendRes.ok) {
    const errBody = await resendRes.text();
    await supabase.from("marketing_supplier_quotes")
      .update({ email_error: `Falha ao enviar: ${resendRes.status} ${errBody.slice(0, 200)}` })
      .eq("id", quoteId);
    return jsonResponse({ error: `Falha ao enviar e-mail: ${resendRes.status}` }, 502);
  }

  await supabase.from("marketing_supplier_quotes")
    .update({ status: "enviada", sent_at: new Date().toISOString(), email_error: null })
    .eq("id", quoteId);

  return jsonResponse({ success: true });
});
