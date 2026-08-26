# Personal Tasks Agent — Contrato de API

**Endpoint base:**
```
https://adizvduyfzfftyswkijj.supabase.co/functions/v1/personal-tasks-agent
```

Função separada do `agent-gateway` de propósito — ver comentário no topo de
`supabase/functions/personal-tasks-agent/index.ts`. `personal_tasks` (o "Meu
To-Do" pessoal) tem RLS sem exceção nenhuma (nem gerente/admin vê tarefa de
outra pessoa); essa função é o único jeito de um agente externo (a secretária
agêntica do Daniel, produto separado — `secretaria-agentic`) tocar nela, e só
nas tarefas do Daniel — nunca um mecanismo multi-usuário.

---

## 1. Setup obrigatório (uma vez)

1. Acesse: https://supabase.com/dashboard/project/adizvduyfzfftyswkijj/settings/edge-functions
2. Clique em **"Edit secrets"**
3. Adicione:
   - `PERSONAL_TASKS_AGENT_KEY` = (gere uma string longa e aleatória, ex: `openssl rand -hex 32`)
   - `PERSONAL_TASKS_OWNER_USER_ID` = o `profiles.id` (= `auth.users.id`) do Daniel
4. Salve.

A secretária agêntica guarda o valor de `PERSONAL_TASKS_AGENT_KEY` como
`SANWEY_TASKS_API_TOKEN` (mesmo padrão de token único que ela já usa pra
Notion/Google Tasks).

## 2. Autenticação

```
X-Personal-Tasks-Key: <valor do PERSONAL_TASKS_AGENT_KEY>
```

Sem caminho de JWT — nada dentro do próprio sanwey-crm chama esta função (a
tela "Meu To-Do" já fala direto com o Supabase via RLS normal). Sem a chave
certa: `401`. Sem os secrets configurados: `503` (fail-closed).

## 3. Rotas

### GET `?action=list`

Query params opcionais: `include_done` (`"true"` pra incluir
concluído/arquivado, padrão só as abertas), `limit` (padrão 100, teto 200).

Não recebe filtro de frente/tag — devolve tudo (ou só as abertas) pro
usuário fixo; quem filtra por tag é a secretária, do lado dela (mesmo padrão
que ela já usa pra "frente" com ClickUp/Trello).

```json
{ "data": [ { "id": "...", "title": "...", "status": "a_fazer", "tags": ["Resibag"], "due_date": "2026-08-20", ... } ], "count": 3 }
```

### POST `?action=create`

Body: `{ "title": "...", "description"?, "due_date"?: "YYYY-MM-DD", "due_time"?: "HH:MM", "priority"?: "baixa"|"media"|"alta", "recurrence"?: "none"|"daily"|"weekly"|"monthly"|"custom", "recurrence_config"?: {...}, "related_lead_id"?: "...", "note"?: "...", "tag"?: "Resibag" }`

`title` obrigatório, todo o resto é opcional. `tag`, se vier, vira o único
item de `tags`. `note`, se vier, vira a 1ª entrada do log de notas (mesmo
formato de `?action=note` abaixo). `recurrence_config` segue o shape que o
`RecurrencePicker` da tela já usa (ex.: `{ "intervalDays": 3 }` pra
`recurrence: "custom"`, `{ "daysOfWeek": [1,3,5] }` pra `"weekly"`,
`{ "dayOfMonth": 10 }` pra `"monthly"`).

```json
{ "success": true, "data": { "id": "...", "status": "a_fazer", ... } }
```

### PATCH `?action=update`

Body: `{ "id": "...", "status"?: "a_fazer"|"fazendo"|"concluido", "title"?, "description"?, "due_date"?, "due_time"?, "priority"?, "recurrence"?, "recurrence_config"?, "related_lead_id"? }`

Usado principalmente pra concluir (`status: "concluido"` — nunca `"feito"`,
que é a etapa de Arquivar, não de Conclusão). Seta `completed_at`
automaticamente quando o status vira terminal, e preserva o valor já
existente se a tarefa já estava terminal antes (ex.: movida de
`"concluido"` pra `"feito"` depois — arquivar não reinicia o carimbo de
conclusão).

```json
{ "success": true, "data": { "id": "...", "status": "concluido", "completed_at": "...", ... } }
```

### DELETE `?action=delete&id=...`

Exclusão definitiva — mesma ação do botão de lixeira que a tela já tem.
Não existe "lixeira"/status de cancelado: a tarefa some.

```json
{ "success": true }
```

### POST `?action=note`

Body: `{ "id": "...", "note": "..." }`

Sempre **soma** ao log de notas existente (nunca substitui o array) — a
secretária não precisa saber o conteúdo atual de `notes` pra chamar isto.
Mesmo formato que a tela já grava (`NotesTab`): `{ id, body, createdAt }`.

```json
{ "success": true, "data": { "id": "...", "notes": [ { "id": "...", "body": "...", "createdAt": "..." } ], ... } }
```

### POST `?action=attachment_upload`

Body: `{ "task_id": "...", "file_name": "orcamento.pdf", "mime_type"?: "application/pdf", "base64": "..." }`

Sobe pro mesmo bucket privado que a tela usa (`personal-task-attachments`,
10MB, mesmos tipos de arquivo aceitos pela migration de origem). Path
gerado no servidor (`${ownerUserId}/${task_id}/...`), não configurável pelo
chamador.

```json
{ "success": true, "data": { "id": "...", "file_name": "orcamento.pdf", "file_size": 123456, "mime_type": "application/pdf", "created_at": "..." } }
```

### GET `?action=attachment_list&task_id=...`

```json
{ "data": [ { "id": "...", "file_name": "...", "file_size": 123456, "mime_type": "...", "created_at": "..." } ], "count": 1 }
```

### GET `?action=attachment_download&attachment_id=...`

Devolve um link assinado de 5 minutos (bucket é privado, não tem URL
pública fixa).

```json
{ "url": "https://...", "file_name": "orcamento.pdf", "expires_in": 300 }
```

## 4. Códigos de erro

| Código | Motivo |
|---|---|
| 400 | Campo obrigatório ausente, ação sem nada pra atualizar, ou arquivo acima de 10MB |
| 401 | Header `X-Personal-Tasks-Key` ausente ou errado |
| 404 | Tarefa/anexo não encontrado (ou não é do dono) |
| 405 | Método HTTP errado pra essa ação |
| 503 | Secrets da function não configurados |
| 500 | Erro do Supabase/inesperado |

## 5. Limitação conhecida

Concluir uma tarefa recorrente por aqui **não** recria a próxima ocorrência
automaticamente — essa lógica vive só no hook do frontend
(`src/hooks/use-personal-tasks.js`, `setTaskStatus`), não é um trigger de
banco. Pra tarefas recorrentes, a recriação automática só acontece
concluindo pela própria tela "Meu To-Do".

---
*Gerado em: 17/08/2026 — companion do agent-gateway-api.md. Atualizado em
26/08/2026: delete, note, anexos, e campos due_time/priority/recurrence/
related_lead_id em create/update.*
