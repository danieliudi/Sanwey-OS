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
      .select("role, roles, companies")
      .eq("id", userData.user.id)
      .single();
    const profileRoles: string[] = Array.isArray(profile?.roles) && profile.roles.length
      ? profile.roles
      : (profile?.role ? [profile.role] : []);

    if (!profile || !profileRoles.some((r) => ["admin", "gerente", "gerente_marketing", "gerente_rh"].includes(r))) {
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

    // Achado ALTO da auditoria de segurança (19/08/2026): a checagem acima só
    // valida QUEM está pedindo, nunca QUEM está sendo apagado — um
    // gerente_marketing/gerente_rh conseguia excluir a conta do admin, ou de
    // qualquer empresa, porque a função roda com service_role e ignora a RLS
    // de `profiles_delete`. Espelha aqui o mesmo predicado que já protege a
    // tabela: admin apaga qualquer um; gerente só apaga não-admin de empresa
    // em comum.
    const isCallerAdmin = profileRoles.includes("admin");
    if (!isCallerAdmin) {
      const { data: target } = await supabase
        .from("profiles")
        .select("roles, companies")
        .eq("id", user_id)
        .maybeSingle();
      if (!target) {
        return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const targetRoles: string[] = Array.isArray(target.roles) ? target.roles : [];
      if (targetRoles.includes("admin")) {
        return new Response(JSON.stringify({ error: "Sem permissão para remover uma conta admin" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const callerCompanies: string[] = Array.isArray(profile?.companies) ? profile.companies : [];
      const targetCompanies: string[] = Array.isArray(target.companies) ? target.companies : [];
      const sharesCompany = targetCompanies.some((c) => callerCompanies.includes(c));
      if (!sharesCompany) {
        return new Response(JSON.stringify({ error: "Sem permissão para remover usuário de outra empresa" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Tenta apagar o registro de RH vinculado (rh_colaboradores.profile_id
    // ON DELETE SET NULL) ANTES do profile — depois disso profile_id já
    // teria virado null e não daria mais pra achar a linha por aqui. Falha
    // (ex.: colaborador com histórico real — benefícios, holerite, ponto —
    // apontando pra ele via FK sem ON DELETE) não bloqueia a exclusão da
    // conta: fica órfão sem profile_id, igual já acontecia antes desta
    // função existir, só não vira lixo indefinido pra contas de teste sem
    // nenhum histórico vinculado, que é o caso comum.
    await supabase.from("rh_colaboradores").delete().eq("profile_id", user_id);

    const { error: profileErr } = await supabase.from("profiles").delete().eq("id", user_id);
    if (profileErr) {
      // FK sem ON DELETE (achado real: alguns created_by/changed_by de RH
      // bloqueavam a exclusão aqui, e o erro era descartado — a função
      // seguia pro auth.admin.deleteUser e reportava "success" mesmo com o
      // profile intacto, deixando o usuário "meio-excluído" pra sempre.
      const isFkViolation = profileErr.code === "23503" || /foreign key/i.test(profileErr.message || "");
      return new Response(JSON.stringify({
        error: isFkViolation
          ? "Este usuário tem registros vinculados que impedem a exclusão. Tente novamente após a correção de schema, ou avise o time técnico."
          : profileErr.message,
      }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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
