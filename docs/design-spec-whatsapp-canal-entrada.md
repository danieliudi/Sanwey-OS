# Spec de design — WhatsApp como canal de entrada (comercial + RH)

Status: **aguardando aprovação de schema do Daniel** (regra 5 do CLAUDE.md).
Plano aprovado em 28/07/2026. Esta spec cobre a **Fase 1** (entrada, sem IA).

## 1. Problema

Contato que chega pelo WhatsApp morre fora da plataforma: alguém lê no celular
e, se lembrar, cadastra à mão. Sem registro de espera, de quem foi avisado, nem
histórico da conversa quando o negócio avança. A captura automática existente
só cobre formulário web (`src/main.jsx:19-21`), o canal que o público menos usa.

## 2. Restrições reais que moldam o desenho

Levantadas no código, não presumidas:

| # | Restrição | Origem | Consequência de design |
|---|---|---|---|
| R1 | `submit_lead_capture` bloqueia **3 envios do mesmo telefone em 24h** | `20260726_fix_public_rpcs_email_validation_regression.sql` | A RPC **não pode** ser chamada por mensagem. Só na criação do contato |
| R2 | `submit_lead_capture` só aceita `company_id ∈ ('industria','resibag')` | idem | Monte Mor fora desta rodada (exclusão deliberada — ver tarefa #57) |
| R3 | `submit_talent_pool_application` exige `p_consentimento_lgpd = true` **e** currículo | `20260730_rh_submit_talent_pool_application.sql` | O bot de RH precisa coletar consentimento e arquivo **antes** de criar candidato |
| R4 | `agent_actions.agent_id` tem CHECK fechado | `20260780_agent_builder_fase1_schema.sql` | Precisa de valor novo pro agente de atendimento |
| R5 | `leads.id` é **text**; `rh_candidatos.id` é **uuid** | `20260519_*`, `20260613_rh_module.sql` | As FKs da conversa têm tipos diferentes |
| R6 | Meta reenvia se não receber 200 rápido | Cloud API | Gravação idempotente por `wamid`; processamento pesado assíncrono |
| R7 | Janela de 24h pra resposta livre | Cloud API | Conversa guarda `window_expires_at` |

## 3. Decisão central: a conversa é a entidade de primeira classe

O lead/candidato **nasce da conversa**, não o contrário. É isso que resolve R1:
40 mensagens da mesma pessoa viram 1 conversa e, no máximo, 1 card.

```
mensagem chega
  → acha conversa por (canal, telefone)   ← sem tocar em RPC
      ├─ achou   → só anexa a mensagem
      └─ não achou → cria conversa
                    → comercial: submit_lead_capture(p_source:'whatsapp')
                    → RH: só cria card quando tiver LGPD + currículo
```

## 4. Schema proposto (2 tabelas + 1 CHECK) — PENDENTE DE APROVAÇÃO

### 4.1 `channel_conversations`

```sql
create table if not exists public.channel_conversations (
  id                uuid primary key default gen_random_uuid(),
  channel           text not null check (channel in ('whatsapp','site_chat')),
  destination       text not null check (destination in ('comercial','rh')),
  company_id        text not null,
  -- Identidade do contato no canal (telefone E.164 no WhatsApp).
  contact_key       text not null,
  contact_name      text,
  contact_email     text,
  -- Card gerado. Tipos diferentes porque leads.id é text e rh_candidatos.id é uuid (R5).
  lead_id           text references public.leads(id)          on delete set null,
  candidato_id      uuid references public.rh_candidatos(id)  on delete set null,
  -- Relógio da janela de 24h da Meta (R7). Renovado a cada inbound.
  window_expires_at timestamptz,
  -- Consentimento LGPD coletado na conversa (R3) — sem isto, RH não cria card.
  lgpd_consent_at   timestamptz,
  status            text not null default 'aberta'
                    check (status in ('aberta','aguardando_humano','resolvida','ignorada')),
  assigned_to       uuid references public.profiles(id) on delete set null,
  last_inbound_at   timestamptz,
  last_outbound_at  timestamptz,
  created_at        timestamptz not null default now(),
  unique (channel, destination, contact_key)
);
```

O `unique (channel, destination, contact_key)` é o que garante "um contato, uma
conversa por destino" — a mesma pessoa pode falar com comercial e com RH sem
os dois se misturarem.

### 4.2 `channel_messages`

```sql
create table if not exists public.channel_messages (
  id                   uuid primary key default gen_random_uuid(),
  conversation_id      uuid not null references public.channel_conversations(id) on delete cascade,
  direction            text not null check (direction in ('inbound','outbound')),
  -- wamid da Meta. UNIQUE = idempotência contra reentrega (R6).
  provider_message_id  text unique,
  body                 text,
  media_url            text,
  media_type           text,
  status               text not null default 'recebida'
                       check (status in ('recebida','rascunho','aprovada','enviada','falhou')),
  agent_action_id      uuid references public.agent_actions(id) on delete set null,
  sent_by              uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now()
);
```

O `provider_message_id unique` é a peça que impede card duplicado quando a Meta
reenvia — o insert simplesmente falha por conflito e o webhook devolve 200.

### 4.3 CHECK do `agent_actions`

```sql
alter table agent_actions drop constraint if exists agent_actions_agent_id_check;
alter table agent_actions add constraint agent_actions_agent_id_check
  check (agent_id = any (array['sdr_q','scout','cadencia','sentinela','cross','automation','atendimento']));
```

`'atendimento'` é o agente que rascunha resposta de conversa (Fase 2).

### 4.4 RLS

Segue o padrão já usado em `agent_actions`: gerente/admin vê tudo da própria
empresa; vendedor vê as conversas dos leads dele; RH vê as de destino `rh`.
Escrita pelo webhook via `service_role` (edge function), nunca pelo cliente.

## 5. O que NÃO muda

- `submit_lead_capture` e `submit_talent_pool_application` ficam **intocadas** —
  o webhook as chama como estão, passando `p_source: 'whatsapp'` (o parâmetro já
  existe, default `'site'`).
- `agent-gateway` fica como está. O webhook é função nova porque o contrato da
  Meta (challenge + HMAC) é diferente do `X-Agent-Key`.
- Nenhuma tela existente muda na Fase 1.

## 6. Reaproveitamento obrigatório (regra 1 do CLAUDE.md)

| Preciso de | Uso o que já existe |
|---|---|
| Notificação no sino | tabela `notifications` + padrão de `notifyMentions` |
| E-mail | edge functions de e-mail já em produção |
| Fila de aprovação (Fase 2) | `agent_actions` + `AgentActionsView` |
| Triagem de currículo | prompt do botão "Triar com IA" do Recrutamento |
| Debounce de realtime | `src/utils/debounce.js` |
| Tokens visuais | `--accent`, `--warning`, `--danger` de `src/index.css` |

## 7. Verificação

- `hub.challenge` responde o eco correto.
- HMAC **inválido** → recusa (teste negativo obrigatório).
- Mesmo `wamid` duas vezes → 1 mensagem, 1 card.
- 10 mensagens do mesmo número → **1 lead só** (prova de que R1 foi resolvido).
- RH sem consentimento LGPD → **nenhum** candidato criado.
- `npx vite build` limpo.

## 8. Pendências pro Daniel

1. **Aprovar o schema** da seção 4 (2 tabelas + 1 CHECK).
2. Confirmar se **Monte Mor** entra (hoje bloqueado por R2, exclusão deliberada).
3. Fase 0 (burocracia Meta): verificar negócio, número dedicado por destino,
   submeter templates — pré-requisito, corre em paralelo.
