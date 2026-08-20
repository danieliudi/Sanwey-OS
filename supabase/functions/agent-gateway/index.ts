import { createClient } from 'jsr:@supabase/supabase-js@2';
import { timingSafeEqual } from 'https://deno.land/std@0.168.0/crypto/timing_safe_equal.ts';

// ============================================================
// agent-gateway — Edge Function
//
// Endpoint único para o time de agentes (n8n) interagir com o
// CRM. Autenticação dupla:
//   • n8n / automações → header X-Agent-Key com segredo
//   • Frontend           → header Authorization: Bearer <JWT>
//
// Rotas (via query param ?action=):
//   POST   ?action=create          Criar nova agent_action (só agente)
//   GET    ?action=list            Listar ações (com filtros)
//   PATCH  ?action=resolve         Resolver/atualizar status
//   GET    ?action=leads           Ler leads para o agente processar (só agente)
//   POST   ?action=log_activity    Registrar na tabela activities (só agente)
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-key',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
};

// Mesmo vermelho já usado na família de e-mails transacionais (ver
// send-request-status-email / send-deliverable-supplier-notify) — "vermelho
// e branco, sempre" (decisão do Daniel), não um tom novo.
const BRAND_RED = '#DC2626';

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function vagaManagerEmailHtml(managerName: string, vagaTitulo: string, diasParado: number, recommendedAction: string): string {
  const inner = `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#2C2C2B;line-height:1.25;letter-spacing:-0.01em;">Vaga parada sem avançar</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#8A8680;line-height:1.6;">Olá, <strong style="color:#2C2C2B;">${escapeHtml(managerName)}</strong>. A vaga abaixo está há um tempo sem mudar de etapa no processo seletivo.</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9F5F1;border:1px solid #E5E0DA;border-radius:10px;margin-bottom:28px;"><tr><td style="padding:16px 20px;"><table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td width="35%" style="padding:5px 0;font-size:13px;color:#8A8680;">Vaga</td><td width="65%" style="padding:5px 0;font-size:13px;color:#2C2C2B;font-weight:700;">${escapeHtml(vagaTitulo)}</td></tr>
      <tr><td style="padding:5px 0;font-size:13px;color:#8A8680;">Parada há</td><td style="padding:5px 0;font-size:13px;color:#2C2C2B;font-weight:600;">${diasParado} dia(s)</td></tr>
    </table></td></tr></table>
    <p style="margin:0;font-size:14px;color:#2C2C2B;line-height:1.6;">${escapeHtml(recommendedAction)}</p>`;
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
        <p style="margin:0;font-size:11px;color:#A09A94;line-height:1.5;">Este é um e-mail automático do sistema de RH.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

// Ao aprovar uma sugestão do piloto "Vaga parada" (Agent Builder), avisa o
// gestor externo da vaga por e-mail, se houver um link de triagem válido
// gerado pra ela (rh_vaga_manager_links — mesmo mecanismo do fluxo externo
// de triagem por e-mail/link). Sem link válido, só não há pra quem avisar
// externamente — o gerente de RH que aprovou já viu a sugestão aqui mesmo,
// então nunca é erro, só ausência de destinatário.
async function notifyVagaManagerIfApproved(admin: any, action: any) {
  if (action.action_type !== 'aviso_interno_vaga') return;
  const payload = action.payload || {};
  if (payload.source_table !== 'rh_vagas' || !payload.source_id) return;

  const { data: link } = await admin
    .from('rh_vaga_manager_links')
    .select('manager_name, manager_email, revoked_at, expires_at')
    .eq('vaga_id', payload.source_id)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!link?.manager_email) return;

  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) return;

  const html = vagaManagerEmailHtml(
    link.manager_name || 'Gestor(a)',
    payload.vaga_titulo || 'Vaga',
    payload.dias_parado ?? 0,
    payload.recommended_action || action.summary || '',
  );

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'noreply@sanwey.com.br',
      to: link.manager_email,
      subject: `Vaga parada: ${payload.vaga_titulo || ''} — Grupo Sanwey`,
      html,
    }),
  }).catch(() => {}); // fire-and-forget: falha de e-mail não desfaz a aprovação já gravada.
}

