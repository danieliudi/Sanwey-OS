import { createClient } from 'jsr:@supabase/supabase-js@2';

// ============================================================
// personal-tasks-agent — Edge Function
//
// Endpoint pra secretária agêntica (secretaria-agentic, produto separado)
// ler/criar/concluir tarefas no "Meu To-Do" pessoal do Daniel
// (`public.personal_tasks`).
//
// NÃO é uma extensão do agent-gateway de propósito: `personal_tasks` tem
// RLS sem NENHUMA exceção (`user_id = auth.uid()`, nem gerente/admin veem
// tarefa de outra pessoa — ver 20260826_personal_tasks.sql). O
// agent-gateway autentica com uma chave compartilhada por TODAS as
// automações n8n da empresa — reusar essa chave aqui abriria a lista
// pessoal pra qualquer automação que já tenha aquela chave, quebrando
// exatamente a garantia de privacidade que a RLS foi desenhada pra dar.
// Por isso: função própria, chave própria, escopo travado a UM usuário só.
//
// Auth: só um caminho — header X-Personal-Tasks-Key comparado contra
// PERSONAL_TASKS_AGENT_KEY. Sem caminho de JWT — nada dentro do próprio
// sanwey-crm precisa chamar isto (a tela "Meu To-Do" já fala direto com o
// Supabase via RLS normal). Fail-closed (503) se o secret não estiver
// configurado — mesmo padrão já usado em d4sign-webhook/index.ts.
//
// Escopo: toda query já sai com .eq('user_id', ownerUserId), onde
// ownerUserId vem de PERSONAL_TASKS_OWNER_USER_ID (secret de config, não
// schema — é só o profiles.id do Daniel). Não existe parâmetro de request
// que troque esse user_id — nem que quisesse, a função não alcança tarefa
// de outra pessoa.
//
// "frente" (conceito do secretaria-agentic) não existe aqui — a ponte é
// via `tags`: o provider do lado da secretária filtra/aplica tag
// case-insensitive DEPOIS de buscar (mesmo padrão que ClickUp/Trello já
// usam pra "frente" lá). Por isso `list` não recebe filtro de tag — devolve
// tudo (ou só as abertas) e quem filtra é o provider.
//
// Rotas (via query param ?action=):
//   GET    ?action=list     Lista tarefas (abertas por padrão)
//   POST   ?action=create   Cria tarefa nova
//   PATCH  ?action=update   Atualiza status/campos de uma tarefa
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-personal-tasks-key',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
};

// Únicos 2 status "terminais" hoje (ver src/constants/personal-tasks.js
// STATUS_COLUMNS) — concluido = tarefa de fato terminada; feito = etapa de
// "Arquivar" (guardar, não é a vitória). A secretária só escreve
// a_fazer/concluido — nunca move pra "feito" sozinha, isso é uma decisão de
// arquivamento que é do Daniel.
const TERMINAL_STATUSES = ['concluido', 'feito'];

const TASK_COLUMNS = 'id,title,description,priority,status,due_date,due_time,tags,created_at,completed_at';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  const expectedKey = Deno.env.get('PERSONAL_TASKS_AGENT_KEY');
  const ownerUserId = Deno.env.get('PERSONAL_TASKS_OWNER_USER_ID');
  if (!expectedKey || !ownerUserId) {
    return json({ error: 'Function não configurada (PERSONAL_TASKS_AGENT_KEY/PERSONAL_TASKS_OWNER_USER_ID ausente).' }, 503);
  }

  const providedKey = req.headers.get('x-personal-tasks-key');
  if (!providedKey || providedKey !== expectedKey) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'list';

  try {
    switch (action) {
      // ── LIST ──────────────────────────────────────────────
      case 'list': {
        if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
        const includeDone = url.searchParams.get('include_done') === 'true';
        const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 200);

        let q = admin
          .from('personal_tasks')
          .select(TASK_COLUMNS)
          .eq('user_id', ownerUserId)
          .order('due_date', { ascending: true, nullsFirst: false })
          .limit(limit);
        if (!includeDone) q = q.not('status', 'in', `(${TERMINAL_STATUSES.join(',')})`);

        const { data, error } = await q;
        if (error) throw error;
        return json({ data, count: data?.length ?? 0 });
      }

      // ── CREATE ────────────────────────────────────────────
      case 'create': {
        if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
        const body = await req.json();
        if (!body.title) return json({ error: 'Campo obrigatório ausente: title' }, 400);

        const record = {
          user_id: ownerUserId,
          title: String(body.title),
          description: body.description ?? null,
          due_date: body.due_date ?? null,
          tags: body.tag ? [String(body.tag)] : [],
        };
        const { data, error } = await admin
          .from('personal_tasks')
          .insert(record)
          .select(TASK_COLUMNS)
          .single();
        if (error) throw error;
        return json({ success: true, data }, 201);
      }

      // ── UPDATE ────────────────────────────────────────────
      case 'update': {
        if (req.method !== 'PATCH') return json({ error: 'Method not allowed' }, 405);
        const body = await req.json();
        if (!body.id) return json({ error: 'Campo obrigatório ausente: id' }, 400);

        const patch: Record<string, unknown> = {};
        if (typeof body.status === 'string') {
          patch.status = body.status;
          patch.completed_at = TERMINAL_STATUSES.includes(body.status) ? new Date().toISOString() : null;
        }
        if (typeof body.title === 'string') patch.title = body.title;
        if (typeof body.description === 'string') patch.description = body.description;
        if (typeof body.due_date === 'string' || body.due_date === null) patch.due_date = body.due_date;
        if (Object.keys(patch).length === 0) return json({ error: 'Nada pra atualizar' }, 400);

        const { data, error } = await admin
          .from('personal_tasks')
          .update(patch)
          .eq('id', body.id)
          .eq('user_id', ownerUserId)
          .select(TASK_COLUMNS)
          .single();
        if (error) throw error;
        return json({ success: true, data });
      }

      default:
        return json({ error: `Ação desconhecida: ${action}. Use: list, create, update` }, 400);
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
