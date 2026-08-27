-- Substitui o modelo de 1 secret fixo (PERSONAL_TASKS_AGENT_KEY +
-- PERSONAL_TASKS_OWNER_USER_ID) por N chaves — uma por conexão, cada uma
-- pertencendo a UM perfil. Decidido com o Daniel 27/08/2026: hoje só uma
-- conta do CRM pode receber tarefas da secretária agêntica (secretaria-
-- plataforma), fixa num secret de Edge Function; ele precisa poder trocar
-- entre a conta do trabalho e a pessoal (e vice-versa) sem editar secret
-- nenhum — só gerando uma chave nova em Configurações e colando ela do
-- lado da secretária.
--
-- Só o HASH (sha256, calculado no cliente) fica salvo — a chave em claro
-- nunca chega ao banco, nem passa por este servidor além do próprio
-- personal-tasks-agent (que recebe no header e recalcula o hash pra
-- comparar). Mesmo espírito do MD-12 (achado de 19/08/2026 sobre chave de
-- IA em claro) — aqui já nasce hasheada, sem esse risco residual.
create table public.personal_tasks_api_keys (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index personal_tasks_api_keys_profile_id_idx
  on public.personal_tasks_api_keys(profile_id);

alter table public.personal_tasks_api_keys enable row level security;

-- Espelha o predicado de profile_secrets (self-only pra tudo) — mesma
-- tabela-irmã mais próxima (dado pessoal, sem exceção de gerente/admin).
create policy personal_tasks_api_keys_self
  on public.personal_tasks_api_keys
  for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
