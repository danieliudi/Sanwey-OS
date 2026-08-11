-- Aprovado pelo Daniel 11/08/2026 ("Ok para tudo") sobre o plano entregue no
-- mesmo dia. Schema puro aqui — a UI (campo "Depende de" no drawer, badge
-- "Bloqueada" no card, aba "Automações" no Meu To-Do) ainda precisa de
-- mockup aprovado antes de codar (CLAUDE.md regra 3), então essa migration
-- só habilita o dado; a tela vem depois, separada.

create table public.personal_task_dependencies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid not null references public.personal_tasks(id) on delete cascade,
  depends_on_id uuid not null references public.personal_tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (task_id, depends_on_id),
  check (task_id <> depends_on_id)
);

alter table public.personal_task_dependencies enable row level security;

-- Mesmo predicado de personal_tasks_owner_all (personal_tasks) — dado
-- 100% privado, dono é quem pode ler/escrever, sem exceção de admin/gestor
-- (diferente de `automations`, que é regra de negócio de empresa e por isso
-- tem leitura aberta — aqui não faz sentido nenhum).
create policy personal_task_dependencies_owner_all on public.personal_task_dependencies
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index personal_task_dependencies_task_id_idx on public.personal_task_dependencies(task_id);
create index personal_task_dependencies_depends_on_id_idx on public.personal_task_dependencies(depends_on_id);

create table public.personal_task_automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  enabled boolean not null default true,
  trigger jsonb not null default '{}'::jsonb,
  condition_groups jsonb not null default '[]'::jsonb,
  then_actions jsonb not null default '[]'::jsonb,
  else_actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.personal_task_automations enable row level security;

create policy personal_task_automations_owner_all on public.personal_task_automations
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on table public.personal_task_dependencies is
  'Dependência entre tarefas do Meu To-Do (task_id depende de depends_on_id). Ciclo é checado em código, não dá pra expressar num CHECK simples.';
comment on table public.personal_task_automations is
  'Automações pessoais do Meu To-Do — mesmo vocabulário trigger/condition_groups/then_actions/else_actions de public.automations, mas tabela e RLS separadas de propósito: automations é regra de empresa (leitura aberta pra qualquer autenticado), isso aqui é dado pessoal (só o dono lê/escreve).';
