-- Tabela nova pra alimentar a aba "Mercado" do hub de Inteligência (menu
-- Inteligência → Mercado/Insights/Cruzamento, decidido com o Daniel
-- 19-20/08/2026). Só "Mercado" precisa de tabela — "Insights" (dado interno)
-- e "Cruzamento" leem isto + leads/campaigns já existentes, sem schema novo.
--
-- Escrita: só via service_role, pelo mesmo padrão já em produção em
-- market_signals/prospect_seeds — o n8n ("Scout de Mercado") chama o
-- agent-gateway (X-Agent-Key), que grava em agent_actions pra aprovação
-- humana, e só publica aqui depois de aprovado
-- (publishMarketResearchIfApproved() no agent-gateway). Nenhuma policy de
-- INSERT/UPDATE/DELETE pra authenticated — igual às tabelas-irmãs, é o
-- próprio ausência de policy que bloqueia escrita de usuário logado.

create table public.market_intelligence_items (
  id uuid primary key default gen_random_uuid(),

  -- Categoria do conteúdo (abas internas da página Mercado).
  category text not null check (category in (
    'visao_geral', 'concorrencia', 'regulatorio', 'sustentabilidade', 'regional', 'preco_insumo'
  )),

  title text not null,
  summary text not null,          -- síntese curta (o que a Perplexity retorna)
  body text,                      -- detalhe opcional, mais longo
  source_url text,
  source_name text,               -- ex.: "Perplexity via n8n", nome da publicação

  -- Setor no mesmo vocabulário de leads.sector/prospect_seeds.sector —
  -- é o que permite a aba Cruzamento fazer join real com o funil comercial.
  -- null = conteúdo geral do setor, não específico de um sub-segmento.
  sector text,

  -- Escopo por empresa, null = visível pra todas (mesmo padrão de
  -- prospect_seeds.relevant_for).
  relevant_for text[],

  status text not null default 'published' check (status in ('published', 'archived')),

  automation_id uuid references public.automations(id) on delete set null,
  created_by text,                -- identificador da automação/workflow n8n

  detected_at timestamptz not null default now(),  -- quando o fato foi encontrado
  expires_at timestamptz,                          -- null = não expira
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.market_intelligence_items enable row level security;

comment on table public.market_intelligence_items is
  'Conteúdo de mercado/setor pra aba "Mercado" do hub de Inteligência. Escrita só via service_role (agent-gateway), leitura por role+empresa via RLS abaixo.';

-- Leitura: vendedor, gerente, marketing, gerente_marketing, admin — combinação
-- exata que o Daniel definiu 19/08/2026 ("vendedores, gerência/marketing/admin").
-- Escopo por empresa via relevant_for (null = todas).
create policy market_intelligence_items_read
  on public.market_intelligence_items
  for select
  to authenticated
  using (
    status = 'published'
    and (expires_at is null or expires_at > now())
    and (
      current_user_is_admin()
      or (
        current_user_roles() && array['vendedor', 'gerente', 'marketing', 'gerente_marketing']::text[]
        and (relevant_for is null or relevant_for && current_user_companies())
      )
    )
  );

create index market_intelligence_items_sector_idx on public.market_intelligence_items (sector);
create index market_intelligence_items_category_idx on public.market_intelligence_items (category);
create index market_intelligence_items_detected_at_idx on public.market_intelligence_items (detected_at desc);
