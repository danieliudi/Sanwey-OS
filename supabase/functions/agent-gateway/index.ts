import { createClient } from 'jsr:@supabase/supabase-js@2';

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
  const expectedKey = Deno.env.get('AGENT_GATEWAY_KEY');

  const isAgentKey = Boolean(agentKey && expectedKey && agentKey === expectedKey);

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
        const required = ['agent_id', 'action_type', 'title'];
        for (const f of required) {
          if (!body[f]) return json({ error: `Campo obrigatório ausente: ${f}` }, 400);
        }

        const validAgents = ['sdr_q', 'scout', 'cadencia', 'sentinela', 'cross'];
        if (!validAgents.includes(body.agent_id)) {
          return json({ error: `agent_id inválido. Valores aceitos: ${validAgents.join(', ')}` }, 400);
        }

        const record = {
          agent_id:     body.agent_id,
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
            metadata:   { agent_id: body.agent_id, action_id: data.id },
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
        return json({ success: true, data });
      }

      // ── LEADS (para agentes lerem o pipeline) ─────────────
      case 'leads': {
        if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
        if (!isAgentKey) return json({ error: 'Somente agentes podem usar esta rota' }, 403);

        let q = adminClient
          .from('leads')
          .select('id, company_id, company, stage, owner, urgency, fit_score, value, last_activity, stage_changed_at, next_follow_up, cnpj, sector, decision_maker, notes')
          .order('last_activity', { ascending: true });

        const companyId = url.searchParams.get('company_id');
        const stage     = url.searchParams.get('stage');
        const ownerId   = url.searchParams.get('owner');
        const limit     = parseInt(url.searchParams.get('limit') ?? '100');

        if (companyId) q = q.eq('company_id', companyId);
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
