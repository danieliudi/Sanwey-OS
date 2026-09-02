# Agent Gateway — Contrato de API

**Endpoint base:**
```
https://adizvduyfzfftyswkijj.supabase.co/functions/v1/agent-gateway
```

---

## 1. Setup obrigatório (uma vez)

**Uma chave POR AGENTE — a chave única compartilhada foi aposentada.**

Até 18/08/2026 existia um secret só (`AGENT_GATEWAY_KEY`) e o `agent_id` vinha
declarado no corpo da requisição: quem tivesse a chave podia se passar por
qualquer agente. Hoje o `agent_id` é derivado de QUAL chave autenticou, nunca
do corpo. O secret antigo ainda foi aceito em paralelo durante o rollout, mas
**deixou de ser aceito em 02/09/2026** — quem ainda usar recebe 401.

Em https://supabase.com/dashboard/project/adizvduyfzfftyswkijj/settings/edge-functions
→ **"Edit secrets"**, defina uma chave distinta por agente (cada uma gerada
com `openssl rand -hex 32`):

| Secret | Agente |
|--------|--------|
| `AGENT_GATEWAY_KEY_SDR_Q` | SDR-Q — Qualificador |
| `AGENT_GATEWAY_KEY_SCOUT` | SCOUT — Inteligência de Conta |
| `AGENT_GATEWAY_KEY_CADENCIA` | CADÊNCIA — Follow-up Engine |
| `AGENT_GATEWAY_KEY_SENTINELA` | SENTINELA — Monitor de Funil |
| `AGENT_GATEWAY_KEY_CROSS` | CROSS — Oportunidades Cross-sell |
| `AGENT_GATEWAY_KEY_ESTEIRA` | ESTEIRA — Esteira editorial |

No n8n, cada workflow guarda só a credential do seu próprio agente. Chave não
configurada = aquele agente toma 401.

---

## 2. Autenticação

Toda requisição do n8n usa o header, com a chave DAQUELE agente:
```
X-Agent-Key: <valor do AGENT_GATEWAY_KEY_<AGENTE>>
```

Toda requisição do frontend usa:
```
Authorization: Bearer <JWT do usuário Supabase>
```

---

## 3. Rotas

### POST `?action=create` — Criar ação de agente

Usado pelo n8n para gravar uma sugestão/ação no CRM.

**Headers:**
```
X-Agent-Key: <key>
Content-Type: application/json
```

**Body:**
```json
{
  "action_type":  "followup_reminder",
  "lead_id":      "lead_abc123",
  "company_id":   "resibag",
  "title":        "Lead parado há 7 dias",
  "summary":      "Braskem S.A. está em Qualificação sem atividade desde 23/04. Sugiro reativação.",
  "payload": {
    "days_stale": 7,
    "last_stage": "qualificacao",
    "draft_email": "Olá Bruno, ..."
  },
  "priority":     "high",
  "expires_at":   "2026-05-07T00:00:00Z",
  "run_id":       "n8n_exec_00123",
  "n8n_workflow": "cadencia-diaria",
  "log_activity": true
}
```

**Campos obrigatórios:** `action_type`, `title`

> **`agent_id` NÃO vai no corpo.** Ele é derivado da chave que autenticou a
> chamada. Mandar `agent_id` no body não dá erro, mas é ignorado — o valor
> gravado é sempre o do dono da credencial.

**`agent_id` gravados (um por chave):**
| Valor | Agente |
|-------|--------|
| `sdr_q` | SDR-Q — Qualificador |
| `scout` | SCOUT — Inteligência de Conta |
| `cadencia` | CADÊNCIA — Follow-up Engine |
| `sentinela` | SENTINELA — Monitor de Funil |
| `cross` | CROSS — Oportunidades Cross-sell |

**`action_type` por agente (referência):**
| agent_id | action_type |
|----------|-------------|
| sdr_q | `qualify_lead`, `assign_owner`, `set_urgency` |
| scout | `account_brief`, `decision_maker_found`, `competitive_intel` |
| cadencia | `followup_reminder`, `reactivation_draft`, `escalate_stale` |
| sentinela | `pipeline_health`, `close_date_risk`, `no_owner_alert` |
| cross | `crosssell_opportunity`, `group_overlap` |

**`priority` aceitos:** `low`, `normal`, `high`, `urgent`

**Resposta 201:**
```json
{
  "success": true,
  "data": { "id": "uuid-da-acao", "status": "pending", ... }
}
```

---

### GET `?action=list` — Listar ações

Usado pelo frontend ou pelo n8n para consultar ações existentes.

**Query params opcionais:**

| Param | Descrição |
|-------|-----------|
| `status` | `pending`, `in_review`, `approved`, `rejected`, `executed`, `ignored` |
| `agent_id` | Filtrar por agente específico |
| `company_id` | `comercial`, `industria`, `resibag`, `montemor` |
| `lead_id` | Filtrar por lead específico |
| `limit` | Máx 200, padrão 50 |
| `include_expired` | `true` para incluir expiradas |

**Exemplo:**
```
GET ?action=list&status=pending&company_id=resibag&limit=20
```

