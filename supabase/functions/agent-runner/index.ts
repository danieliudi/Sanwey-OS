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

// GAP 2 (18/08/2026): wrapper fino em volta de callAIProvider só pra
// centralizar a trilha de auditoria (mesmo padrão do logToolCall de
// sanwey-crm-mcp) nos 6 pontos de chamada de IA desta function — nunca loga
// conteúdo de prompt/resposta, só metadados.
async function callAIProviderLogged(
  opts: { provider: string; model: string; apiKey: string; messages: { role: string; content: string }[]; maxTokens?: number },
  ctx: { userId: string | null; role: string | null; module: string }
): Promise<string> {
  const t0 = Date.now();
  try {
    const { content, usage } = await callAIProvider(opts);
    console.log(JSON.stringify({
      event: "agent_runner_ai_call", user_id: ctx.userId, role: ctx.role, crm_module: ctx.module,
      provider: opts.provider, execution_status: "ok", latency_ms: Date.now() - t0,
      prompt_tokens: usage.promptTokens, completion_tokens: usage.completionTokens,
      at: new Date().toISOString(),
    }));
    return content;
  } catch (err) {
    console.log(JSON.stringify({
      event: "agent_runner_ai_call", user_id: ctx.userId, role: ctx.role, crm_module: ctx.module,
      provider: opts.provider, execution_status: "error", latency_ms: Date.now() - t0,
      at: new Date().toISOString(),
    }));
    throw err;
  }
}

// Fase 2 (Vaga parada — Recrutamento) e Fase 3 (Sourcing interno — banco de
// talentos): mesma function, 3 módulos. Cada automação já carrega seu
// próprio `module`; o sweep varre todos de uma vez e o loop abaixo decide
// qual "encontrar candidatos" usar por automação.
const MODULES = ["rh-fornecedores", "rh-vagas", "rh-sourcing"];
const DAILY_LIMIT = 50;
const VAGA_ACTIVE_STAGES = ["publicada", "em_triagem"];
// Teto bruto de candidatos considerados por vaga antes do filtro estrutural
// (evita puxar o banco de talentos inteiro a cada rodada) e teto de quantos
// entram de fato no prompt de IA depois do filtro (custo de token).
const SOURCING_POOL_FETCH_LIMIT = 200;
const SOURCING_POOL_PROMPT_LIMIT = 30;
const SOURCING_MAX_MATCHES = 5;

const VAGA_SUGGESTED_ACTION_LABEL: Record<string, string> = {
  reabrir_divulgacao:  "Reabrir divulgação",
  escalar_gestor:      "Escalar pro gestor",
  revisar_requisitos:  "Revisar requisitos",
  so_monitorar:        "Só monitorar",
};

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

// stage_changed_at é timestamptz (não date-only como vigencia_fim acima) —
// diferença direta em ms, sem o ajuste de fuso do helper acima.
function diasParado(stageChangedAt: string): number {
  return Math.floor((Date.now() - new Date(stageChangedAt).getTime()) / 86400000);
}

function buildVagaPrompt(tone: string, customInstruction: string, ctx: {
  title: string; department: string; diasParado: number; stage: string; hiringDeadline: string | null;
}, suggestedAction?: string) {
  const toneLabel = TONE_LABEL[tone] || TONE_LABEL.formal;
  const actionLabel = VAGA_SUGGESTED_ACTION_LABEL[suggestedAction || ""] || null;
  const contexto = [
    `Vaga: ${ctx.title}`,
    ctx.department ? `Departamento: ${ctx.department}` : null,
    `Etapa atual: ${ctx.stage}`,
    `Parada há: ${ctx.diasParado} dia(s) sem avançar de etapa`,
    ctx.hiringDeadline ? `Prazo de contratação: ${ctx.hiringDeadline}` : null,
    customInstruction ? `Observação adicional a sempre mencionar: ${customInstruction}` : null,
  ].filter(Boolean).join("\n");
  return {
    system: `Você escreve avisos internos curtos em português do Brasil pro RH sobre vagas de recrutamento paradas há muito tempo sem avançar de etapa. Tom: ${toneLabel}. Responda SOMENTE com um JSON válido no formato {"title": "...", "recommended_action": "..."} — title é uma frase curta (até 80 caracteres), recommended_action é o texto do aviso (2-4 frases, sem saudação).${actionLabel ? ` Considere que a ação recomendada pelo gerente é "${actionLabel}" — mencione isso claramente em recommended_action, adaptando a redação ao contexto da vaga, sem inventar uma ação diferente.` : ""}`,
    user: contexto,
  };
}

