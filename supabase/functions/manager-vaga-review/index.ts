import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Endpoint público (sem JWT — o gestor externo não tem conta na plataforma).
// Autenticação própria: token de alta entropia (gerado no client via
// crypto.randomUUID x2, nunca em URL previsível) + confirmação do e-mail
// cadastrado no link, como segunda camada — se o link vazar sem o e-mail
// junto, não abre. Toda leitura/escrita passa pela service role aqui
// dentro; a tabela rh_vaga_manager_links não é lida por role anônima em
// nenhum outro lugar.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const { action, token, email } = body;

    if (!token || !email) {
      return jsonResponse({ error: "Link inválido." }, 400);
    }

    const { data: link, error: linkErr } = await supabase
      .from("rh_vaga_manager_links")
      .select("id, vaga_id, manager_name, manager_email, expires_at, revoked_at")
      .eq("token", token)
      .maybeSingle();

    // Mensagem genérica em todo caso de falha — não revela se foi o token,
    // o e-mail, expiração ou revogação (evita virar oráculo pra quem só
    // tem uma das duas metades do segredo).
    const invalid = () => jsonResponse({ error: "Link inválido, expirado ou e-mail não confere." }, 401);

    if (linkErr || !link) return invalid();
    if (link.revoked_at) return invalid();
    if (new Date(link.expires_at).getTime() < Date.now()) return invalid();
    if (String(link.manager_email).trim().toLowerCase() !== String(email).trim().toLowerCase()) return invalid();

    await supabase.from("rh_vaga_manager_links").update({ last_accessed_at: new Date().toISOString() }).eq("id", link.id);

    if (action === "list") {
      const { data: vaga } = await supabase
        .from("rh_vagas")
        .select("title, description, job_title, department")
        .eq("id", link.vaga_id)
        .maybeSingle();

      const { data: aplicacoes } = await supabase
        .from("rh_aplicacoes")
        .select("id, candidate_id, etapa_pipeline, fit_score, justificativa, pontos_fortes, gaps, manager_decision, manager_decision_notes")
        .eq("vaga_id", link.vaga_id);

      const candidateIds = (aplicacoes || []).map((a) => a.candidate_id);
      const { data: candidatos } = candidateIds.length
        ? await supabase.from("rh_candidatos").select("id, name, resume_ext").in("id", candidateIds)
        : { data: [] };
      const candidatosById = new Map((candidatos || []).map((c) => [c.id, c]));

      const candidatosPayload = await Promise.all((aplicacoes || []).map(async (a) => {
        const cand = candidatosById.get(a.candidate_id);
        let resumeUrl: string | null = null;
        if (cand?.resume_ext) {
          const path = `${cand.id}/curriculo.${cand.resume_ext}`;
          const { data: signed } = await supabase.storage.from("rh-curriculos").createSignedUrl(path, 900);
          resumeUrl = signed?.signedUrl || null;
        }
        return {
          aplicacaoId: a.id,
          nome: cand?.name || "—",
          etapa: a.etapa_pipeline,
          fitScore: a.fit_score,
          justificativa: a.justificativa,
          pontosFortes: a.pontos_fortes || [],
          gaps: a.gaps || [],
          resumeUrl,
          managerDecision: a.manager_decision || null,
          managerDecisionNotes: a.manager_decision_notes || null,
        };
      }));

      return jsonResponse({
        vaga: { title: vaga?.title, description: vaga?.description, jobTitle: vaga?.job_title, department: vaga?.department },
        managerName: link.manager_name,
        candidatos: candidatosPayload,
      });
    }

    if (action === "decide") {
      const { aplicacaoId, decision, notes } = body;
      if (!aplicacaoId || !["aprovado", "reprovado"].includes(decision)) {
        return jsonResponse({ error: "Decisão inválida." }, 400);
      }

      // Confirma que a aplicação é da MESMA vaga do link — impede decidir
      // sobre candidato de outra vaga mesmo que o id seja adivinhado.
      const { data: aplicacao } = await supabase
        .from("rh_aplicacoes")
        .select("id, vaga_id")
        .eq("id", aplicacaoId)
        .maybeSingle();
      if (!aplicacao || aplicacao.vaga_id !== link.vaga_id) {
        return jsonResponse({ error: "Candidato não pertence a esta vaga." }, 403);
      }

      const { error: updateErr } = await supabase.from("rh_aplicacoes").update({
        manager_decision: decision,
        manager_decision_at: new Date().toISOString(),
        manager_decision_notes: notes || null,
        manager_link_id: link.id,
      }).eq("id", aplicacaoId);
      if (updateErr) throw updateErr;

      // Avisa quem gerou o link que uma decisão voltou — reaproveita a
      // tabela notifications genérica, sem exigir RPC nova.
      const { data: linkFull } = await supabase.from("rh_vaga_manager_links").select("created_by").eq("id", link.id).maybeSingle();
      if (linkFull?.created_by) {
        await supabase.from("notifications").insert({
          recipient_id: linkFull.created_by,
          type: "vaga_manager_decision",
          title: `${link.manager_name} decidiu sobre um candidato`,
          body: decision === "aprovado" ? "Aprovado pelo gestor" : "Reprovado pelo gestor",
          link: { module: "rh_candidatos", id: aplicacaoId },
        });
      }

      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Ação desconhecida." }, 400);
  } catch (err: any) {
    return jsonResponse({ error: err.message || "Erro inesperado." }, 500);
  }
});