// Ao aprovar uma sugestão do piloto "Sourcing interno" (Agent Builder,
// Fase 3), avisa o(s) responsável(is) da vaga (rh_vagas.responsible_ids) —
// notificação in-app via a tabela `notifications` já usada por @menção
// (20260714_notifications_and_mentions.sql), não e-mail: diferente de
// Fornecedores/Vaga parada, aqui não há gestor externo nem link de triagem,
// só o time de RH já dentro da plataforma. Sem responsible_ids cadastrado,
// só não há pra quem avisar — nunca é erro.
async function notifyVagaResponsibleIfApproved(admin: any, action: any) {
  if (action.action_type !== 'sugestao_candidato_vaga') return;
  const payload = action.payload || {};
  if (!payload.vaga_id) return;

  const { data: vaga } = await admin
    .from('rh_vagas')
    .select('responsible_ids')
    .eq('id', payload.vaga_id)
    .maybeSingle();
  const recipientIds: string[] = vaga?.responsible_ids || [];
  if (recipientIds.length === 0) return;

  const rows = recipientIds.map((recipientId) => ({
    recipient_id: recipientId,
    type: 'agent_sourcing_suggestion',
    title: `Candidato sugerido: ${payload.candidato_nome || 'Banco de talentos'}`,
    body: `Sugestão de candidato aprovada pra vaga "${payload.vaga_titulo || ''}".`,
    link: { module: 'rh_candidatos', id: payload.candidato_id },
    created_by: null,
  }));

  // fire-and-forget: falha ao notificar não desfaz a aprovação já gravada.
  // O builder do supabase-js só é "thenable" (não implementa .catch próprio)
  // até virar uma Promise de verdade via await — por isso try/catch aqui,
  // não `.insert(...).catch(...)` (jogava "...catch is not a function").
  try {
    await admin.from('notifications').insert(rows);
  } catch (_e) { /* ignorado de propósito */ }
}

// Sinais de Mercado / Prospecção (Explorador) — a pesquisa real (Rotina
// agendada fora do Supabase, com acesso de verdade à web — o mecanismo de
// Agent Builder comum roda dentro desta edge function e não navega na
// internet) grava rascunho em agent_actions. Só ao aprovar aqui é que a
// linha nasce de fato em market_signals/prospect_seeds — mesmo padrão de
// "rascunho -> aprovação -> publicação" dos outros agentes.
async function publishMarketResearchIfApproved(admin: any, action: any) {
  const payload = action.payload || {};

  if (action.action_type === 'sugestao_sinal_mercado') {
    const companyId = action.company_id || payload.company_id;
    if (!companyId || !payload.title || !payload.excerpt || !payload.source) return;
    try {
      await admin.from('market_signals').insert({
        company_id: companyId,
        source: payload.source,
        title: payload.title,
        excerpt: payload.excerpt,
        url: payload.url || null,
        urgency: payload.urgency || 'medio',
        created_by: 'agente_pesquisa_mercado',
      });
    } catch (_e) { /* ignorado de propósito */ }
    return;
  }

  // Conteúdo de mercado (aba Mercado do hub de Inteligência, 19-20/08/2026)
  // — mesmo padrão rascunho→aprovação→publicação dos dois acima. O workflow
  // n8n "Scout de Mercado" (Perplexity) grava aqui via action=create; só ao
  // aprovar em Agentes é que a linha nasce em market_intelligence_items.
  if (action.action_type === 'sugestao_conteudo_mercado') {
    const payload2 = action.payload || {};
    if (!action.title || !action.summary) return;
    const validCategories = ['visao_geral', 'concorrencia', 'regulatorio', 'sustentabilidade', 'regional', 'preco_insumo'];
    const category = validCategories.includes(payload2.category) ? payload2.category : 'visao_geral';
    try {
      await admin.from('market_intelligence_items').insert({
        category,
        title: action.title,
        summary: action.summary,
        source_url: payload2.source_url || null,
        source_name: payload2.source_name || 'Perplexity',
        sector: payload2.sector || null,
        relevant_for: action.company_id ? [action.company_id] : null,
        created_by: 'agente_pesquisa_mercado',
      });
    } catch (_e) { /* ignorado de propósito */ }
    return;
  }

  if (action.action_type === 'sugestao_prospect') {
    if (!payload.company || !payload.sector || !payload.state) return;
    const relevantFor = Array.isArray(payload.relevant_for) && payload.relevant_for.length
      ? payload.relevant_for
      : (action.company_id ? [action.company_id] : []);
    // CNPJ só com dígitos: as sementes existentes gravam sem máscara, e o
    // agente devolve nos dois formatos. Misturar quebraria silenciosamente a
    // dedup por CNPJ na hora de converter semente em cliente (achado 13/08/2026).
    const cnpjDigits = String(payload.cnpj ?? '').replace(/\D/g, '');
    try {
      await admin.from('prospect_seeds').insert({
        cnpj: cnpjDigits || null,
        company: payload.company,
        razao_social: payload.razao_social || payload.company,
        sector: payload.sector,
        state: payload.state,
        city: payload.city || null,
        size: payload.size || 'Mid-Market',
        relevant_for: relevantFor,
        evidence: payload.evidence || null,
        source: 'agente_pesquisa_mercado',
        fit_score: payload.fit_score ?? 65,
      });
    } catch (_e) { /* ignorado de propósito */ }
  }
}

