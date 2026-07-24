-- Presets compartilhados de seleção de métricas do Relatório de RH
-- (decisão do Daniel 23/07: compartilhado pela empresa, não por usuário).
-- RLS espelha rh_fornecedores: RH escreve, diretoria lê.
-- Já aplicada no projeto via MCP (apply_migration) em 23/07/2026.
create table if not exists public.rh_report_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  metric_keys text[] not null default '{}',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rh_report_presets enable row level security;

create policy rh_report_presets_rh_access on public.rh_report_presets
  for all using (current_user_is_rh()) with check (current_user_is_rh());

create policy rh_report_presets_diretoria_read on public.rh_report_presets
  for select using (current_user_has_role('diretoria'::text));
