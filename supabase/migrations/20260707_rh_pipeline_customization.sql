-- RH Kanban parity com o Pipeline de CRM (inspirado no Pipefy): etapas
-- administráveis, campos customizados por etapa, anexos, checklists e
-- timeline de atividades para os módulos de Vagas, Candidatos e Onboarding.
--
-- Espelha o padrão já usado no CRM (leads.custom_fields / pipeline_stage_fields)
-- só que desacoplado de "empresa" (companyId) e generalizado pros 3 domínios —
-- aqui a chave é domain ('vagas' | 'candidatos' | 'onboarding') + stage_key.
--
-- Etapas viram DADO (rh_pipeline_stages) em vez de enum fixo em JS/CHECK —
-- diferente do StageEditorModal do CRM, que persiste em localStorage (não
-- serve pra RH, onde a customização precisa ser compartilhada entre usuários).

-- 1. rh_pipeline_stages — etapas administráveis por domínio
create table public.rh_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  domain text not null check (domain in ('vagas','candidatos','onboarding')),
  stage_key text not null,
  name text not null,
  color text not null default '#64748B',
  order_idx integer not null default 0,
  probability numeric,
  sla_days integer,
  terminal boolean not null default false,
  won boolean not null default false,
  lost boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (domain, stage_key)
);

-- 2. rh_pipeline_stage_fields — campos customizados por etapa
create table public.rh_pipeline_stage_fields (
  id uuid primary key default gen_random_uuid(),
  domain text not null check (domain in ('vagas','candidatos','onboarding')),
  stage_key text not null,
  field_key text not null,
  field_type text not null check (field_type in ('text','textarea','number','currency','date','datetime','time','email','phone','url','checkbox','select','radio','multicheck','user')),
  label text not null,
  required boolean not null default false,
  options jsonb not null default '[]',
  order_idx integer not null default 0,
  placeholder text,
  help_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (domain, stage_key, field_key)
);