// GAP 1 (18/08/2026, análise de segurança de IA/agentes com o Daniel): antes,
// os 5 agentes (sdr_q/scout/cadencia/sentinela/cross) compartilhavam UM
// secret (AGENT_GATEWAY_KEY) e o agent_id vinha auto-declarado no corpo da
// requisição — qualquer chamador de posse da chave podia se passar por
// qualquer um dos 5, sem vínculo criptográfico nenhum entre credencial e
// identidade. Corrigido com 1 secret por agente (AGENT_GATEWAY_KEY_<AGENTE>)
// — agent_id passa a vir de QUAL credencial bateu, nunca do corpo.
// AGENT_GATEWAY_KEY (secret antigo) continua aceito em paralelo durante o
// rollout (agentes do n8n ainda não migrados pra chave própria), mas
// autentica como "legacy_unverified" — nunca como o agent_id que o corpo
// declarar, pra não reabrir o mesmo furo por baixo do rollout.
const AGENT_SECRETS: Record<string, string | undefined> = {
  sdr_q:     Deno.env.get('AGENT_GATEWAY_KEY_SDR_Q'),
  scout:     Deno.env.get('AGENT_GATEWAY_KEY_SCOUT'),
  cadencia:  Deno.env.get('AGENT_GATEWAY_KEY_CADENCIA'),
  sentinela: Deno.env.get('AGENT_GATEWAY_KEY_SENTINELA'),
  cross:     Deno.env.get('AGENT_GATEWAY_KEY_CROSS'),
};
const LEGACY_AGENT_KEY = Deno.env.get('AGENT_GATEWAY_KEY');

function timingSafeEqualStr(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  return timingSafeEqual(aBytes, bBytes);
}

