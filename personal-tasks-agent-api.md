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

## 1. Setup obrigatório (uma vez, por perfil que quiser conectar)

Desde 27/08/2026 não existe mais secret fixo de Edge Function pra isso —
cada perfil do sanwey-crm gera sua própria chave, direto na tela:

1. Logue no sanwey-crm com o perfil que você quer que receba as tarefas.
2. Vá em **Configurações → Integrações → Secretária de IA**.
3. Clique em **"Gerar nova chave"**, dê um nome (ex.: "Trabalho", "Pessoal")
   e copie o valor mostrado — ele só aparece **uma vez** (só o hash fica
   salvo no banco, ver `20261021_personal_tasks_api_keys.sql`).
4. Cole esse valor como `SANWEY_TASKS_API_TOKEN` do lado da secretária
   agêntica (mesmo padrão de token único que ela já usa pra Notion/Google
   Tasks).

Quer trocar qual perfil recebe as tarefas (ex.: do trabalho pra pessoal)?
Gere uma chave nova logado no OUTRO perfil e cole o novo valor no lugar do
antigo — não precisa mexer em nenhum secret de Supabase. Revogar uma chave
(mesma tela, botão "Revogar") derruba só aquela conexão, sem afetar outras.

## 2. Autenticação

```
X-Personal-Tasks-Key: <chave gerada em Configurações → Integrações → Secretária de IA>
```

Sem caminho de JWT — nada dentro do próprio sanwey-crm chama esta função (a
tela "Meu To-Do" já fala direto com o Supabase via RLS normal). A função
recebe a chave, calcula o hash (sha256) e resolve o dono da tarefa a partir
da chave (`personal_tasks_api_keys.profile_id`) — nunca de um parâmetro do
request. Chave ausente, errada, ou já revogada: `401`.

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
conclusão). Se duas chamadas de update mudarem status quase ao mesmo tempo,
uma pode responder `409` — tenta de novo.

```json
{ "success": true, "data": { "id": "...", "status": "concluido", "completed_at": "...", ... } }
```

### DELETE `?action=delete&id=...&confirm_title=...`

Exclusão definitiva — mesma ação do botão de lixeira que a tela já tem
(que exige um 2º clique de confirmação). Não existe "lixeira"/status de
cancelado: a tarefa some. `confirm_title` é **obrigatório** e precisa bater
com o título atual da tarefa (sem diferenciar maiúscula/espaço nas
pontas) — existe pra evitar que um pedido em linguagem natural mal
interpretado apague algo sem querer; se não bater, devolve `409` com o
título real, pra confirmar com o usuário antes de tentar de novo.

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

Body: `{ "task_id": "...", "file_name": "orcamento.pdf", "mime_type": "application/pdf", "base64": "..." }`

Sobe pro mesmo bucket privado que a tela usa (`personal-task-attachments`,
10MB). `mime_type` é obrigatório e precisa ser um destes (mesma allow-list
do bucket): `application/pdf`, `application/msword`,
`application/vnd.openxmlformats-officedocument.wordprocessingml.document`,
`application/vnd.ms-excel`,
`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
`text/csv`, `text/plain`, `image/jpeg`, `image/png`, `image/gif`,
`image/webp`. Path gerado no servidor (`${ownerUserId}/${task_id}/...`),
não configurável pelo chamador.

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
| 401 | Header `X-Personal-Tasks-Key` ausente, errado, ou já revogado |
| 404 | Tarefa/anexo não encontrado (ou não é do dono) |
| 405 | Método HTTP errado pra essa ação |
| 409 | `action=note`/`action=update`: muita escrita concorrente na mesma tarefa (3 tentativas sem conseguir) — tenta de novo. `action=delete`: `confirm_title` não bate com o título atual |
| 500 | Erro do Supabase/inesperado (inclusive falha ao validar a chave) |

## 5. Limitação conhecida

Concluir uma tarefa recorrente por aqui **não** recria a próxima ocorrência
automaticamente — essa lógica vive só no hook do frontend
(`src/hooks/use-personal-tasks.js`, `setTaskStatus`), não é um trigger de
banco. Pra tarefas recorrentes, a recriação automática só acontece
concluindo pela própria tela "Meu To-Do".

---
*Gerado em: 17/08/2026 — companion do agent-gateway-api.md. Atualizado em
26/08/2026: delete, note, anexos, e campos due_time/priority/recurrence/
related_lead_id em create/update. Atualizado em 27/08/2026: autenticação
migrada de secret fixo (1 dono só, pra sempre) pra chave por perfil, gerada em
Configurações → Integrações → Secretária de IA — qualquer perfil pode
conectar/trocar/revogar a própria conexão sem editar secret nenhum.*
