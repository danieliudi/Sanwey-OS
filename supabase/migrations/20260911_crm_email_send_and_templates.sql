-- Aprovado pelo Daniel 11/08/2026 ("segue suas sugestões") sobre o mockup
-- "Enviar email + Templates (Funil de Vendas)". Reaproveita a infra de envio
-- já em produção (Resend, mesmo padrão de supabase/functions/rh-send-email
-- e outros) — só o schema de log/template é novo.

create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  body_html text not null,
  scope text not null default 'shared' check (scope in ('shared','private')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
alter table public.email_templates enable row level security;

create policy email_templates_select on public.email_templates
  for select
  using (scope = 'shared' or created_by = auth.uid() or current_user_is_admin());

create policy email_templates_insert on public.email_templates
  for insert
  with check (
    created_by = auth.uid()
    and (current_user_roles() && array['vendedor','consultor','gerente','admin']::text[])
  );

create policy email_templates_update on public.email_templates
  for update
  using (created_by = auth.uid() or current_user_is_admin())
  with check (created_by = auth.uid() or current_user_is_admin());

create policy email_templates_delete on public.email_templates
  for delete
  using (created_by = auth.uid() or current_user_is_admin());

-- Log de envio real (substitui o mailto: que só registrava "iniciado", nunca
-- confirmava envio de verdade — ver activities.type='email_sent' já
-- existente). Só a edge function escreve aqui (service role, bypassa RLS) —
-- de propósito não existe policy de INSERT pro client: enviar email exige a
-- chave do Resend, que só a edge function tem. lead_id é text (mesmo tipo de
-- leads.id, não uuid).
create table public.lead_emails (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null references public.leads(id) on delete cascade,
  template_id uuid references public.email_templates(id) on delete set null,
  to_email text not null,
  subject text not null,
  body_html text not null,
  sent_by uuid references public.profiles(id) on delete set null,
  sent_at timestamptz not null default now(),
  resend_message_id text,
  status text not null default 'sent' check (status in ('sent','failed')),
  error_message text
);
alter table public.lead_emails enable row level security;

-- NOTA: a policy criada aqui (espelhando activities_select) foi corrigida
-- logo em seguida pela migration 20260912_fix_lead_emails_select_match_leads_select.sql
-- — mantida como estava no momento pra registro histórico do que rodou;
-- a versão vigente é a da migration seguinte.
create policy lead_emails_select on public.lead_emails
  for select
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_emails.lead_id
        and (
          current_user_role() = any (array['admin'::text, 'gerente'::text])
          or (
            current_user_role() = 'vendedor'::text
            and l.company_id = any (current_user_companies())
            and (l.owner is null or l.owner = (auth.uid())::text)
          )
        )
    )
  );

-- Lembrete recorrente "vinculado ao lead" (decisão B do mockup, opção 1):
-- reaproveita o Meu To-Do em vez de motor novo. `related_lead_id` deixa o
-- card levar de volta pro lead com 1 clique; `recurrence = 'custom'` +
-- `recurrence_config.intervalDays` cobre "a cada N dias" sem mudar o
-- jsonb já existente. text (não uuid), mesmo motivo de lead_emails.lead_id.
alter table public.personal_tasks
  add column related_lead_id text references public.leads(id) on delete set null;

alter table public.personal_tasks drop constraint personal_tasks_recurrence_check;
alter table public.personal_tasks
  add constraint personal_tasks_recurrence_check
  check (recurrence = any (array['none'::text, 'daily'::text, 'weekly'::text, 'monthly'::text, 'custom'::text]));

comment on column public.personal_tasks.related_lead_id is
  'Preenchido quando a tarefa nasce de "Repetir email" no Funil de Vendas (LeadDetailDrawer) — deep link de volta pro lead. Null pra toda tarefa pessoal comum.';
