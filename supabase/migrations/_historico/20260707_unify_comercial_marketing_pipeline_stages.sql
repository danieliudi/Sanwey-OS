-- Estende o sistema de etapas/campos do RH (rh_pipeline_stages /
-- rh_pipeline_stage_fields) pro Comercial (leads) e Marketing (campanhas +
-- entregas) — antes viviam em localStorage (use-pipelines.js /
-- use-pipeline-transitions.js), não compartilhado entre usuários.
--
-- RH não é escopado por empresa; Comercial é (Sanwey/Resibag têm pipelines
-- próprios) — por isso as tabelas ganham company_id, com 'all' como padrão
-- (RH sempre usa 'all', preservando as 16 linhas existentes sem mudança).
--
-- Nome das tabelas fica "rh_*" por não quebrar os hooks/componentes de RH já
-- em produção (risco desnecessário de renomear uma tabela em uso) — mas a
-- partir desta migration elas servem os domínios comercial/marketing também.

alter table public.rh_pipeline_stages add column if not exists company_id text not null default 'all';
alter table public.rh_pipeline_stage_fields add column if not exists company_id text not null default 'all';

alter table public.rh_pipeline_stages drop constraint if exists rh_pipeline_stages_domain_stage_key_key;
alter table public.rh_pipeline_stages add constraint rh_pipeline_stages_domain_company_stage_key
  unique (domain, company_id, stage_key);

alter table public.rh_pipeline_stage_fields drop constraint if exists rh_pipeline_stage_fields_domain_stage_key_field_key_key;
alter table public.rh_pipeline_stage_fields add constraint rh_pipeline_stage_fields_domain_company_stage_field_key
  unique (domain, company_id, stage_key, field_key);

alter table public.rh_pipeline_stages drop constraint if exists rh_pipeline_stages_domain_check;
alter table public.rh_pipeline_stages add constraint rh_pipeline_stages_domain_check
  check (domain in ('vagas','candidatos','onboarding','comercial','marketing','marketing_deliverables'));

alter table public.rh_pipeline_stage_fields drop constraint if exists rh_pipeline_stage_fields_domain_check;
alter table public.rh_pipeline_stage_fields add constraint rh_pipeline_stage_fields_domain_check
  check (domain in ('vagas','candidatos','onboarding','comercial','marketing','marketing_deliverables'));

-- Código de 2 letras usado só pelo Pipeline comercial (F/E/D/C/B/A/X) —
-- nullable pra não afetar RH/Marketing, que não têm esse conceito.
alter table public.rh_pipeline_stages add column if not exists code text;

-- Tabela de transições permitidas — mesma semântica do use-pipeline-
-- transitions.js: ausência de linhas pra um (domain, company, from_stage) =
-- aberto (qualquer destino permitido); uma vez configurado, grava todas as
-- combinações from->to (allowed true/false) — replica buildOpenRules().
create table if not exists public.pipeline_stage_transitions (
  id uuid primary key default gen_random_uuid(),
  domain text not null check (domain in ('vagas','candidatos','onboarding','comercial','marketing','marketing_deliverables')),
  company_id text not null default 'all',
  from_stage_key text not null,
  to_stage_key text not null,
  allowed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (domain, company_id, from_stage_key, to_stage_key)
);

alter table public.pipeline_stage_transitions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'pipeline_stage_transitions' and policyname = 'pipeline_stage_transitions_read') then
    create policy pipeline_stage_transitions_read on public.pipeline_stage_transitions for select to authenticated
    using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'pipeline_stage_transitions' and policyname = 'pipeline_stage_transitions_write') then
    create policy pipeline_stage_transitions_write on public.pipeline_stage_transitions for all to authenticated
    using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = any (array['admin','gerente'])))
    with check (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = any (array['admin','gerente'])));
  end if;
end $$;

-- rh_pipeline_stages/rh_pipeline_stage_fields agora servem Comercial e
-- Marketing além de RH — a policy de escrita original só liberava papéis de
-- RH (admin/gerente_rh/rh), o que bloquearia um gerente comercial editando
-- o Pipeline Builder. Amplia pros papéis gerenciais de cada domínio; quem
-- vê qual editor continua controlado na UI (isManager / nav de RH).
drop policy if exists rh_pipeline_stages_write on public.rh_pipeline_stages;
create policy rh_pipeline_stages_write on public.rh_pipeline_stages for all to authenticated
using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = any (array['admin','gerente','gerente_rh','rh','marketing','gerente_marketing'])))
with check (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = any (array['admin','gerente','gerente_rh','rh','marketing','gerente_marketing'])));

