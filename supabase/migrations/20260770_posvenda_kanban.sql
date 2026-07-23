-- Kanban de Pós-venda — conectado ao Kanban de Venda (comercial) do mesmo
-- jeito que Recrutamento se conecta a Onboarding: uma ação explícita (botão
-- "Enviar para Pós-venda", só disponível quando o negócio está na etapa
-- "Ganho") cria um registro NOVO numa tabela própria — o negócio de origem
-- continua existindo em Venda, só marcado como já enviado.

-- 1. Marca no negócio de origem: quando (e se) ele já foi enviado pra
--    Pós-venda, pra não deixar mandar duas vezes sem querer.
alter table public.leads
  add column if not exists sent_to_posvenda_at timestamptz;

-- 2. Etapas do Kanban de Pós-venda — mesma tabela compartilhada de etapas
--    (rh_pipeline_stages) já usada por Venda/RH/Marketing, domain novo.
--    company_id='all': começa com 1 fluxo padrão pras 3 empresas, sem
--    customização por empresa (pode evoluir depois, igual os outros domains).
insert into public.rh_pipeline_stages (domain, stage_key, name, color, order_idx, terminal, won, lost, company_id)
values
  ('posvenda', 'onboarding_cliente', 'Onboarding do cliente', '#3B82F6', 0, false, false, false, 'all'),
  ('posvenda', 'acompanhamento',      'Acompanhamento',        '#8B5CF6', 1, false, false, false, 'all'),
  ('posvenda', 'renovacao_upsell',    'Renovação/Upsell',      '#16A34A', 2, false, false, false, 'all'),
  ('posvenda', 'encerrado',           'Encerrado',             '#64748B', 3, true,  false, false, 'all')
on conflict do nothing;

-- 3. Cards do Kanban de Pós-venda. lead_id aponta pro negócio de origem em
--    Venda (leads.id é text, não uuid) — on delete set null pra nunca
--    apagar o histórico de pós-venda mesmo se o negócio original sumir.
create table public.posvenda_cases (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  lead_id text references public.leads(id) on delete set null,
  client_name text not null,
  value numeric not null default 0,
  owner_ids text[] not null default '{}',
  stage text not null default 'onboarding_cliente',
  stage_changed_at timestamptz not null default now(),
  notes jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posvenda_cases_company_id_idx on public.posvenda_cases (company_id);
create index posvenda_cases_lead_id_idx on public.posvenda_cases (lead_id);

create function public.posvenda_cases_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger posvenda_cases_set_updated_at
  before update on public.posvenda_cases
  for each row execute function public.posvenda_cases_set_updated_at();

alter table public.posvenda_cases enable row level security;

-- Mesmo desenho de acesso de `leads` (mesma audiência: quem trabalha o
-- negócio de venda também trabalha o pós-venda dele) — admin/gerente veem
-- tudo da empresa, vendedor/consultor só o que é seu (ou de subordinado).
create policy posvenda_cases_select on public.posvenda_cases
  for select using (
    current_user_is_admin()
    or (current_user_has_role('gerente') and company_id = any (current_user_companies()))
    or (current_user_has_role('vendedor') and company_id = any (current_user_companies())
        and (owner_ids = '{}'::text[] or (auth.uid())::text = any (owner_ids) or owner_ids && current_user_subordinate_ids()))
    or (current_user_has_role('consultor') and company_id = any (current_user_companies())
        and (auth.uid())::text = any (owner_ids))
  );

create policy posvenda_cases_diretoria_read on public.posvenda_cases
  for select using (current_user_has_role('diretoria'));

create policy posvenda_cases_insert on public.posvenda_cases
  for insert with check (
    (current_user_has_role('admin') or current_user_has_role('gerente') or current_user_has_role('vendedor') or current_user_has_role('consultor'))
    and (current_user_is_admin() or company_id = any (current_user_companies()))
  );

create policy posvenda_cases_update on public.posvenda_cases
  for update using (
    current_user_is_admin()
    or (current_user_has_role('gerente') and company_id = any (current_user_companies()))
    or (current_user_has_role('vendedor') and company_id = any (current_user_companies())
        and (owner_ids = '{}'::text[] or (auth.uid())::text = any (owner_ids) or owner_ids && current_user_subordinate_ids()))
    or (current_user_has_role('consultor') and company_id = any (current_user_companies())
        and (auth.uid())::text = any (owner_ids))
  );

create policy posvenda_cases_delete on public.posvenda_cases
  for delete using (current_user_is_admin() or current_user_has_role('gerente'));
