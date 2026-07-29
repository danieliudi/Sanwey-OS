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
    // Authentication: only admin/gerente users may resend invites
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

    // Achado da 2ª auditoria: checava só o cargo principal escalar (profile.role)
    // — usuário com admin/gerente/gerente_marketing como cargo ADICIONAL
    // (roles[]) tomava 403 indevido pra reenviar convite.
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

    const { invitation_id } = await req.json();
    if (!invitation_id) {
      return new Response(JSON.stringify({ error: "invitation_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca o convite
    const { data: inv, error: invErr } = await supabase
      .from("invitations")
      .select("*")
      .eq("id", invitation_id)
      .single();

    if (invErr || !inv) {
      return new Response(JSON.stringify({ error: "Convite não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Nome/e-mail de quem convidou — pra personalizar o corpo do e-mail
    // (o remetente técnico do Supabase Auth é fixo por projeto, não dá pra
    // trocar por convite; isso aqui é o que dá pra personalizar de verdade).
    let invitedByName = null;
    let invitedByEmail = null;
    if (inv.invited_by) {
      const { data: inviter } = await supabase
        .from("profiles")
        .select("name, email")
        .eq("id", inv.invited_by)
        .single();
      invitedByName = inviter?.name || null;
      invitedByEmail = inviter?.email || null;
    }

    // Envia convite via Supabase Auth (magic-link de cadastro)
    // `name`: handle_new_user já lê raw_user_meta_data->>'name' antes de
    // cair no fallback local-part do e-mail (ex.: "iudiyano") — só faltava
    // o convite de fato capturar e repassar o nome (achado BUG-08/10 da
    // auditoria de QA).
    const { error: authErr } = await supabase.auth.admin.inviteUserByEmail(inv.email, {
      data: {
        name: inv.name || undefined,
        role: inv.role,
        companies: inv.companies,
        invited_by_name: invitedByName,
        invited_by_email: invitedByEmail,
      },
    });

    // Se o usuário já existe no Auth, trata como reenvio sem errar
    const alreadyRegistered = Boolean(authErr?.message?.includes("already been registered"));
    if (authErr && !alreadyRegistered) {
      return new Response(JSON.stringify({ error: authErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (alreadyRegistered) {
      // O GoTrue não reenvia e-mail de convite pra quem já tem conta confirmada —
      // marca o convite como aceito em vez de deixá-lo "aguardando" pra sempre
      // com um last_sent_at que mentiria sobre um envio que não aconteceu.
      await supabase
        .from("invitations")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invitation_id);

      return new Response(JSON.stringify({ success: true, already_registered: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atualiza last_sent_at
    await supabase
      .from("invitations")
      .update({ last_sent_at: new Date().toISOString() })
      .eq("id", invitation_id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
