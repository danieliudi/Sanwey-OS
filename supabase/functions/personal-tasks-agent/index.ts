import { createClient } from 'jsr:@supabase/supabase-js@2';

// MD-05 da auditoria de segurança (19/08/2026): comparação em tempo
// constante — mesmo padrão de sanwey-crm-mcp/index.ts, evita vazar, por
// diferença de tempo de resposta, quantos caracteres do token estão certos.
function timingSafeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

// Mesmo idioma já usado em google-drive-upload/index.ts e crm-ata-voz/
// index.ts pra decodificar base64 recebido no corpo do request.
function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// ============================================================
// personal-tasks-agent — Edge Function
//
// Endpoint pra secretária agêntica (secretaria-agentic, produto separado)
// ler/criar/atualizar/excluir tarefas no "Meu To-Do" pessoal do Daniel
// (`public.personal_tasks`), e agora também anexar arquivo e registrar nota.
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
// de outra pessoa. Mesma trava vale pro Storage: todo path de anexo sai
// com o prefixo ${ownerUserId}/, então mesmo com service_role (que ignora
// RLS/policy de Storage) a função nunca lê nem grava fora da própria pasta
// do Daniel.
//
// "frente" (conceito do secretaria-agentic) não existe aqui — a ponte é
// via `tags`: o provider do lado da secretária filtra/aplica tag
// case-insensitive DEPOIS de buscar (mesmo padrão que ClickUp/Trello já
// usam pra "frente" lá). Por isso `list` não recebe filtro de tag — devolve
// tudo (ou só as abertas) e quem filtra é o provider.
//
// Rotas (via query param ?action=):
//   GET    ?action=list                 Lista tarefas (abertas por padrão)
//   POST   ?action=create               Cria tarefa nova
//   PATCH  ?action=update               Atualiza campos/status de uma tarefa
//   DELETE ?action=delete&id=...        Exclui uma tarefa (definitivo — sem
//                                        lixeira, mesmo botão que a tela já
//                                        expõe)
//   POST   ?action=note                 Adiciona uma nota (append, nunca
//                                        substitui o log existente)
//   POST   ?action=attachment_upload    Sobe um anexo (base64) pra uma tarefa
//   GET    ?action=attachment_list      Lista anexos de uma tarefa
//   GET    ?action=attachment_download  Gera link assinado (5min) de um anexo
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-personal-tasks-key',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

// Únicos 2 status "terminais" hoje (ver src/constants/personal-tasks.js
// STATUS_COLUMNS) — concluido = tarefa de fato terminada; feito = etapa de
// "Arquivar" (guardar, não é a vitória). A secretária só escreve
// a_fazer/concluido — nunca move pra "feito" sozinha, isso é uma decisão de
// arquivamento que é do Daniel.
const TERMINAL_STATUSES = ['concluido', 'feito'];

const TASK_COLUMNS =
  'id,title,description,priority,status,due_date,due_time,tags,recurrence,recurrence_config,related_lead_id,notes,created_at,completed_at';

