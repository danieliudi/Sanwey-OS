-- Liga/desliga global por página. Aplicada em produção 12/08/2026.
--
-- Já existia o "Acesso por módulo" POR PESSOA (profile_module_overrides +
-- current_user_has_module). Faltava a chave GLOBAL: pra liberar uma página
-- pronta era preciso marcar módulo a módulo em cada usuário, e pra recolher,
-- desmarcar de novo um por um.
--
-- REGRA CENTRAL: a chave RESTRINGE, nunca AMPLIA.
--     vê a página = chave global permite E regra de cargo/exceção permite
-- Um "ou" no lugar do "e" faria "liberar" abrir a página pra empresa inteira
-- — e a primeira vez que isso acontecesse seria com a folha de pagamento.

create table public.module_states (
  module_id text primary key,
  state text not null default 'live' check (state in ('off','test','live')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.module_states is
  'Estado global de cada página/módulo. Linha ausente = "live" (comportamento de sempre), então a tabela nasce vazia e nada muda no dia da migration.';
comment on column public.module_states.state is
  'off = ninguém vê, nem admin. test = só admin e quem tiver exceção explícita em profile_module_overrides. live = vale a regra de cargo/exceção normal.';

alter table public.module_states enable row level security;

-- Todo mundo lê: o menu de cada usuário depende disto pra saber o que montar.
-- Não é dado sensível — é a lista de páginas e se estão no ar.
create policy module_states_read on public.module_states for select
  using (auth.uid() is not null);

create policy module_states_write on public.module_states for all
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

create trigger trg_module_states_touch before update on public.module_states
  for each row execute function public.uniform_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- A composição
-- ─────────────────────────────────────────────────────────────────────────
-- O portão entra DENTRO de current_user_has_module(), no topo. Assim todo
-- chamador que já existe herda a chave sem precisar ser tocado — e nenhum
-- caminho novo pode esquecer de aplicá-la. O corpo abaixo do portão é
-- exatamente o que já estava em produção.
--
-- (A versão final desta função, com os módulos novos espelhados, está em
--  20260924_module_states_espelha_modulos_novos.sql — aplicada em seguida.)
--
--   if v_state = 'off'  then return false;                       -- nem admin
--   elsif v_state = 'test' and not (v_is_admin or v_override) then return false;
--   end if;
--   ... regra de cargo/exceção que já existia ...

-- ─────────────────────────────────────────────────────────────────────────
-- Verificado em produção, 12 casos em transação revertida
-- ─────────────────────────────────────────────────────────────────────────
-- sem linha = live (nada muda) · off esconde de usuário comum · off esconde
-- até de ADMIN · test esconde de usuário comum · test mostra pra quem tem
-- exceção allow=true · off vence a exceção do testador · test mostra pra
-- admin · voltar pra live restaura · liberar não amplia (módulo sem regra de
-- cargo continua invisível).
