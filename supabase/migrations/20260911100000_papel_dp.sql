-- Cargo "dp" (Departamento Pessoal).
--
-- Decidido com o Daniel em 11/09/2026, a partir da reunião de RH de 10/09:
--   vê Funcionários · vê e EDITA Cargos & Salários · vê Férias & Licenças
--   NÃO vê Recrutamento · NÃO vê Avaliação de Desempenho · NÃO vê Pesquisa de clima
--
-- POR QUE NÃO ENTRAR EM `current_user_is_rh()`. Seria uma linha e resolveria o
-- acesso — e daria ao DP o módulo de RH inteiro de uma vez, incluindo as três
-- coisas que ele explicitamente NÃO deve ver. A função fica como está, e o DP
-- entra tabela a tabela, só nas quatro que ele usa.
--
-- Vale registrar o que "ver Funcionários" implica: a ficha carrega SALÁRIO, e
-- o escopo de rh_colaboradores é o Grupo inteiro (MD-10, decisão fechada). Ou
-- seja, DP passa a ver salário de todo mundo. É coerente com a função — é
-- quem processa folha — mas é a permissão mais sensível do lote, e está aqui
-- escrita em vez de implícita.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['admin','gerente','vendedor','suporte','marketing','gerente_marketing',
                           'agencia','rh','gerente_rh','dp','diretoria','comex','cliente']));

alter table public.profiles drop constraint if exists profiles_roles_check;
alter table public.profiles add constraint profiles_roles_check
  check (roles <@ array['admin','gerente','vendedor','suporte','marketing','gerente_marketing',
                        'agencia','rh','gerente_rh','dp','portal','diretoria','comex','cliente']);

-- Predicado único pras quatro tabelas do DP. Existe pra não repetir a lista de
-- cargos em 12 policies — e pra que, no dia em que o escopo do DP mudar, mude
-- num lugar só.
create or replace function public.current_user_is_pessoal()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(
    (select roles && array['rh','gerente_rh','dp','admin']::text[]
     from public.profiles where id = auth.uid()),
    false
  );
$$;
revoke all on function public.current_user_is_pessoal() from public;
grant execute on function public.current_user_is_pessoal() to authenticated, anon;

-- ---------- Funcionários ----------
drop policy if exists rh_colaboradores_rh_access on public.rh_colaboradores;
create policy rh_colaboradores_rh_access on public.rh_colaboradores
  for all using (current_user_is_pessoal()) with check (current_user_is_pessoal());

-- ---------- Cargos & Salários ----------
drop policy if exists rh_cargo_templates_rh_access on public.rh_cargo_templates;
create policy rh_cargo_templates_rh_access on public.rh_cargo_templates
  for all using (current_user_is_pessoal()) with check (current_user_is_pessoal());

-- ---------- Movimentações (promoção/mérito, parte de Cargos & Salários) ----------
drop policy if exists rh_movimentacoes_select on public.rh_movimentacoes;
create policy rh_movimentacoes_select on public.rh_movimentacoes
  for select using (current_user_is_pessoal());

drop policy if exists rh_movimentacoes_insert on public.rh_movimentacoes;
create policy rh_movimentacoes_insert on public.rh_movimentacoes
  for insert with check (
    current_user_is_pessoal() and status = 'pendente' and approved_by is null and approved_at is null
  );

drop policy if exists rh_movimentacoes_update on public.rh_movimentacoes;
create policy rh_movimentacoes_update on public.rh_movimentacoes
  for update using (current_user_is_pessoal());

drop policy if exists rh_movimentacoes_delete on public.rh_movimentacoes;
create policy rh_movimentacoes_delete on public.rh_movimentacoes
  for delete using (current_user_is_pessoal());

-- ---------- Férias & Licenças ----------
-- O ramo de auto-atendimento (colaborador abre a própria solicitação) fica
-- intacto; só o ramo de RH ganha o DP.
drop policy if exists rh_ferias_read on public.rh_ferias;
create policy rh_ferias_read on public.rh_ferias
  for select using (
    exists (select 1 from public.rh_colaboradores c
             where c.id = rh_ferias.user_id and c.profile_id = auth.uid())
    or current_user_is_pessoal()
  );

drop policy if exists rh_ferias_insert on public.rh_ferias;
create policy rh_ferias_insert on public.rh_ferias
  for insert with check (
    (exists (select 1 from public.rh_colaboradores c
              where c.id = rh_ferias.user_id and c.profile_id = auth.uid())
     and status = 'pendente' and approved_by is null and approved_at is null)
    or current_user_is_pessoal()
  );

drop policy if exists rh_ferias_update on public.rh_ferias;
create policy rh_ferias_update on public.rh_ferias
  for update using (current_user_is_pessoal());

drop policy if exists rh_ferias_delete on public.rh_ferias;
create policy rh_ferias_delete on public.rh_ferias
  for delete using (current_user_is_pessoal());
