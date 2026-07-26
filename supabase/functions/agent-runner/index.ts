import { createClient } from "jsr:@supabase/supabase-js@2";
// _shared/ai-provider.ts é uma cópia idêntica da de ai-assistant/_shared —
// o deploy via MCP empacota cada function isoladamente (sem pasta irmã
// entre functions), então o módulo "compartilhado" (PRD seção 4) vive como
// fonte única de verdade neste repo mas precisa ser duplicado fisicamente
// nas duas pastas. Mudou um, muda o outro.
import { callAIProvider, resolveProviderConfig } from "./_shared/ai-provider.ts";

// ============================================================
// agent-runner — Edge Function
//
// PRD docs/prd-agent-builder.md, seção 4. Fase 1 (Fornecedores RH): só o
// caminho agendado (trigger.type = "date_approaching"). O caminho por
// evento (stage_change, Fase 2 — Recrutamento/Onboarding) fica pra quando
// essa fase entrar em escopo.
//
// Dois modos, mesma function:
//   - Sweep agendado: chamado 1x/dia pelo pg_cron (Authorization: Bearer
//     SUPABASE_SERVICE_ROLE_KEY) — varre TODAS as automações
//     module=rh-fornecedores, gera sugestões em agent_actions.
//   - Preview: chamado pelo assistente guiado (Authorization: Bearer <JWT
//     do usuário>, precisa ser gerente_rh/admin) — roda a automação (ainda
//     não salva ou já salva) contra o contrato mais próximo de vencer, sem
//     gravar nada em agent_actions. É o passo 5 do PRD ("testar antes de
//     ativar").
// ============================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const MODULE = "rh-fornecedores";
const DAILY_LIMIT = 50;

// ── Templates de prompt por tipo de rascunho (PRD seção 3, passo 3) ────────

const TONE_LABEL: Record<string, string> = {
  formal: "formal e institucional",
  direto: "direto e objetivo, sem rodeios",
  cordial: "cordial e amigável, mas profissional",
};

const SUGGESTED_ACTION_LABEL: Record<string, string> = {
  iniciar_renovacao: "Iniciar renovação",
  buscar_cotacao: "Buscar cotação alternativa",
  so_monitorar: "Só monitorar",
};

function buildPrompt(draftType: string, tone: string, customInstruction: string, ctx: {
  fornecedorNome: string; fornecedorTipo: string; titulo: string; diasParaVencer: number; vigenciaFim: string; valor: number | null;
}, followUpDays?: number, suggestedAction?: string) {
  const toneLabel = TONE_LABEL[tone] || TONE_LABEL.formal;
  const contexto = [
    `Fornecedor: ${ctx.fornecedorNome}`,
    ctx.fornecedorTipo ? `Tipo de fornecedor: ${ctx.fornecedorTipo}` : null,
    `Contrato: ${ctx.titulo}`,
    `Vence em: ${ctx.diasParaVencer} dia(s) (data: ${ctx.vigenciaFim})`,
    ctx.valor != null ? `Valor: R$ ${ctx.valor}` : null,
    customInstruction ? `Observação adicional a sempre mencionar: ${customInstruction}` : null,
  ].filter(Boolean).join("\n");

  if (draftType === "aviso_interno") {
    const actionLabel = SUGGESTED_ACTION_LABEL[suggestedAction || ""] || null;
    return {
      system: `Você escreve avisos internos curtos em português do Brasil pro time de RH de uma empresa, sobre contratos de fornecedores vencendo. Tom: ${toneLabel}. Responda SOMENTE com um JSON válido no formato {"title": "...", "recommended_action": "..."} — title é uma frase curta (até 80 caracteres), recommended_action é o texto do aviso (2-4 frases, sem saudação).${actionLabel ? ` Considere que a ação recomendada pelo gerente é "${actionLabel}" — mencione isso claramente em recommended_action, adaptando a redação ao contexto do contrato, sem inventar uma ação diferente.` : ""}`,
      user: contexto,
    };
  }
  // email_fornecedor (default)
  return {
    system: `Você escreve e-mails profissionais em português do Brasil para fornecedores, avisando sobre renovação de contrato prestes a vencer. Tom: ${toneLabel}. Responda SOMENTE com um JSON válido no formato {"subject": "...", "body": "..."} — body é o corpo do e-mail (sem saudação de fechamento tipo "Atenciosamente, [Nome]", isso é preenchido depois por quem aprovar). Feche o e-mail pedindo confirmação em até ${followUpDays ?? 5} dia(s) úteis.`,
    user: contexto,
  };
}