drop policy if exists rh_pipeline_stage_fields_write on public.rh_pipeline_stage_fields;
create policy rh_pipeline_stage_fields_write on public.rh_pipeline_stage_fields for all to authenticated
using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = any (array['admin','gerente','gerente_rh','rh','marketing','gerente_marketing'])))
with check (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = any (array['admin','gerente','gerente_rh','rh','marketing','gerente_marketing'])));

-- Semeia as etapas atuais do Comercial (por empresa — hoje vivem em
-- DEFAULT_PIPELINE_STAGES + localStorage) e do Marketing (hoje MARKETING_
-- STAGES / DELIVERABLE_STAGES, sempre globais — sem variação por empresa).
insert into public.rh_pipeline_stages (domain, company_id, stage_key, name, color, order_idx, probability, sla_days, terminal, won, lost, code) values
  ('comercial', 'industria', 'prospeccao',   'Prospecção',           '#B45309', 0, 10,  7,    false, false, false, 'F'),
  ('comercial', 'industria', 'qualificacao', 'Qualificação',         '#DC2626', 1, 25,  7,    false, false, false, 'E'),
  ('comercial', 'industria', 'visitas',      'Visitas/Apresentação', '#EAB308', 2, 40,  14,   false, false, false, 'D'),
  ('comercial', 'industria', 'amostras',     'Amostras/Maturação',   '#16A34A', 3, 60,  21,   false, false, false, 'C'),
  ('comercial', 'industria', 'negociacao',   'Negociação',           '#3B82F6', 4, 80,  14,   false, false, false, 'B'),
  ('comercial', 'industria', 'ganho',        'Negócio Fechado',      '#1E3A8A', 5, 100, null, true,  true,  false, 'A'),
  ('comercial', 'industria', 'perdido',      'Perdido',              '#C7212B', 6, 0,   null, true,  false, true,  'X'),
  ('comercial', 'resibag',   'prospeccao',   'Prospecção',           '#B45309', 0, 10,  7,    false, false, false, 'F'),
  ('comercial', 'resibag',   'qualificacao', 'Qualificação',         '#DC2626', 1, 25,  7,    false, false, false, 'E'),
  ('comercial', 'resibag',   'visitas',      'Visitas/Apresentação', '#EAB308', 2, 40,  14,   false, false, false, 'D'),
  ('comercial', 'resibag',   'amostras',     'Amostras/Maturação',   '#16A34A', 3, 60,  21,   false, false, false, 'C'),
  ('comercial', 'resibag',   'negociacao',   'Negociação',           '#3B82F6', 4, 80,  14,   false, false, false, 'B'),
  ('comercial', 'resibag',   'ganho',        'Negócio Fechado',      '#1E3A8A', 5, 100, null, true,  true,  false, 'A'),
  ('comercial', 'resibag',   'perdido',      'Perdido',              '#C7212B', 6, 0,   null, true,  false, true,  'X')
on conflict (domain, company_id, stage_key) do nothing;

insert into public.rh_pipeline_stages (domain, company_id, stage_key, name, color, order_idx, sla_days, terminal) values
  ('marketing', 'all', 'briefing',  'Briefing',  '#1D4ED8', 0, 3,    false),
  ('marketing', 'all', 'aprovacao', 'Aprovação', '#EA7309', 1, 5,    false),
  ('marketing', 'all', 'producao',  'Produção',  '#D97706', 2, 14,   false),
  ('marketing', 'all', 'revisao',   'Revisão',   '#7C3AED', 3, 5,    false),
  ('marketing', 'all', 'ao_vivo',   'Ao Vivo',   '#16A34A', 4, null, false),
  ('marketing', 'all', 'encerrado', 'Encerrado', '#9CA3AF', 5, null, true)
on conflict (domain, company_id, stage_key) do nothing;

insert into public.rh_pipeline_stages (domain, company_id, stage_key, name, color, order_idx, sla_days, terminal) values
  ('marketing_deliverables', 'all', 'solicitacao', 'Solicitação', '#6366F1', 0, null, false),
  ('marketing_deliverables', 'all', 'em_producao',  'Em Produção', '#D97706', 1, 7,    false),
  ('marketing_deliverables', 'all', 'revisao',      'Revisão',     '#7C3AED', 2, 3,    false),
  ('marketing_deliverables', 'all', 'entregue',     'Entregue',    '#16A34A', 3, null, true)
on conflict (domain, company_id, stage_key) do nothing;
