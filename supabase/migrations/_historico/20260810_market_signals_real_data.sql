-- Sinais de Mercado deixa de ser dado estático (src/data/generate-signals.js,
-- CNPJs fabricados, "há X dias" recalculado a cada carregamento) e passa a
-- ser alimentado por pesquisa real (Rotina agendada, fora do Supabase, com
-- acesso de verdade à web — o mecanismo de Agent Builder existente roda
-- dentro de uma edge function e não navega na internet).
--
-- Decisão com o Daniel (31/07): rascunho entra na mesma fila "Agentes de IA"
-- (agent_actions) já existente — reaproveita 100% o mecanismo de aprovação,
-- sem tela nova. Só ao aprovar é que a linha nasce em market_signals. Sem
-- lista de "empresas afetadas" fabricada (decisão explícita — removida do
-- schema e da tela).
--
-- prospect_seeds já existe e já serve pro mesmo propósito do lado de
-- Explorador — não precisa de tabela nova, só passa a receber linha nova
-- via aprovação em vez de ficar parado desde o seed único de 17/04.

create table public.market_signals (
  id          uuid primary key default gen_random_uuid(),
  company_id  text not null,
  source      text not null,
  title       text not null,
  excerpt     text not null,
  url         text,
  urgency     text not null default 'medio' check (urgency in ('critico','alto','medio','info')),
  detected_at timestamptz not null default now(),
  created_by  text,
  created_at  timestamptz not null default now()
);

alter table public.market_signals enable row level security;

-- Leitura: mesmo escopo por empresa já usado em leads/clients — a
-- visibilidade por papel (marketing/RH não veem "Sinais") já é aplicada na
-- navegação via current_user_has_module('signals'), não precisa duplicar
-- aqui.
create policy market_signals_read on public.market_signals
  for select
  using (
    current_user_is_admin()
    or company_id = any (current_user_companies())
  );

-- Sem policy de escrita pra authenticated: a única gravação é a aprovação em
-- agent-gateway (service role) — mesmo padrão de agent_actions -> tabela
-- final já usado pros outros agentes.

-- automations.module ganha os dois domínios novos.
alter table automations drop constraint if exists automations_module_check;
alter table automations add constraint automations_module_check
  check (module = any (array['crm','marketing','universal','rh-fornecedores','rh-vagas','rh-sourcing','sinais-mercado','prospeccao']));