// Sourcing interno (banco de talentos × vaga nova) — diferente dos outros
// dois domínios: 1 chamada de IA por VAGA (não por candidato), com a lista
// já pré-filtrada estruturalmente embutida no prompt. Evita o padrão "1
// registro = 1 chamada de IA" dos outros domínios, que aqui explodiria
// custo (N candidatos × M vagas) e o teto de 50 ações/dia.
function buildSourcingPrompt(tone: string, customInstruction: string, vaga: {
  title: string; department: string; requirements: string | null; description: string | null;
}, candidatos: Array<{ id: string; name: string; source: string | null; frenteOrigem: string[]; resumo: string }>) {
  const toneLabel = TONE_LABEL[tone] || TONE_LABEL.formal;
  const vagaContexto = [
    `Vaga: ${vaga.title}`,
    vaga.department ? `Departamento: ${vaga.department}` : null,
    vaga.requirements ? `Requisitos: ${vaga.requirements}` : null,
    vaga.description ? `Descrição: ${vaga.description}` : null,
    customInstruction ? `Observação adicional a considerar: ${customInstruction}` : null,
  ].filter(Boolean).join("\n");

  const candidatosLista = candidatos.map((c, i) => [
    `${i + 1}. id=${c.id} | nome=${c.name}`,
    c.source ? `origem=${c.source}` : null,
    c.frenteOrigem.length ? `frente=${c.frenteOrigem.join(", ")}` : null,
    `Currículo: ${c.resumo || "(sem texto extraído)"}`,
  ].filter(Boolean).join(" | ")).join("\n\n");

  return {
    system: `Você analisa aderência entre candidatos de um banco de talentos e uma vaga de emprego aberta, em português do Brasil. Tom da justificativa: ${toneLabel}. Responda SOMENTE com um JSON válido no formato {"matches":[{"candidato_id":"...","justificativa":"..."}]} — inclua só candidatos genuinamente aderentes (experiência/competências compatíveis com a vaga), no máximo ${SOURCING_MAX_MATCHES}, ordenados do mais aderente pro menos aderente. Se nenhum candidato for aderente, responda {"matches":[]}. justificativa é uma frase curta (até 140 caracteres) explicando o motivo da aderência. Use só os "id" exatamente como aparecem na lista — nunca invente um id.`,
    user: `${vagaContexto}\n\nCandidatos no banco de talentos:\n${candidatosLista}`,
  };
}