// Devolve o agent_id derivado de QUAL secret bateu — nunca aceita agent_id
// vindo do chamador. null se nenhuma credencial configurada bater.
function resolveAgentIdFromKey(agentKey: string | null): string | null {
  if (!agentKey) return null;
  for (const [agentId, secret] of Object.entries(AGENT_SECRETS)) {
    if (secret && timingSafeEqualStr(agentKey, secret)) return agentId;
  }
  if (LEGACY_AGENT_KEY && timingSafeEqualStr(agentKey, LEGACY_AGENT_KEY)) {
    console.log(JSON.stringify({ event: 'agent_gateway_legacy_key_used', at: new Date().toISOString() }));
    return 'legacy_unverified';
  }
  return null;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'list';

  // ----------------------------------------------------------
  // Auth: aceita API key (n8n) OU JWT Supabase (frontend)
  // ----------------------------------------------------------
  const agentKey = req.headers.get('x-agent-key');
  const authorization = req.headers.get('authorization');

  const verifiedAgentId = resolveAgentIdFromKey(agentKey);
  const isAgentKey = Boolean(verifiedAgentId);

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  // Furo corrigido: antes isJwt só checava se o header COMEÇAVA com
  // "Bearer " — qualquer string nesse formato passava, sem validar o token
  // de verdade. Agora resolve o usuário via auth.getUser() antes de confiar
  // no JWT; se inválido, cai pro mesmo 401 de "sem credencial nenhuma".
  let isJwt = false;
  let userClient = adminClient;
  if (authorization?.startsWith('Bearer ')) {
    const candidate = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } }
    );
    const { data: userData, error: userErr } = await candidate.auth.getUser();
    if (!userErr && userData?.user) {
      isJwt = true;
      userClient = candidate;
    }
  }

  if (!isAgentKey && !isJwt) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // ----------------------------------------------------------
  // Roteamento
  // ----------------------------------------------------------
  try {
    switch (action) {

      // ── CREATE ────────────────────────────────────────────
      case 'create': {
        // Só o agente (n8n) cria — o frontend nunca chama essa rota, e o
        // insert sempre roda com adminClient (service_role, bypassa RLS),
        // então não pode ficar acessível a qualquer JWT autenticado.
        if (!isAgentKey) return json({ error: 'Somente agentes podem usar esta rota' }, 403);
        if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
        const body = await req.json();

        // Validação mínima
        const required = ['action_type', 'title'];
        for (const f of required) {
          if (!body[f]) return json({ error: `Campo obrigatório ausente: ${f}` }, 400);
        }

        const record = {
          // agent_id vem de QUAL credencial autenticou esta chamada (ver
          // resolveAgentIdFromKey acima) — nunca do corpo, que era o furo do
          // GAP 1: qualquer chamador com a chave compartilhada podia se
          // declarar como qualquer um dos 5 agentes.
          agent_id:     verifiedAgentId,
          action_type:  body.action_type,
          lead_id:      body.lead_id      ?? null,
          company_id:   body.company_id   ?? null,
          title:        body.title,
          summary:      body.summary      ?? null,
          payload:      body.payload      ?? {},
          priority:     body.priority     ?? 'normal',
          expires_at:   body.expires_at   ?? null,
          run_id:       body.run_id       ?? null,
          n8n_workflow: body.n8n_workflow  ?? null,
          status:       'pending',
        };

        const { data, error } = await adminClient
          .from('agent_actions')
          .insert(record)
          .select()
          .single();

        if (error) throw error;

        // Se vier junto com log de atividade, registra também
        if (body.log_activity && body.lead_id) {
          await adminClient.from('activities').insert({
            lead_id:    body.lead_id,
            type:       'agent_suggestion',
            title:      body.title,
            content:    body.summary ?? null,
            metadata:   { agent_id: verifiedAgentId, action_id: data.id },
          });
        }

        return json({ success: true, data }, 201);
      }

      // ── LIST ──────────────────────────────────────────────
      case 'list': {
        if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

        const client = isAgentKey ? adminClient : userClient;
        let q = client
          .from('agent_actions')
          .select('*, leads(company, stage, owner)')
          .order('created_at', { ascending: false });

        const status     = url.searchParams.get('status');
        const agentId    = url.searchParams.get('agent_id');
        const companyId  = url.searchParams.get('company_id');
        const leadId     = url.searchParams.get('lead_id');
        const limit      = parseInt(url.searchParams.get('limit') ?? '50');

        if (status)    q = q.eq('status', status);
        if (agentId)   q = q.eq('agent_id', agentId);
        if (companyId) q = q.eq('company_id', companyId);
        if (leadId)    q = q.eq('lead_id', leadId);
        q = q.limit(Math.min(limit, 200));

        // Excluir expiradas
        const includeExpired = url.searchParams.get('include_expired') === 'true';
        if (!includeExpired) {
          q = q.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
        }

        const { data, error } = await q;
        if (error) throw error;
        return json({ data, count: data?.length ?? 0 });
      }

      // ── RESOLVE ───────────────────────────────────────────
      case 'resolve': {
        if (req.method !== 'PATCH') return json({ error: 'Method not allowed' }, 405);
        const body = await req.json();

        if (!body.id) return json({ error: 'id é obrigatório' }, 400);

        const validStatuses = ['in_review', 'approved', 'rejected', 'executed', 'ignored'];
        if (body.status && !validStatuses.includes(body.status)) {
          return json({ error: `status inválido. Valores aceitos: ${validStatuses.join(', ')}` }, 400);
        }

        const patch: Record<string, unknown> = {};
        if (body.status)          patch.status          = body.status;
        if (body.resolution_note) patch.resolution_note = body.resolution_note;
        if (body.status && body.status !== 'in_review') {
          patch.resolved_at = new Date().toISOString();
        }

        // Frontend usa o cliente com JWT (RLS garante permissão)
        const client = isAgentKey ? adminClient : userClient;
        const { data, error } = await client
          .from('agent_actions')
          .update(patch)
          .eq('id', body.id)
          .select()
          .single();

        if (error) throw error;
        if (body.status === 'approved') {
          await notifyVagaManagerIfApproved(adminClient, data);
          await notifyVagaResponsibleIfApproved(adminClient, data);
          await publishMarketResearchIfApproved(adminClient, data);
        }
        return json({ success: true, data });
      }

      // ── LEADS (para agentes lerem o pipeline) ─────────────
      case 'leads': {
        if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
        if (!isAgentKey) return json({ error: 'Somente agentes podem usar esta rota' }, 403);

        // MD-05 da auditoria de segurança (19/08/2026): sem company_id, esta
        // rota devolvia o pipeline do Grupo inteiro (CNPJ, valor do negócio,
        // decisor, notas) pra qualquer uma das 5 chaves de agente. Nenhum
        // agente hoje precisa legitimamente ler mais de uma empresa por
        // chamada — fail-closed em vez de defaultar pra "todas".
        const companyId = url.searchParams.get('company_id');
        if (!companyId) return json({ error: 'company_id é obrigatório' }, 400);

        let q = adminClient
          .from('leads')
          .select('id, company_id, company, stage, owner, urgency, fit_score, value, last_activity, stage_changed_at, next_follow_up, cnpj, sector, decision_maker, notes')
          .eq('company_id', companyId)
          .order('last_activity', { ascending: true });

        const stage     = url.searchParams.get('stage');
        const ownerId   = url.searchParams.get('owner');
        const limit     = parseInt(url.searchParams.get('limit') ?? '100');

        if (stage)     q = q.eq('stage', stage);
        if (ownerId)   q = q.eq('owner', ownerId);
        q = q.limit(Math.min(limit, 500));

        const { data, error } = await q;
        if (error) throw error;
        return json({ data, count: data?.length ?? 0 });
      }

      // ── LOG ACTIVITY ──────────────────────────────────────
      case 'log_activity': {
        if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
        if (!isAgentKey) return json({ error: 'Somente agentes podem usar esta rota' }, 403);

        const body = await req.json();
        if (!body.lead_id || !body.type || !body.title) {
          return json({ error: 'lead_id, type e title são obrigatórios' }, 400);
        }

        const validTypes = [
          'agent_suggestion', 'agent_enrich', 'agent_qualify', 'stage_change',
          'call', 'email', 'whatsapp', 'note', 'nurture'
        ];
        if (!validTypes.includes(body.type)) {
          return json({ error: `type inválido. Valores aceitos: ${validTypes.join(', ')}` }, 400);
        }

        const { data, error } = await adminClient
          .from('activities')
          .insert({
            lead_id:  body.lead_id,
            type:     body.type,
            title:    body.title,
            content:  body.content  ?? null,
            score:    body.score    ?? null,
            metadata: body.metadata ?? {},
          })
          .select()
          .single();

        if (error) throw error;
        return json({ success: true, data }, 201);
      }

      default:
        return json({ error: `Ação desconhecida: ${action}. Use: create, list, resolve, leads, log_activity` }, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
