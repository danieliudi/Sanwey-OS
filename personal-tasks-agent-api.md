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

Body: `{ "title": "...", "description"?: "...", "due_date"?: "YYYY-MM-DD", "tag"?: "Resibag" }`

`title` obrigatório. `tag`, se vier, vira o único item de `tags`.

```json
{ "success": true, "data": { "id": "...", "status": "a_fazer", ... } }
```

### PATCH `?action=update`

Body: `{ "id": "...", "status"?: "a_fazer"|"fazendo"|"concluido", "title"?, "description"?, "due_date"? }`

Usado principalmente pra concluir (`status: "concluido"` — nunca `"feito"`,
que é a etapa de Arquivar, não de Conclusão). Seta `completed_at`
automaticamente quando o status vira terminal.

```json
{ "success": true, "data": { "id": "...", "status": "concluido", "completed_at": "...", ... } }
```

## 4. Códigos de erro

| Código | Motivo |
|---|---|
| 400 | Campo obrigatório ausente, ou ação sem nada pra atualizar |
| 401 | Header `X-Personal-Tasks-Key` ausente ou errado |
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
*Gerado em: 17/08/2026 — companion do agent-gateway-api.md*