**Resposta 200:**
```json
{
  "data": [ { ...acao, "leads": { "company": "Braskem", "stage": "qualificacao" } } ],
  "count": 5
}
```

> O n8n pode usar esta rota para verificar se uma sugestão já existe antes de criar duplicada.

---

### PATCH `?action=resolve` — Resolver uma ação

Usado pelo frontend quando gerente/vendedor age sobre a sugestão.

**Body:**
```json
{
  "id":              "uuid-da-acao",
  "status":          "approved",
  "resolution_note": "Enviei o email, aguardando retorno."
}
```

**`status` aceitos para resolução:** `in_review`, `approved`, `rejected`, `executed`, `ignored`

**Quem pode definir o quê (desde 02/09/2026):**

| Credencial | Pode definir | Observação |
|---|---|---|
| JWT (pessoa, pelo frontend) | todos os cinco | grava `resolved_by` com o id de quem resolveu |
| `X-Agent-Key` (agente) | `in_review`, `executed` | `executed` só se a linha já estiver `approved` |

Agente propõe, pessoa decide: `approved` dispara efeito real (notifica gestor
da vaga, notifica responsável, publica pesquisa de mercado), então aprovar e
recusar são exclusivos do caminho humano. `ignored` também fica de fora — fecha
o item sem ninguém ver. Um agente também só alcança as ações que **ele mesmo**
criou, e não reescreve a nota de uma linha já resolvida.

---

### GET `?action=leads` — Ler leads para processamento

Usado pelos agentes n8n para varrer o pipeline.
**Requer X-Agent-Key** (não disponível para frontend).

**Query params opcionais:**

| Param | Descrição |
|-------|-----------|
| `company_id` | Filtrar por empresa |
| `stage` | `prospeccao`, `qualificacao`, `proposta`, `negociacao`, `ganho`, `perdido` |
| `owner` | UUID do vendedor responsável |
| `limit` | Máx 500, padrão 100 |

**Exemplo n8n (CADÊNCIA — busca leads parados):**
```
GET ?action=leads&stage=qualificacao&limit=200
```

---

### POST `?action=log_activity` — Registrar atividade no histórico do lead

Usado pelo n8n para registrar no log de atividades do lead (visível no drawer).

**Body:**
```json
{
  "lead_id":  "lead_abc123",
  "type":     "agent_enrich",
  "title":    "CNPJ enriquecido pelo SDR-Q",
  "content":  "Razão social atualizada. CNAE: 2099-1/99. Porte: Grande.",
  "metadata": { "agent_id": "sdr_q", "fields_updated": ["razao_social", "cnae", "size"] }
}
```

**`type` aceitos:** `agent_suggestion`, `agent_enrich`, `agent_qualify`, `stage_change`, `call`, `email`, `whatsapp`, `note`, `nurture`

---

## 4. Códigos de erro

| Código | Significado |
|--------|-------------|
| 400 | Body inválido / campo obrigatório ausente |
| 401 | Sem autenticação (sem X-Agent-Key nem JWT) |
| 403 | Rota restrita a agentes (sem X-Agent-Key), ou status não permitido pra credencial de agente |
| 404 | Recurso não encontrado — ou existe, mas foi criado por outro agente |
| 405 | Método HTTP incorreto para esta rota |
| 409 | Transição inválida: `executed` em ação não aprovada, ou nota em ação já resolvida |
| 500 | Erro interno (detalhe no campo `error`) |

---

## 5. Exemplo completo: fluxo n8n CADÊNCIA

```
1. HTTP Request (GET)
   URL: <endpoint>?action=leads&stage=qualificacao&stage=proposta&limit=200
   Headers: X-Agent-Key: {{$credentials.agentKey}}

2. Code node (JS) — filtrar leads parados >5 dias
   const stale = items.filter(l => {
     const days = (Date.now() - new Date(l.last_activity)) / 86400000;
     return days >= 5;
   });

3. Claude API — gerar draft de reativação por lead
   Prompt: "Lead: {{company}}, Stage: {{stage}}, Trigger: {{trigger_label}} ..."

4. HTTP Request (POST) — criar agent_action por lead
   URL: <endpoint>?action=create
   Headers: X-Agent-Key: {{$credentials.agentKey}}
   Body: {
     "agent_id": "cadencia",
     "action_type": "reactivation_draft",
     "lead_id": "{{lead.id}}",
     ...
   }
```

---

## 6. Tabelas criadas nesta sessão

| Tabela | Descrição |
|--------|-----------|
| `public.agent_actions` | Log de todas as ações/sugestões dos agentes |

**Colunas principais:** `id`, `agent_id`, `action_type`, `lead_id`, `company_id`, `title`, `summary`, `payload` (jsonb), `priority`, `status`, `resolved_by`, `resolved_at`, `resolution_note`, `run_id`, `n8n_workflow`, `expires_at`, `created_at`

**RLS:** gerentes vêem tudo; vendedores vêem apenas ações dos seus leads.

---

*Gerado em: 30/04/2026 — Sanwey CRM v4.0*