function parseDraftJson(raw: string): Record<string, string> {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { body: raw.trim() };
  try {
    return JSON.parse(match[0]);
  } catch {
    return { body: raw.trim() };
  }
}

function diasParaVencer(vigenciaFim: string): number {
  const hoje = new Date();
  const hojeUTC = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  const fim = new Date(`${vigenciaFim}T00:00:00Z`).getTime();
  return Math.floor((fim - hojeUTC) / 86400000);
}

// Condições avançadas opcionais (PRD seção 3, passo 2: "Adicionar filtro
// avançado") — mesmo operador básico do motor de automações comuns
// (use-automations.js matchOperator), só que contra o registro
// fornecedor+contrato em vez de um lead.
function matchOperator(actual: string, operator: string, expected: string): boolean {
  switch (operator) {
    case "eq": return actual === expected;
    case "neq": return actual !== expected;
    case "contains": return actual.toLowerCase().includes(expected.toLowerCase());
    case "gt": return parseFloat(actual) > parseFloat(expected);
    case "lt": return parseFloat(actual) < parseFloat(expected);
    case "gte": return parseFloat(actual) >= parseFloat(expected);
    case "lte": return parseFloat(actual) <= parseFloat(expected);
    case "is_empty": return actual.trim() === "";
    case "is_not_empty": return actual.trim() !== "";
    default: return true;
  }
}

function passesConditionGroups(groups: any[], record: Record<string, string>): boolean {
  if (!Array.isArray(groups) || groups.length === 0) return true;
  return groups.some((g) => (g.conditions || []).every((c: any) => matchOperator(String(record[c.field] ?? ""), c.operator, String(c.value ?? ""))));
}

async function findCandidateContracts(admin: any, conditionGroups: any[]) {
  const { data, error } = await admin
    .from("rh_fornecedor_contratos")
    .select("*, rh_fornecedores(id, name, tipo, contact_name, email, phone)")
    .eq("status", "ativo")
    .not("vigencia_fim", "is", null);
  if (error) throw error;
  return (data || []).filter((c: any) => {
    const record = { tipo: c.rh_fornecedores?.tipo || "", valor: String(c.valor ?? ""), status: c.status };
    return passesConditionGroups(conditionGroups, record);
  });
}

// ── Sweep agendado ──────────────────────────────────────────────────────────