const ATTACHMENTS_BUCKET = 'personal-task-attachments';
const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024; // mesmo teto do bucket (ver migration)
// Mesma allow-list do bucket (20260828_personal_tasks_level1_level2.sql) —
// checado aqui ANTES do upload (achado da revisão de segurança 26/08/2026:
// sem isto, um mime_type fora da lista — ou a ausência dele, que caía no
// fallback 'application/octet-stream', que também NÃO está na allow-list —
// só falhava dentro do storage.upload, subindo o erro cru do Storage em vez
// de um 400 limpo).
const ATTACHMENT_ALLOWED_MIME_TYPES = [
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv', 'text/plain',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
];

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
  if (!providedKey || !timingSafeEqual(providedKey, expectedKey)) {
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

        const record: Record<string, unknown> = {
          user_id: ownerUserId,
          title: String(body.title),
          description: body.description ?? null,
          due_date: body.due_date ?? null,
          tags: body.tag ? [String(body.tag)] : [],
        };
        if (typeof body.due_time === 'string') record.due_time = body.due_time;
        if (typeof body.priority === 'string') record.priority = body.priority;
        if (typeof body.recurrence === 'string') record.recurrence = body.recurrence;
        if (body.recurrence_config && typeof body.recurrence_config === 'object') record.recurrence_config = body.recurrence_config;
        if (typeof body.related_lead_id === 'string') record.related_lead_id = body.related_lead_id;
        // Nota inicial opcional — mesmo formato exato do NotesTab
        // (PersonalTaskDetailDrawer.jsx): { id, body, createdAt }.
        if (typeof body.note === 'string' && body.note.trim()) {
          record.notes = [{ id: crypto.randomUUID(), body: body.note.trim(), createdAt: new Date().toISOString() }];
        }

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

        const staticPatch: Record<string, unknown> = {};
        if (typeof body.title === 'string') staticPatch.title = body.title;
        if (typeof body.description === 'string') staticPatch.description = body.description;
        if (typeof body.due_date === 'string' || body.due_date === null) staticPatch.due_date = body.due_date;
        if (typeof body.due_time === 'string' || body.due_time === null) staticPatch.due_time = body.due_time;
        if (typeof body.priority === 'string') staticPatch.priority = body.priority;
        if (typeof body.recurrence === 'string') staticPatch.recurrence = body.recurrence;
        if (body.recurrence_config && typeof body.recurrence_config === 'object') staticPatch.recurrence_config = body.recurrence_config;
        if (typeof body.related_lead_id === 'string' || body.related_lead_id === null) staticPatch.related_lead_id = body.related_lead_id;

        // Sem mudança de status: patch simples, sem corrida pra travar
        // (nenhum campo aqui é calculado a partir do estado atual).
        if (typeof body.status !== 'string') {
          if (Object.keys(staticPatch).length === 0) return json({ error: 'Nada pra atualizar' }, 400);
          const { data, error } = await admin
            .from('personal_tasks')
            .update(staticPatch)
            .eq('id', body.id)
            .eq('user_id', ownerUserId)
            .select(TASK_COLUMNS)
            .single();
          if (error) throw error;
          return json({ success: true, data });
        }

        // Muda status: completed_at é calculado a partir do status/
        // completed_at atuais (preserva se a tarefa já estava terminal —
        // "concluido" -> "feito" é só arquivar, não um 2º término, mesmo
        // princípio do fix de 26/08/2026 em use-personal-tasks.js). Trava
        // otimista (achado da revisão adversarial 26/08/2026, mesmo padrão
        // já usado em `action=note`): o update só aplica se status/
        // completed_at não mudaram entre o select e o update desta
        // tentativa — senão relê o estado mais recente e tenta de novo.
        for (let attempt = 0; attempt < 3; attempt++) {
          const { data: existing, error: findErr } = await admin
            .from('personal_tasks')
            .select('status,completed_at')
            .eq('id', body.id)
            .eq('user_id', ownerUserId)
            .maybeSingle();
          if (findErr) throw findErr;
          if (!existing) return json({ error: 'Tarefa não encontrada.' }, 404);

          const patch: Record<string, unknown> = { ...staticPatch, status: body.status };
          patch.completed_at = TERMINAL_STATUSES.includes(body.status)
            ? (TERMINAL_STATUSES.includes(existing.status) && existing.completed_at ? existing.completed_at : new Date().toISOString())
            : null;

          let q = admin
            .from('personal_tasks')
            .update(patch)
            .eq('id', body.id)
            .eq('user_id', ownerUserId)
            .eq('status', existing.status);
          q = existing.completed_at === null ? q.is('completed_at', null) : q.eq('completed_at', existing.completed_at);

          const { data, error } = await q.select(TASK_COLUMNS).maybeSingle();
          if (error) throw error;
          if (data) return json({ success: true, data });
          // 0 linhas: status/completed_at mudaram entre o select e o update
          // desta tentativa — tenta de novo lendo o estado mais recente.
        }
        return json({ error: 'Não deu pra atualizar — muita escrita concorrente na mesma tarefa. Tenta de novo.' }, 409);
      }

      // ── DELETE ────────────────────────────────────────────
      // Exclusão de verdade — mesma ação que o botão de lixeira já expõe na
      // tela (deleteTask, use-personal-tasks.js). Sem status "cancelado":
      // não existe like esconder um card sem criar etapa nova no Kanban.
      //
      // `confirm_title` obrigatório (achado da revisão adversarial
      // 26/08/2026): a tela exige um 2º clique de confirmação antes de
      // excluir (MoveStageMenu) — a API não tinha nenhum equivalente, e um
      // pedido em linguagem natural mal interpretado ("pode limpar essa
      // tarefa") apagaria de forma permanente e silenciosa. Precisa bater
      // (sem diferenciar maiúscula/espaço nas pontas) com o título ATUAL da
      // tarefa — se não bater, devolve 409 com o título real, pra secretária
      // confirmar com o usuário antes de tentar de novo.
      case 'delete': {
        if (req.method !== 'DELETE') return json({ error: 'Method not allowed' }, 405);
        const id = url.searchParams.get('id');
        const confirmTitle = url.searchParams.get('confirm_title');
        if (!id) return json({ error: 'Parâmetro obrigatório ausente: id' }, 400);
        if (!confirmTitle) return json({ error: 'Parâmetro obrigatório ausente: confirm_title (título atual da tarefa, pra confirmar a exclusão).' }, 400);

        const { data: task, error: findErr } = await admin
          .from('personal_tasks')
          .select('title')
          .eq('id', id)
          .eq('user_id', ownerUserId)
          .maybeSingle();
        if (findErr) throw findErr;
        if (!task) return json({ error: 'Tarefa não encontrada.' }, 404);
        if (confirmTitle.trim().toLowerCase() !== task.title.trim().toLowerCase()) {
          return json({ error: `confirm_title não bate com o título atual da tarefa: "${task.title}". Confirme com o usuário antes de tentar de novo.` }, 409);
        }

        const { error, count } = await admin
          .from('personal_tasks')
          .delete({ count: 'exact' })
          .eq('id', id)
          .eq('user_id', ownerUserId);
        if (error) throw error;
        if (!count) return json({ error: 'Tarefa não encontrada.' }, 404);
        return json({ success: true });
      }

      // ── NOTE (append) ─────────────────────────────────────
      // Sempre soma ao log existente — nunca substitui o array. Formato
      // idêntico ao que o NotesTab (PersonalTaskDetailDrawer.jsx) já grava:
      // { id, body, createdAt }. Ação separada (não um campo em `update`)
      // de propósito: a secretária nunca tem o array completo e atual em
      // mãos, então um "replace" via update arriscaria apagar nota
      // registrada direto na tela entre uma chamada e outra.
      //
      // Read-modify-write com trava otimista (achado da revisão de QA
      // funcional 26/08/2026): o `.eq('notes', snapshot)` no update só
      // aplica se ninguém escreveu `notes` entre o select e o update desta
      // chamada — se aplicar 0 linhas, outra escrita venceu a corrida
      // (outra chamada de `note`, ou a própria tela) e tenta de novo lendo
      // o estado mais recente, até 3 tentativas.
      case 'note': {
        if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
        const body = await req.json();
        if (!body.id) return json({ error: 'Campo obrigatório ausente: id' }, 400);
        if (!body.note || !String(body.note).trim()) return json({ error: 'Campo obrigatório ausente: note' }, 400);

        const entry = { id: crypto.randomUUID(), body: String(body.note).trim(), createdAt: new Date().toISOString() };

        for (let attempt = 0; attempt < 3; attempt++) {
          const { data: task, error: findErr } = await admin
            .from('personal_tasks')
            .select('notes')
            .eq('id', body.id)
            .eq('user_id', ownerUserId)
            .maybeSingle();
          if (findErr) throw findErr;
          if (!task) return json({ error: 'Tarefa não encontrada.' }, 404);

          const currentNotes = task.notes || [];
          const notes = [...currentNotes, entry];

          const { data, error } = await admin
            .from('personal_tasks')
            .update({ notes })
            .eq('id', body.id)
            .eq('user_id', ownerUserId)
            .eq('notes', JSON.stringify(currentNotes))
            .select(TASK_COLUMNS)
            .maybeSingle();
          if (error) throw error;
          if (data) return json({ success: true, data });
          // 0 linhas atualizadas: `notes` mudou entre o select e o update
          // desta tentativa — tenta de novo lendo o estado mais recente.
        }
        return json({ error: 'Não deu pra registrar a nota — muita escrita concorrente na mesma tarefa. Tenta de novo.' }, 409);
      }

      // ── ATTACHMENT UPLOAD ─────────────────────────────────
      // Mesma tabela/bucket que a tela já usa (personal_task_attachments +
      // bucket personal-task-attachments, ambos de 20260828) — nenhum
      // schema novo. Path convention idêntica à já documentada na
      // migration: ${userId}/${taskId}/${timestamp}-${rand}.ext.
      case 'attachment_upload': {
        if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
        const body = await req.json();
        if (!body.task_id) return json({ error: 'Campo obrigatório ausente: task_id' }, 400);
        if (!body.file_name) return json({ error: 'Campo obrigatório ausente: file_name' }, 400);
        if (!body.base64) return json({ error: 'Campo obrigatório ausente: base64' }, 400);
        if (!body.mime_type || !ATTACHMENT_ALLOWED_MIME_TYPES.includes(body.mime_type)) {
          return json({ error: `Campo mime_type ausente ou não permitido. Use um de: ${ATTACHMENT_ALLOWED_MIME_TYPES.join(', ')}` }, 400);
        }

        const { data: task, error: taskErr } = await admin
          .from('personal_tasks')
          .select('id')
          .eq('id', body.task_id)
          .eq('user_id', ownerUserId)
          .maybeSingle();
        if (taskErr) throw taskErr;
        if (!task) return json({ error: 'Tarefa não encontrada.' }, 404);

        const base64Str = String(body.base64);
        // Checagem estimada (achado da revisão de QA funcional 26/08/2026)
        // ANTES de decodificar — rejeita cedo um payload grosseiramente
        // acima do limite sem gastar CPU/memória com atob()/Uint8Array;
        // o teto exato continua checado no length real depois de decodificar.
        if (Math.floor((base64Str.length * 3) / 4) > ATTACHMENT_MAX_BYTES * 1.05) {
          return json({ error: 'Arquivo maior que o limite de 10MB.' }, 400);
        }

        let bytes: Uint8Array;
        try {
          bytes = base64ToBytes(base64Str);
        } catch {
          return json({ error: 'base64 inválido.' }, 400);
        }
        if (bytes.length > ATTACHMENT_MAX_BYTES) {
          return json({ error: 'Arquivo maior que o limite de 10MB.' }, 400);
        }

        const fileName = String(body.file_name);
        const ext = fileName.includes('.') ? fileName.split('.').pop() : 'bin';
        const mimeType = body.mime_type;
        const path = `${ownerUserId}/${body.task_id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

        const { error: upErr } = await admin.storage.from(ATTACHMENTS_BUCKET).upload(path, bytes, {
          contentType: mimeType,
          upsert: false,
        });
        if (upErr) throw upErr;

        const { data: attachment, error: insErr } = await admin
          .from('personal_task_attachments')
          .insert({
            task_id: body.task_id,
            user_id: ownerUserId,
            file_name: fileName,
            file_path: path,
            file_size: bytes.length,
            mime_type: mimeType,
          })
          .select('id,file_name,file_size,mime_type,created_at')
          .single();
        if (insErr) throw insErr;
        return json({ success: true, data: attachment }, 201);
      }

      // ── ATTACHMENT LIST ───────────────────────────────────
      case 'attachment_list': {
        if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
        const taskId = url.searchParams.get('task_id');
        if (!taskId) return json({ error: 'Parâmetro obrigatório ausente: task_id' }, 400);

        const { data, error } = await admin
          .from('personal_task_attachments')
          .select('id,file_name,file_size,mime_type,created_at')
          .eq('task_id', taskId)
          .eq('user_id', ownerUserId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return json({ data, count: data?.length ?? 0 });
      }

      // ── ATTACHMENT DOWNLOAD ───────────────────────────────
      // Link assinado de 5min — bucket é privado (ver migration), então
      // não dá pra devolver uma URL pública direto.
      case 'attachment_download': {
        if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
        const attachmentId = url.searchParams.get('attachment_id');
        if (!attachmentId) return json({ error: 'Parâmetro obrigatório ausente: attachment_id' }, 400);

        const { data: attachment, error: findErr } = await admin
          .from('personal_task_attachments')
          .select('file_path,file_name')
          .eq('id', attachmentId)
          .eq('user_id', ownerUserId)
          .maybeSingle();
        if (findErr) throw findErr;
        if (!attachment) return json({ error: 'Anexo não encontrado.' }, 404);

        const { data: signed, error: signErr } = await admin.storage
          .from(ATTACHMENTS_BUCKET)
          .createSignedUrl(attachment.file_path, 300);
        if (signErr) throw signErr;
        return json({ url: signed.signedUrl, file_name: attachment.file_name, expires_in: 300 });
      }

      default:
        return json(
          { error: `Ação desconhecida: ${action}. Use: list, create, update, delete, note, attachment_upload, attachment_list, attachment_download` },
          400,
        );
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