-- 3. rh_attachments — anexos genéricos por domínio + registro
create table public.rh_attachments (
  id uuid primary key default gen_random_uuid(),
  domain text not null check (domain in ('vagas','candidatos','onboarding')),
  record_id uuid not null,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index rh_attachments_domain_record_idx on public.rh_attachments (domain, record_id);

-- 4. rh_checklists — checklists genéricos (só vagas/candidatos — onboarding já
--    tem rh_onboarding_tarefas, uma tabela por-item mais completa)
create table public.rh_checklists (
  id uuid primary key default gen_random_uuid(),
  domain text not null check (domain in ('vagas','candidatos')),
  record_id uuid not null,
  title text not null,
  items jsonb not null default '[]',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rh_checklists_domain_record_idx on public.rh_checklists (domain, record_id);

-- 5. rh_vagas / rh_aplicacoes / rh_colaboradores ganham custom_fields +
--    activities (mesmo molde de leads.custom_fields / leads.activities).
alter table public.rh_vagas add column if not exists activities jsonb not null default '[]';
alter table public.rh_vagas add column if not exists custom_fields jsonb not null default '{}';
alter table public.rh_aplicacoes add column if not exists activities jsonb not null default '[]';
alter table public.rh_aplicacoes add column if not exists custom_fields jsonb not null default '{}';
alter table public.rh_colaboradores add column if not exists activities jsonb not null default '[]';
alter table public.rh_colaboradores add column if not exists custom_fields jsonb not null default '{}';

-- 6. Etapas deixam de ser um CHECK fixo — um trigger valida contra
--    rh_pipeline_stages, permitindo adicionar/remover etapas customizadas
--    sem travar o primeiro INSERT/UPDATE numa etapa nova.
alter table public.rh_vagas drop constraint if exists rh_vagas_stage_check;
alter table public.rh_colaboradores drop constraint if exists rh_colaboradores_onboarding_stage_check;

create or replace function public.validate_rh_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
  end if;

  if v_stage is not null and not exists (
    select 1 from public.rh_pipeline_stages where domain = v_domain and stage_key = v_stage
  ) then
    raise exception 'Etapa "%" inválida para %', v_stage, v_domain;
  end if;

  return new;
end;
$$;

create trigger validate_stage before insert or update of stage on public.rh_vagas
  for each row execute function public.validate_rh_stage();
create trigger validate_stage before insert or update of etapa_pipeline on public.rh_aplicacoes
  for each row execute function public.validate_rh_stage();
create trigger validate_stage before insert or update of onboarding_stage on public.rh_colaboradores
  for each row execute function public.validate_rh_stage();

-- 7. Seed das etapas atuais (mantém stage_key idêntico ao que já está gravado
--    em rh_vagas.stage / rh_aplicacoes.etapa_pipeline / rh_colaboradores.
--    onboarding_stage — nenhuma linha existente muda de etapa).
insert into public.rh_pipeline_stages (domain, stage_key, name, color, order_idx, terminal) values
  ('vagas', 'rascunho',   'Rascunho',    '#8A8680', 0, false),
  ('vagas', 'publicada',  'Publicada',   '#0EA5E9', 1, false),
  ('vagas', 'em_triagem', 'Em Triagem',  '#8B5CF6', 2, false),
  ('vagas', 'encerrada',  'Encerrada',   '#6B7280', 3, true)
on conflict (domain, stage_key) do nothing;

insert into public.rh_pipeline_stages (domain, stage_key, name, color, order_idx, terminal, won, lost) values
  ('candidatos', 'triagem',     'Triagem',          '#6366F1', 0, false, false, false),
  ('candidatos', 'entrevista1', 'Entrevista RH',    '#0EA5E9', 1, false, false, false),
  ('candidatos', 'entrevista2', 'Entrevista Gestor','#8B5CF6', 2, false, false, false),
  ('candidatos', 'tecnico',     'Teste Técnico',    '#F59E0B', 3, false, false, false),
  ('candidatos', 'proposta',    'Proposta',         '#10B981', 4, false, false, false),
  ('candidatos', 'aprovado',    'Aprovado',         '#16A34A', 5, true,  true,  false),
  ('candidatos', 'reprovado',   'Reprovado',        '#6B7280', 6, true,  false, true)
on conflict (domain, stage_key) do nothing;

insert into public.rh_pipeline_stages (domain, stage_key, name, color, order_idx, terminal) values
  ('onboarding', 'documentacao',   'Documentação',   '#8A8680', 0, false),
  ('onboarding', 'integracao',     'Integração',     '#0EA5E9', 1, false),
  ('onboarding', 'acompanhamento', 'Acompanhamento', '#7C3AED', 2, false),
  ('onboarding', 'avaliacao',      'Avaliação',      '#D97706', 3, false),
  ('onboarding', 'concluido',      'Concluído',      '#16A34A', 4, true)
on conflict (domain, stage_key) do nothing;

-- 8. Storage bucket de anexos do RH — privado, só RH/admin.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rh-attachments', 'rh-attachments', false, 10485760,
  array['application/pdf','image/jpeg','image/png','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/msword','application/vnd.ms-excel']
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'objects' and schemaname = 'storage' and policyname = 'rh_attachments_rh_access'
  ) then
    create policy "rh_attachments_rh_access" on storage.objects
      for all
      using (
        bucket_id = 'rh-attachments'
        and exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('admin','gerente_rh','rh'))
      )
      with check (
        bucket_id = 'rh-attachments'
        and exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('admin','gerente_rh','rh'))
      );
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'objects' and schemaname = 'storage' and policyname = 'rh_attachments_self_read'
  ) then
    create policy "rh_attachments_self_read" on storage.objects
      for select
      using (
        bucket_id = 'rh-attachments'
        and exists (
          select 1 from public.rh_colaboradores c
          where c.profile_id = (select auth.uid())
            and (storage.foldername(name))[1] = 'onboarding'
            and (storage.foldername(name))[2] = c.id::text
        )
      );
  end if;
end $$;

-- 9. RLS. Chamadas de auth.uid() embrulhadas em (select ...) desde já —
--    evita o antipadrão auth_rls_initplan (reavaliação por linha).
alter table public.rh_pipeline_stages enable row level security;
alter table public.rh_pipeline_stage_fields enable row level security;
alter table public.rh_attachments enable row level security;
alter table public.rh_checklists enable row level security;

create policy rh_pipeline_stages_read on public.rh_pipeline_stages for select to authenticated
using (true);
create policy rh_pipeline_stages_write on public.rh_pipeline_stages for all to authenticated
using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = any (array['admin','gerente_rh','rh'])))
with check (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = any (array['admin','gerente_rh','rh'])));

create policy rh_pipeline_stage_fields_read on public.rh_pipeline_stage_fields for select to authenticated
using (true);
create policy rh_pipeline_stage_fields_write on public.rh_pipeline_stage_fields for all to authenticated
using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = any (array['admin','gerente_rh','rh'])))
with check (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = any (array['admin','gerente_rh','rh'])));

create policy rh_attachments_rh_access on public.rh_attachments for all to authenticated
using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = any (array['admin','gerente_rh','rh'])))
with check (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = any (array['admin','gerente_rh','rh'])));
create policy rh_attachments_self_read on public.rh_attachments for select to authenticated
using (
  domain = 'onboarding'
  and exists (select 1 from public.rh_colaboradores c where c.id = record_id and c.profile_id = (select auth.uid()))
);

create policy rh_checklists_rh_access on public.rh_checklists for all to authenticated
using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = any (array['admin','gerente_rh','rh'])))
with check (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = any (array['admin','gerente_rh','rh'])));