async function runSweep(admin: any) {
  if (Deno.env.get("AGENT_RUNNER_ENABLED") === "false") {
    return json({ skipped: "kill_switch" });
  }

  const { data: automations, error } = await admin
    .from("automations")
    .select("*")
    .eq("module", MODULE)
    .eq("enabled", true)
    .is("paused_reason", null);
  if (error) throw error;

  let processed = 0, created = 0, pausedNow = 0, skippedLimit = 0;

  for (const automation of automations || []) {
    const trigger = automation.trigger || {};
    if (trigger.type !== "date_approaching") continue;
    processed++;

    const action = (automation.then_actions || [])[0];
    if (!action || action.type !== "suggest_with_ai") continue;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("agent_actions")
      .select("id", { count: "exact", head: true })
      .eq("automation_id", automation.id)
      .gte("created_at", since);
    if ((count || 0) >= DAILY_LIMIT) {
      skippedLimit++;
      continue;
    }

    const contratos = await findCandidateContracts(admin, automation.condition_groups || []);
    const days = Number(trigger.days) || 15;

    // Chave do criador do agente (BYOLLM) — resolvida uma vez por automação,
    // não por contrato.
    const { data: creatorProfile } = await admin.from("profiles").select("ai_config").eq("id", automation.created_by).maybeSingle();
    const providerConfig = resolveProviderConfig(creatorProfile?.ai_config);
    if (!providerConfig) {
      await admin.from("automations").update({
        paused_reason: "Configure sua chave de IA em Configurações → Integrações de IA pra este agente começar a rodar.",
      }).eq("id", automation.id);
      pausedNow++;
      continue;
    }

    let keyFailed = false;
    for (const contrato of contratos) {
      if (keyFailed) break;
      const dias = diasParaVencer(contrato.vigencia_fim);
      if (dias > days) continue;

      // Dedup: já existe sugestão pra este contrato nesta automação?
      const { data: existing } = await admin
        .from("agent_actions")
        .select("id")
        .eq("automation_id", automation.id)
        .contains("payload", { source_id: contrato.id })
        .limit(1);
      if (existing && existing.length > 0) continue;

      const fornecedor = contrato.rh_fornecedores || {};
      const { system, user } = buildPrompt(action.draftType, action.tone, action.customInstruction || "", {
        fornecedorNome: fornecedor.name || "Fornecedor",
        fornecedorTipo: fornecedor.tipo || "",
        titulo: contrato.titulo,
        diasParaVencer: dias,
        vigenciaFim: contrato.vigencia_fim,
        valor: contrato.valor,
      }, action.followUpDays, action.suggestedAction);

      try {
        const raw = await callAIProvider({
          provider: providerConfig.provider,
          model: providerConfig.model,
          apiKey: providerConfig.apiKey,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
          maxTokens: 600,
        });
        const draft = parseDraftJson(raw);

        const isEmail = action.draftType !== "aviso_interno";
        const title = isEmail
          ? `Contrato vencendo: ${fornecedor.name} (${dias}d)`
          : (draft.title || `Contrato vencendo: ${fornecedor.name}`);
        const summary = isEmail
          ? `Rascunho de e-mail pronto pro fornecedor "${fornecedor.name}" — contrato "${contrato.titulo}" vence em ${dias} dia(s).`
          : (draft.recommended_action || `Contrato "${contrato.titulo}" (${fornecedor.name}) vence em ${dias} dia(s).`);

        await admin.from("agent_actions").insert({
          agent_id: "automation",
          action_type: isEmail ? "email_fornecedor" : "aviso_interno",
          lead_id: null,
          company_id: null,
          title,
          summary,
          payload: {
            source_table: "rh_fornecedor_contratos",
            source_id: contrato.id,
            fornecedor_id: fornecedor.id,
            fornecedor_nome: fornecedor.name,
            fornecedor_contact_name: fornecedor.contact_name || null,
            fornecedor_email: fornecedor.email || null,
            fornecedor_phone: fornecedor.phone || null,
            dias_para_vencer: dias,
            ...(isEmail
              ? { subject: draft.subject || `Renovação de contrato — ${fornecedor.name}`, draft_email: draft.body || "" }
              : { recommended_action: draft.recommended_action || "" }),
          },
          priority: "normal",
          status: "pending",
          automation_id: automation.id,
        });
        created++;
      } catch (err) {
        keyFailed = true;
        await admin.from("automations").update({
          paused_reason: `Falha ao gerar sugestão: ${err instanceof Error ? err.message : String(err)}`,
        }).eq("id", automation.id);
        pausedNow++;
      }
    }
  }

  return json({ processed, created, paused: pausedNow, skipped_limit: skippedLimit });
}

// ── Preview (assistente guiado, passo 5) ────────────────────────────────────

