import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authentication: only admin/gerente users may remove users
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Autenticação necessária" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mesmo padrão de resend-invite/index.ts (achado da 2ª auditoria): checa
    // roles[] (multi-cargo), não só o cargo principal escalar — senão alguém
    // com admin/gerente como cargo ADICIONAL toma 403 indevido aqui.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, roles")
      .eq("id", userData.user.id)
      .single();
    const profileRoles: string[] = Array.isArray(profile?.roles) && profile.roles.length
      ? profile.roles
      : (profile?.role ? [profile.role] : []);

    if (!profile || !profileRoles.some((r) => ["admin", "gerente", "gerente_marketing"].includes(r))) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (user_id === userData.user.id) {
      return new Response(JSON.stringify({ error: "Não é possível remover a própria conta" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("profiles").delete().eq("id", user_id);

    // Remove também a conta no Supabase Auth — sem isso o e-mail fica "preso"
    // (o GoTrue recusa reenviar convite pra quem já tem conta, mesmo sem profile).
    const { error: authErr } = await supabase.auth.admin.deleteUser(user_id);
    if (authErr && !/not.*found/i.test(authErr.message || "")) {
      return new Response(JSON.stringify({ error: authErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