async function findSourcingCandidatePool(admin: any, vaga: any, conditionGroups: any[]) {
  const { data, error } = await admin
    .from("rh_candidatos")
    .select("id, name, source, frente_origem, cv_texto_extraido, stage, vaga_id, created_at")
    .order("created_at", { ascending: false })
    .limit(SOURCING_POOL_FETCH_LIMIT);
  if (error) throw error;

  const companyIds: string[] = vaga.company_ids || [];
  return (data || []).filter((c: any) => {
    // Já é candidato desta vaga específica — não é "redescoberta" de banco
    // de talentos, é aplicação direta, já aparece no board normal.
    if (c.vaga_id === vaga.id) return false;
    if (companyIds.length > 0) {
      const frente: string[] = c.frente_origem || [];
      if (!frente.some((f: string) => companyIds.includes(f))) return false;
    }
    const record = { source: c.source || "", stage: c.stage || "" };
    return passesConditionGroups(conditionGroups, record);
  });
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

async function findCandidateVagas(admin: any, conditionGroups: any[]) {
  const { data, error } = await admin
    .from("rh_vagas")
    .select("*")
    .in("stage", VAGA_ACTIVE_STAGES)
    .not("stage_changed_at", "is", null);
  if (error) throw error;
  return (data || []).filter((v: any) => {
    const record = { department: v.department || "", stage: v.stage };
    return passesConditionGroups(conditionGroups, record);
  });
}

// ── Sweep agendado ──────────────────────────────────────────────────────────

// `title` de uma sugestão vem do agente (n8n/Perplexity), não de um humano
// da casa — ou seja, é conteúdo externo indo parar dentro de HTML de e-mail.
// Escapar aqui não é zelo: é o mesmo cuidado que agent-gateway já toma nos
// e-mails dele.
function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Degrau 4 da escada de urgência: e-mail pra quem aprova ──────────────────
//
// Medido em 03/09/2026, sobre as 45 sugestões já resolvidas: a espera média
// até alguém aprovar era de 155 HORAS (6,5 dias), pior caso 319h. A causa não
// era disciplina — NADA notificava. Os degraus 1-3 (contador, sino, âmbar)
// vivem no app e só funcionam pra quem abre a plataforma; este é o que
// resolve "eu nem entrei essa semana".
const DIAS_ESCALAR_EMAIL = 5;

async function escalarFilaParada(admin: any) {
  const corte = new Date(Date.now() - DIAS_ESCALAR_EMAIL * 86400000).toISOString();

  const { data: paradas } = await admin
    .from("agent_actions")
    .select("id, title, action_type, company_id, created_at")
    .eq("status", "pending")
    .lt("created_at", corte)
    .order("created_at", { ascending: true });

  if (!paradas || paradas.length === 0) return { escalados: 0, emails: 0 };

  // SÓ a fila de APROVAÇÃO por enquanto (status 'pending'). O mockup previa a
  // mesma escada pra segunda fila — prospect aprovado que nenhum vendedor
  // puxou — e ela fica deliberadamente DE FORA até a aba do Explorador
  // existir. Motivo concreto, medido em 03/09/2026: há 15 prospects aprovados
  // com mais de 5 dias, então ligar isso hoje faria o cron das 9h de amanhã
  // mandar e-mail pra 10 vendedores sobre uma fila que eles ainda não têm
  // onde abrir. Avisar sobre tela que não existe é pior que não avisar.

  const resendKey = Deno.env.get("RESEND_API_KEY");
  // Sem chave, o degrau simplesmente não existe — nunca derrubar a varredura
  // inteira por causa do e-mail, que é o passo menos crítico dela.
  if (!resendKey) return { escalados: paradas.length, emails: 0, motivo: "sem RESEND_API_KEY" };

  // Quem aprova: admin vê tudo, gerente/gerente_rh só as próprias frentes —
  // mesmo escopo da policy agent_actions_manager_all. Cada um recebe só o que
  // pode de fato resolver; e-mail listando o que a pessoa não enxerga na tela
  // é pior que não mandar.
  const { data: aprovadores } = await admin
    .from("profiles")
    .select("id, name, email, roles, companies")
    .overlaps("roles", ["admin", "gerente", "gerente_rh"]);

  let emails = 0;
  for (const p of aprovadores || []) {
    if (!p.email) continue;
    const ehAdmin = (p.roles || []).includes("admin");
    const minhas = p.companies || [];
    const delas = paradas.filter((a: any) =>
      ehAdmin || a.company_id === null || minhas.includes(a.company_id));
    if (delas.length === 0) continue;

    const idade = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    const linhas = delas.slice(0, 15).map((a: any) =>
      `<li style="margin-bottom:6px"><b>${escapeHtml(a.title || "(sem título)")}</b>`
      + ` <span style="color:#6B7280">— parada há ${idade(a.created_at)} dias</span></li>`).join("");
    const resto = delas.length > 15 ? `<p style="color:#6B7280">…e mais ${delas.length - 15}.</p>` : "";

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: "noreply@sanwey.com.br",
          to: p.email,
          subject: `${delas.length} ${delas.length === 1 ? "sugestão parada" : "sugestões paradas"} há mais de ${DIAS_ESCALAR_EMAIL} dias`,
          html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1F2937;max-width:560px">
            <p>Olá${p.name ? ", " + escapeHtml(p.name) : ""} — estas sugestões da IA estão esperando uma decisão:</p>
            <ul style="padding-left:18px">${linhas}</ul>${resto}
            <p style="color:#6B7280;font-size:13px">Sinal de mercado perde validade parado. Aprovar ou recusar, os dois resolvem — o que trava é ficar sem decisão.</p>
            <p><a href="https://gestao.sanwey.com.br/agentes" style="background:#CC2936;color:#fff;padding:9px 16px;border-radius:6px;text-decoration:none;display:inline-block">Abrir Agentes</a></p>
          </div>`,
        }),
      });
      if (res.ok) emails++;
    } catch (_e) { /* um e-mail que falha não pode parar os outros nem a varredura */ }
  }

  return { escalados: paradas.length, emails };
}

async function runSweep(admin: any) {
  if (Deno.env.get("AGENT_RUNNER_ENABLED") === "false") {
    return json({ skipped: "kill_switch" });
  }

  const { data: automations, error } = await admin
    .from("automations")
    .select("*")
    .in("module", MODULES)
    .eq("enabled", true)
    .is("paused_reason", null);
  if (error) throw error;

  let processed = 0, created = 0, pausedNow = 0, skippedLimit = 0;

  for (const automation of automations || []) {
    const trigger = automation.trigger || {};
    const isVagas = automation.module === "rh-vagas";
    const isSourcing = automation.module === "rh-sourcing";
    if (isSourcing) {
      if (trigger.type !== "candidatos_compativeis") continue;
    } else if (isVagas ? trigger.type !== "stage_stale" : trigger.type !== "date_approaching") {
      continue;
    }
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

    const days = Number(trigger.days) || (isVagas ? 7 : 15);

    // Chave do criador do agente (BYOLLM) — resolvida uma vez por automação,
    // não por contrato/vaga.
    const { data: creatorProfile } = await admin.from("profile_secrets").select("ai_config").eq("id", automation.created_by).maybeSingle();
    const providerConfig = resolveProviderConfig(creatorProfile?.ai_config);
    if (!providerConfig) {
      await admin.from("automations").update({
        paused_reason: "Configure sua chave de IA em Configurações → Integrações de IA pra este agente começar a rodar.",
      }).eq("id", automation.id);
      pausedNow++;
      continue;
    }

    if (isVagas) {
      const vagas = await findCandidateVagas(admin, automation.condition_groups || []);
      let keyFailed = false;
      for (const vaga of vagas) {
        if (keyFailed) break;
        const dias = diasParado(vaga.stage_changed_at);
        if (dias < days) continue;

        const { data: existing } = await admin
          .from("agent_actions")
          .select("id")
          .eq("automation_id", automation.id)
          .contains("payload", { source_id: vaga.id })
          .limit(1);
        if (existing && existing.length > 0) continue;

        const { system, user } = buildVagaPrompt(action.tone, action.customInstruction || "", {
          title: vaga.title,
          department: vaga.department || "",
          diasParado: dias,
          stage: vaga.stage,
          hiringDeadline: vaga.hiring_deadline || null,
        }, action.suggestedAction);

        try {
          const raw = await callAIProviderLogged({
            provider: providerConfig.provider,
            model: providerConfig.model,
            apiKey: providerConfig.apiKey,
            messages: [{ role: "system", content: system }, { role: "user", content: user }],
            maxTokens: 600,
          }, { userId: null, role: "cron", module: automation.module });
          const draft = parseDraftJson(raw);
          const title = draft.title || `Vaga parada: ${vaga.title} (${dias}d)`;
          const summary = draft.recommended_action || `Vaga "${vaga.title}" parada há ${dias} dia(s) sem avançar de etapa.`;

          await admin.from("agent_actions").insert({
            agent_id: "automation",
            action_type: "aviso_interno_vaga",
            lead_id: null,
            company_id: null,
            title,
            summary,
            payload: {
              source_table: "rh_vagas",
              source_id: vaga.id,
              vaga_titulo: vaga.title,
              vaga_departamento: vaga.department || null,
              dias_parado: dias,
              recommended_action: draft.recommended_action || "",
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
      continue;
    }

    if (isSourcing) {
      const vagas = await findCandidateVagas(admin, []);
      let keyFailed = false;
      for (const vaga of vagas) {
        if (keyFailed) break;

        // Candidatos já sugeridos pra esta vaga por esta automação, em
        // qualquer rodada anterior — exclui do pool antes de gastar
        // chamada de IA, pra não reprocessar quem o RH já viu/decidiu.
        const { data: alreadySuggested } = await admin
          .from("agent_actions")
          .select("payload")
          .eq("automation_id", automation.id)
          .contains("payload", { vaga_id: vaga.id });
        const suggestedIds = new Set((alreadySuggested || []).map((r: any) => r.payload?.candidato_id).filter(Boolean));

        const pool = (await findSourcingCandidatePool(admin, vaga, automation.condition_groups || []))
          .filter((c: any) => !suggestedIds.has(c.id))
          .slice(0, SOURCING_POOL_PROMPT_LIMIT);
        if (pool.length === 0) continue;

        const { system, user } = buildSourcingPrompt(action.tone, action.customInstruction || "", {
          title: vaga.title,
          department: vaga.department || "",
          requirements: vaga.requirements || null,
          description: vaga.description || null,
        }, pool.map((c: any) => ({
          id: c.id,
          name: c.name,
          source: c.source,
          frenteOrigem: c.frente_origem || [],
          resumo: (c.cv_texto_extraido || "").slice(0, 600),
        })));

        try {
          const raw = await callAIProviderLogged({
            provider: providerConfig.provider,
            model: providerConfig.model,
            apiKey: providerConfig.apiKey,
            messages: [{ role: "system", content: system }, { role: "user", content: user }],
            maxTokens: 800,
          }, { userId: null, role: "cron", module: automation.module });
          const parsed = parseDraftJson(raw) as any;
          const matches: Array<{ candidato_id: string; justificativa: string }> = Array.isArray(parsed.matches) ? parsed.matches : [];
          const poolById = new Map(pool.map((c: any) => [c.id, c]));

          for (const match of matches.slice(0, SOURCING_MAX_MATCHES)) {
            const candidato = poolById.get(match.candidato_id);
            if (!candidato) continue; // id alucinado — ignora, não insere

            await admin.from("agent_actions").insert({
              agent_id: "automation",
              action_type: "sugestao_candidato_vaga",
              lead_id: null,
              company_id: null,
              title: `Candidato do banco de talentos: ${candidato.name}`,
              summary: `"${candidato.name}" pode ser aderente à vaga "${vaga.title}". ${match.justificativa || ""}`.trim(),
              payload: {
                source_table: "rh_candidatos",
                source_id: candidato.id,
                candidato_id: candidato.id,
                candidato_nome: candidato.name,
                vaga_id: vaga.id,
                vaga_titulo: vaga.title,
                justificativa: match.justificativa || "",
              },
              priority: "normal",
              status: "pending",
              automation_id: automation.id,
            });
            created++;
          }
        } catch (err) {
          keyFailed = true;
          await admin.from("automations").update({
            paused_reason: `Falha ao gerar sugestão: ${err instanceof Error ? err.message : String(err)}`,
          }).eq("id", automation.id);
          pausedNow++;
        }
      }
      continue;
    }

    const contratos = await findCandidateContracts(admin, automation.condition_groups || []);

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
        const raw = await callAIProviderLogged({
          provider: providerConfig.provider,
          model: providerConfig.model,
          apiKey: providerConfig.apiKey,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
          maxTokens: 600,
        }, { userId: null, role: "cron", module: automation.module });
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

  // Escalonamento por idade roda SEMPRE, mesmo quando a varredura não criou
  // sugestão nenhuma: o que ele cobra é justamente a fila antiga parada.
  // `catch` porque e-mail nunca pode derrubar a varredura — ela faz coisa
  // mais importante que avisar.
  let escalonamento: unknown = null;
  try { escalonamento = await escalarFilaParada(admin); }
  catch (err) { escalonamento = { erro: err instanceof Error ? err.message : String(err) }; }

  return json({ processed, created, paused: pausedNow, skipped_limit: skippedLimit, escalonamento });
}

// ── Preview (assistente guiado, passo 5) ────────────────────────────────────

async function runPreview(admin: any, body: any, userId: string, roles: string[]) {
  const rule = body.rule || {};
  const trigger = rule.trigger || {};
  const action = (rule.thenActions || [])[0] || {};
  if (action.type !== "suggest_with_ai") return json({ error: "Ação da automação precisa ser 'suggest_with_ai'" }, 400);
  const previewCtx = { userId, role: roles[0] || null, module: rule.module || "rh-fornecedores" };

  // Preview usa a chave de QUEM ESTÁ TESTANDO (a sessão autenticada), não a
  // do dono do agente — o agente pode nem ter sido salvo ainda. Comum aos
  // dois módulos, resolvida uma vez só.
  const { data: profile } = await admin.from("profile_secrets").select("ai_config").eq("id", userId).maybeSingle();
  const providerConfig = resolveProviderConfig(profile?.ai_config);
  if (!providerConfig) {
    return json({ error: "Configure sua chave de IA em Configurações → Integrações de IA pra testar o agente." }, 400);
  }

  if (rule.module === "rh-vagas") {
    const days = Number(trigger.days) || 7;
    const vagas = await findCandidateVagas(admin, rule.conditionGroups || []);
    const pick = vagas
      .map((v: any) => ({ v, dias: diasParado(v.stage_changed_at) }))
      .sort((a: any, b: any) => b.dias - a.dias)[0];

    let usandoExemplo = false;
    let vagaTitulo: string, departamento: string, dias: number, stage: string;
    if (pick) {
      vagaTitulo = pick.v.title;
      departamento = pick.v.department || "";
      dias = pick.dias;
      stage = pick.v.stage;
    } else {
      usandoExemplo = true;
      vagaTitulo = "Analista Fiscal Pleno";
      departamento = "Financeiro";
      dias = days;
      stage = "publicada";
    }

    const { system, user } = buildVagaPrompt(action.tone, action.customInstruction || "", {
      title: vagaTitulo, department: departamento, diasParado: dias, stage, hiringDeadline: pick?.v.hiring_deadline || null,
    }, action.suggestedAction);

    try {
      const raw = await callAIProviderLogged({
        provider: providerConfig.provider,
        model: providerConfig.model,
        apiKey: providerConfig.apiKey,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        maxTokens: 600,
      }, previewCtx);
      const draft = parseDraftJson(raw);
      return json({
        usandoExemplo,
        vagaTitulo,
        diasParado: dias,
        isEmail: false,
        title: draft.title || "",
        recommendedAction: draft.recommended_action || "",
      });
    } catch (err) {
      return json({ error: `Falha ao gerar preview: ${err instanceof Error ? err.message : String(err)}` }, 502);
    }
  }

  if (rule.module === "rh-sourcing") {
    const vagas = await findCandidateVagas(admin, []);

    let picked: { vaga: any; candidatePool: any[] } | null = null;
    for (const vaga of vagas) {
      const candidatePool = await findSourcingCandidatePool(admin, vaga, rule.conditionGroups || []);
      if (candidatePool.length > 0) { picked = { vaga, candidatePool }; break; }
    }

    let usandoExemplo = false;
    let vagaTitulo: string, departamento: string, requirements: string | null, description: string | null;
    let promptPool: Array<{ id: string; name: string; source: string | null; frenteOrigem: string[]; resumo: string }>;

    if (picked) {
      vagaTitulo = picked.vaga.title;
      departamento = picked.vaga.department || "";
      requirements = picked.vaga.requirements || null;
      description = picked.vaga.description || null;
      promptPool = picked.candidatePool.slice(0, SOURCING_POOL_PROMPT_LIMIT).map((c: any) => ({
        id: c.id,
        name: c.name,
        source: c.source,
        frenteOrigem: c.frente_origem || [],
        resumo: (c.cv_texto_extraido || "").slice(0, 600),
      }));
    } else {
      usandoExemplo = true;
      vagaTitulo = "Analista Fiscal Pleno";
      departamento = "Financeiro";
      requirements = "Experiência com rotinas fiscais e apuração de impostos.";
      description = null;
      promptPool = [{
        id: "exemplo",
        name: "Candidato Exemplo",
        source: "banco_talentos",
        frenteOrigem: [],
        resumo: "Experiência em rotinas fiscais, apuração de impostos e conciliação contábil.",
      }];
    }

    const { system, user } = buildSourcingPrompt(action.tone, action.customInstruction || "", {
      title: vagaTitulo, department: departamento, requirements, description,
    }, promptPool);

    try {
      const raw = await callAIProviderLogged({
        provider: providerConfig.provider,
        model: providerConfig.model,
        apiKey: providerConfig.apiKey,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        maxTokens: 800,
      }, previewCtx);
      const parsed = parseDraftJson(raw) as any;
      const matches: Array<{ candidato_id: string; justificativa: string }> = Array.isArray(parsed.matches) ? parsed.matches : [];
      const poolById = new Map(promptPool.map((c) => [c.id, c]));
      return json({
        usandoExemplo,
        vagaTitulo,
        isEmail: false,
        matches: matches.slice(0, SOURCING_MAX_MATCHES).map((m) => ({
          candidatoNome: poolById.get(m.candidato_id)?.name || "",
          justificativa: m.justificativa || "",
        })),
      });
    } catch (err) {
      return json({ error: `Falha ao gerar preview: ${err instanceof Error ? err.message : String(err)}` }, 502);
    }
  }

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

  const { system, user } = buildPrompt(action.draftType, action.tone, action.customInstruction || "", {
    fornecedorNome, fornecedorTipo, titulo, diasParaVencer: dias, vigenciaFim, valor,
  }, action.followUpDays, action.suggestedAction);

  try {
    const raw = await callAIProviderLogged({
      provider: providerConfig.provider,
      model: providerConfig.model,
      apiKey: providerConfig.apiKey,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      maxTokens: 600,
    }, previewCtx);
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
      return await runPreview(admin, body, userData.user.id, roles);
    }
    return json({ error: `Ação desconhecida: ${body.action}` }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
