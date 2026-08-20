import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ============================================================
// ⚠️ ÓRFÃ — candidata a remoção (achado AL-03 da auditoria de segurança de
// 19/08/2026). Commitada aqui só para dar histórico ao que já estava ativo
// em produção sem nunca ter passado por code review — NÃO é recomendação de
// manter como está.
//
// Problemas encontrados, nenhum corrigido nesta passada (aguardando decisão
// do Daniel: apagar a function de produção, já que nada em src/ a chama, ou
// corrigir e continuar usando):
//   - Só checa a PRESENÇA do header Authorization, nunca a validade
//     (`auth.getUser()` nunca é chamado) nem o cargo de quem chama.
//   - Substituída na prática por `ai-assistant` (essa sim com getUser() e
//     já corrigida numa auditoria anterior) — nenhuma referência a
//     "analyze-lead" existe em src/.
//   - Repassa o corpo de erro do upstream (Claude API) direto pro cliente.
// ============================================================

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPANY_CONTEXT: Record<string, string> = {
  industria: "Sanwey Indústria: fabricante de big bags (embalagens flexíveis industriais) para cimento, grãos, minérios, fertilizantes. Vende produto acabado para grandes consumidores.",
  resibag: "Resibag: fabricante de big bags reciclados (economia circular). Target: empresas com metas ESG, logística reversa, agricultura e construção.",
  montemor: "Sanwey Monte Mor: fornece TECIDOS, LINHAS E FIOS de polipropileno/PE — matéria-prima para FABRICANTES DE BIG BAGS (não vende o bag pronto). Target: outras indústrias de embalagens flexíveis.",
};

const SYSTEM_PROMPT = `Você é um analista sênior de vendas B2B do Grupo Sanwey.
Sua função é analisar leads de um CRM multiempresa e recomendar ações objetivas para os vendedores.

Contexto das empresas do grupo:
- industria: ${COMPANY_CONTEXT.industria}
- resibag: ${COMPANY_CONTEXT.resibag}
- montemor: ${COMPANY_CONTEXT.montemor}

Estágios do pipeline, em ordem:
prospeccao → qualificacao → proposta → negociacao → fechado_ganho OU fechado_perdido.

Você SEMPRE devolve JSON válido (sem prefixo, sem markdown, sem texto antes/depois) seguindo exatamente o schema pedido. Seja direto e prático — vendedores leem sua análise entre ligações.`;

function buildUserPrompt(lead: any): string {
  const now = Date.now();
  const daysSinceStage = lead.stage_changed_at
    ? Math.floor((now - new Date(lead.stage_changed_at).getTime()) / 86400000)
    : null;
  const daysSinceActivity = lead.last_activity
    ? Math.floor((now - new Date(lead.last_activity).getTime()) / 86400000)
    : null;
  const notesText = Array.isArray(lead.notes)
    ? lead.notes.map((n: any) => (typeof n === "string" ? n : n.text || "")).filter(Boolean).join(" | ")
    : "";

  return `Analise este lead e responda em JSON seguindo o schema abaixo.

LEAD:
- Empresa: ${lead.company} (razão social: ${lead.razao_social || "—"})
- Empresa do grupo: ${lead.company_id} — ${COMPANY_CONTEXT[lead.company_id] || "—"}
- Setor: ${lead.sector || "—"} | CNAE: ${lead.cnae || "—"}
- Localização: ${lead.city || "—"}/${lead.state || "—"}
- Porte: ${lead.size || "—"} | Capital social: R$ ${Number(lead.capital_social || 0).toLocaleString("pt-BR")}
- Situação CNPJ: ${lead.situacao || "—"}
- SKU proposto: ${lead.sku_name || "—"} (${lead.sku || "—"})
- Valor estimado: R$ ${Number(lead.value || 0).toLocaleString("pt-BR")}
- Probabilidade atual: ${Math.round((lead.probability || 0) * 100)}%
- Fit score: ${lead.fit_score || 0}/100
- Estágio atual: ${lead.stage || "—"}
- Urgência: ${lead.urgency || "—"}
- Dias no estágio atual: ${daysSinceStage ?? "—"}
- Dias sem atividade: ${daysSinceActivity ?? "—"}
- Tomador de decisão: ${lead.decision_maker?.name || "—"} (${lead.decision_maker?.role || "—"})
- Gatilho: ${lead.trigger_label || "—"}
- Evidência/contexto: ${lead.evidence || "—"}
- Notas do vendedor: ${notesText || "—"}

Schema JSON obrigatório:
{
  "health": <inteiro 0-100, saúde geral do lead>,
  "diagnosis": <um de: "quente" | "estagnado" | "em_risco" | "frio">,
  "diagnosis_reason": <string, 1 frase curta explicando o diagnóstico>,
  "next_action": <string, 1 frase imperativa — ação concreta que o vendedor deve tomar AGORA>,
  "suggested_stage": <string, um de: "prospeccao" | "qualificacao" | "proposta" | "negociacao" | "fechado_ganho" | "fechado_perdido">,
  "stage_change_reason": <string, 1 frase — só preencha se suggested_stage for diferente do atual; senão "">,
  "email_draft": <string, rascunho completo de email em português, 4-6 linhas, personalizado com o contexto específico deste lead. Assine como "[Seu nome]" para o vendedor substituir.>
}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    if (!ANTHROPIC_API_KEY) {
      return json({
        error: "ANTHROPIC_API_KEY não configurada. Vá em Supabase → Edge Functions → Secrets e adicione a chave.",
      }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const body = await req.json().catch(() => ({}));
    const leadId = body?.lead_id;
    if (!leadId) return json({ error: "lead_id required" }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: lead, error: fetchError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .maybeSingle();

    if (fetchError) return json({ error: `DB: ${fetchError.message}` }, 500);
    if (!lead) return json({ error: "Lead não encontrado ou sem permissão" }, 404);

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserPrompt(lead) }],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return json({ error: `Claude API ${resp.status}: ${text.slice(0, 400)}` }, 502);
    }

    const data = await resp.json();
    const rawText: string = data?.content?.[0]?.text || "";
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

    let analysis;
    try {
      analysis = JSON.parse(cleaned);
    } catch {
      return json({ error: "Claude retornou JSON inválido", raw: rawText.slice(0, 400) }, 502);
    }

    return json({
      analysis,
      usage: data.usage,
      model: data.model,
      lead_stage: lead.stage,
    });
  } catch (err) {
    return json({ error: (err as Error)?.message || String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
