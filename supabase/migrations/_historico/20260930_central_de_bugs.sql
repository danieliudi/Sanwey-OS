-- Central de Bugs (mockup aprovado por Daniel, 17/08/2026): reportar bug,
-- Kanban de triagem (Reportado → Em análise → Correção proposta →
-- Corrigido), diagnóstico + PR de correção automática, aprovação humana.
-- Única tabela nova de fato (schema real, confirmado com o Daniel antes de
-- aplicar) — etapas do board são dado configurável em rh_pipeline_stages
-- (domain='bugs'), mesmo motor já usado por RH/Comex/Marketing (regra 5).

create table public.bug_reports (
  id                      uuid primary key default gen_random_uuid(),
  title                   text not null,
  description             text not null,
  module                  text,
  priority                text not null default 'media' check (priority in ('baixa', 'media', 'alta')),
  stage                   text not null default 'reportado',
  reported_by             uuid references public.profiles(id) on delete set null,
  -- Diagnóstico da análise automática diária (Opção A: nunca decide
  -- sozinha, só propõe — aprovação humana sempre via resolved_by/resolved_at).
  diagnosis               text,
  diagnosed_at            timestamptz,
  pr_url                  text,
  branch_name             text,
  -- Guardrail do mockup: bug que toca migration/RLS/edge function/auth
  -- nunca vira PR direto — fica marcado aqui pra entrar na revisão de
  -- Segurança (regra 3.1) em vez de a automação decidir sozinha.
  needs_security_review   boolean not null default false,
  resolution_note         text,
  resolved_by             uuid references public.profiles(id) on delete set null,
  resolved_at             timestamptz,
  -- Mesmo padrão de todo domínio Kanban da plataforma: log de sistema
  -- (activities) separado de comentário humano (notes) — ver CommentsPanel.
  activities              jsonb not null default '[]'::jsonb,
  notes                   jsonb not null default '[]'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.bug_reports enable row level security;

-- Qualquer usuário autenticado com perfil pode reportar — mesmo espírito
-- do formulário mostrado no mockup ("qualquer pessoa da plataforma").
create policy bug_reports_insert_own on public.bug_reports
  for insert
  with check (
    reported_by = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid())
  );

-- Quem reportou sempre vê o próprio card (acompanhar status) — só isso,
-- sem poder editar depois de enviado.
create policy bug_reports_select_own on public.bug_reports
  for select
  using (reported_by = auth.uid());

-- Admin vê e gerencia tudo — mesma checagem já usada em agent_actions
-- (current_user_is_admin(), tabela-irmã mais próxima pro padrão de
-- aprovação de proposta de IA).
create policy bug_reports_admin_all on public.bug_reports
  for all
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- Etapas do board — dado configurável em rh_pipeline_stages, domain='bugs'.
-- Mesmo shape do seed de 'feedback' (20260709_rh_feedback_kanban.sql).
insert into public.rh_pipeline_stages (domain, company_id, stage_key, name, color, order_idx, terminal, won)
values
  ('bugs', 'all', 'reportado',          'Reportado',           '#64748B', 0, false, false),
  ('bugs', 'all', 'em_analise',         'Em Análise',          '#5B4FC4', 1, false, false),
  ('bugs', 'all', 'correcao_proposta',  'Correção Proposta',   '#B4790A', 2, false, false),
  ('bugs', 'all', 'corrigido',          'Corrigido',           '#1A6E35', 3, true,  true)
on conflict (domain, company_id, stage_key) do nothing;

-- Guarda de etapa a nível de banco, mesmo mecanismo já usado por todo
-- domínio de RH (validate_rh_stage) — evita gravar um stage_key que não
-- existe em rh_pipeline_stages pro domain='bugs'.
create or replace function public.validate_rh_stage()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_domain text;
  v_stage text;
begin
  if tg_table_name = 'rh_vagas' then
    v_domain := 'vagas'; v_stage := new.stage;
  elsif tg_table_name = 'rh_aplicacoes' then
    v_domain := 'candidatos'; v_stage := new.etapa_pipeline;
  elsif tg_table_name = 'rh_colaboradores' then
    v_domain := 'onboarding'; v_stage := new.onboarding_stage;
  elsif tg_table_name = 'rh_avaliacoes' then
    v_domain := 'feedback'; v_stage := new.status;
  elsif tg_table_name = 'rh_ferias' then
    v_domain := 'ferias'; v_stage := new.status;
  elsif tg_table_name = 'rh_treinamento_atribuicoes' then
    v_domain := 'treinamentos'; v_stage := new.status;
  elsif tg_table_name = 'bug_reports' then
    v_domain := 'bugs'; v_stage := new.stage;
  end if;

  if v_stage is not null and not exists (
    select 1 from public.rh_pipeline_stages where domain = v_domain and stage_key = v_stage
  ) then
    raise exception 'Etapa "%" inválida para %', v_stage, v_domain;
  end if;

  return new;
end;
$function$;

create trigger bug_reports_validate_stage
  before insert or update on public.bug_reports
  for each row execute function public.validate_rh_stage();
