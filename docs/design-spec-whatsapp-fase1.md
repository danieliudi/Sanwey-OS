# Spec — Integração WhatsApp via n8n (Fase 1)

Status: investigação/spec, **nada implementado**. Schema novo — precisa
confirmação explícita do Daniel antes de aplicar (CLAUDE.md regra 5). Maior
build isolado do levantamento, e trava numa decisão externa à plataforma.

## Realidade a registrar antes de qualquer coisa

Isso trava numa decisão de negócio que só o Daniel resolve, fora da
plataforma — conta verificada no Meta Business Manager (1-3 dias úteis),
número de telefone dedicado (não pode ser o número já em uso no WhatsApp
Business comum), e aprovação prévia de pelo menos 1 template de mensagem
pela Meta antes de mandar qualquer coisa pra fora. Nada disso é simulável —
é o mesmo tipo de dependência externa da chave mestra de IA (trava até o
Daniel agir do lado de fora do Claude Code).

## Fase 1 — o que dá pra construir JÁ, independente do Meta

- **Schema**: tabela de conversas/mensagens
  (`whatsapp_conversations`/`whatsapp_messages`, ou nome a definir) escopada
  por `lead_id`/`client_id`, com `opt_in: boolean` (recomendação explícita
  do doc fonte — checkbox de consentimento antes de qualquer envio de saída)
  e `company_id` pro isolamento multi-tenant, RLS espelhando o predicado já
  em produção mais parecido (`activities`/`lead_attachments`).
- **UI**: aba/thread de conversa dentro do `LeadDetailDrawer` — nasce com
  estado vazio ("Nenhuma conversa ainda") e já fica pronta pra popular assim
  que o webhook real existir.
- **Esqueleto do fluxo n8n**: já existe nó nativo WhatsApp Business Cloud no
  n8n (confirmado no doc fonte) e o padrão "agente propõe, humano aprova" já
  existe via `agent-gateway` (`agent_actions.status='pending'` até
  aprovação) — reaproveitar essa fila pra envio de saída em vez de inventar
  mecanismo de aprovação novo.

## Fase 2 — só depois do Daniel resolver o lado Meta

Webhook real recebendo mensagem → vira `lead`/atividade automaticamente
(mesmo padrão do "criação automática de lead" do doc fonte); envio de saída
via template aprovado, com enforcement de `opt_in` antes de qualquer disparo
e tratamento de "STOP" (remove de envios automáticos futuros).

Mockup (estado da Fase 1): ver artifact "Novas Features do Funil", item 7.

## Schema/RLS/Storage

SIM, schema novo (Fase 1 já exige as tabelas) — precisa confirmação
explícita do Daniel antes de aplicar (regra 5). RLS nova (regra 3.1 aciona
`security-agent`). Storage não é tocado (mensagem de texto, sem anexo
binário na v1).