async function runPreview(admin: any, body: any, userId: string) {
  const rule = body.rule || {};
  const trigger = rule.trigger || {};
  const action = (rule.thenActions || [])[0] || {};
  if (action.type !== "suggest_with_ai") return json({ error: "Ação da automação precisa ser 'suggest_with_ai'" }, 400);

  const contratos = await findCandidateContracts(admin, rule.conditionGroups || []);
  const days = Number(trigger.days) || 15;

  let contrato = contratos
    .map((c: any) => ({ c, dias: diasParaVencer(c.vigencia_fim) }))
    .sort((a: any, b: any) => a.dias - b.dias)[0];

  let usandoExemplo = false;
  let fornecedorNome: string, fornecedorTipo: string, titulo: string, dias: number, vigenciaFim: string, valor: number | null;
  let fornecedorContactName: string | null, fornecedorEmail: string | null, fornecedorPhone: string | null;
  if (contrato) {
    fornecedorNome = contrato.c.rh_fornecedores?.name || "Fornecedor";
    fornecedorTipo = contrato.c.rh_fornecedores?.tipo || "";
    titulo = contrato.c.titulo;
    dias = contrato.dias;
    vigenciaFim = contrato.c.vigencia_fim;
    valor = contrato.c.valor;
    fornecedorContactName = contrato.c.rh_fornecedores?.contact_name || null;
    fornecedorEmail = contrato.c.rh_fornecedores?.email || null;
    fornecedorPhone = contrato.c.rh_fornecedores?.phone || null;
  } else {
    usandoExemplo = true;
    fornecedorNome = "Fornecedor Exemplo Ltda.";
    fornecedorTipo = "Convênio médico";
    titulo = "Contrato de prestação de serviço";
    dias = days;
    vigenciaFim = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    valor = null;
    fornecedorContactName = null;
    fornecedorEmail = null;
    fornecedorPhone = null;
  }

  // Preview usa a chave de QUEM ESTÁ TESTANDO (a sessão autenticada), não a
  // do dono do agente — o agente pode nem ter sido salvo ainda.
  const { data: profile } = await admin.from("profiles").select("ai_config").eq("id", userId).maybeSingle();
  const providerConfig = resolveProviderConfig(profile?.ai_config);
  if (!providerConfig) {
    return json({ error: "Configure sua chave de IA em Configurações → Integrações de IA pra testar o agente." }, 400);
  }

  const { system, user } = buildPrompt(action.draftType, action.tone, action.customInstruction || "", {
    fornecedorNome, fornecedorTipo, titulo, diasParaVencer: dias, vigenciaFim, valor,
  }, action.followUpDays, action.suggestedAction);

  try {
    const raw = await callAIProvider({
      provider: providerConfig.provider,
      model: providerConfig.model,
      apiKey: providerConfig.apiKey,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      maxTokens: 600,
    });
    const draft = parseDraftJson(raw);
    const isEmail = action.draftType !== "aviso_interno";
    return json({
      usandoExemplo,
      fornecedorNome,
      fornecedorContactName,
      fornecedorEmail,
      fornecedorPhone,
      diasParaVencer: dias,
      isEmail,
      subject: isEmail ? (draft.subject || "") : undefined,
      draftEmail: isEmail ? (draft.body || "") : undefined,
      title: !isEmail ? (draft.title || "") : undefined,
      recommendedAction: !isEmail ? (draft.recommended_action || "") : undefined,
    });
  } catch (err) {
    return json({ error: `Falha ao gerar preview: ${err instanceof Error ? err.message : String(err)}` }, 502);
  }
}

// ── Entrypoint ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  try {
    // Chamado pelo pg_cron com a service_role key — varredura completa.
    if (jwt && jwt === serviceKey) {
      return await runSweep(admin);
    }

    // Chamado pelo assistente guiado com sessão de um gerente_rh/admin — só
    // preview, nunca grava em agent_actions.
    if (!jwt) return json({ error: "Autenticação necessária" }, 401);
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "Sessão inválida" }, 401);

    const { data: profile } = await admin.from("profiles").select("role, roles").eq("id", userData.user.id).single();
    const roles: string[] = Array.isArray(profile?.roles) && profile.roles.length ? profile.roles : (profile?.role ? [profile.role] : []);
    if (!roles.some((r) => ["gerente_rh", "admin"].includes(r))) {
      return json({ error: "Sem permissão pra usar o Agent Builder" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    if (body.action === "preview") {
      return await runPreview(admin, body, userData.user.id);
    }
    return json({ error: `Ação desconhecida: ${body.action}` }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
