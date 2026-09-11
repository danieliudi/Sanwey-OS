-- Cargo "dp" (Departamento Pessoal).
--
-- Decidido com o Daniel em 11/09/2026, a partir da reunião de RH de 10/09:
--   vê Funcionários · vê e EDITA Cargos & Salários · vê Férias & Licenças
--   NÃO vê Recrutamento · NÃO vê Avaliação de Desempenho · NÃO vê Pesquisa de clima
--
-- POR QUE NÃO ENTRAR EM `current_user_is_rh()`. Seria uma linha e resolveria o
-- acesso — e daria ao DP o módulo de RH inteiro, incluindo as três coisas que
-- ele explicitamente NÃO deve ver. A função fica como está, e o DP entra
-- tabela a tabela, só nas que ele usa.
--
-- "VÊ" É LEITURA, LITERALMENTE. A primeira versão desta migration concedia
-- FOR ALL em rh_colaboradores e rh_ferias, e a revisão de segurança mostrou o
-- que isso abria: o DP editaria o próprio salário direto na ficha, contornando
-- inteiro o fluxo de movimentação que o gatilho de aprovação protege; e
-- aprovaria as próprias férias com um UPDATE na própria linha, porque
-- rh_ferias não tem gatilho de aprovação nenhum. Escrita só onde o Daniel
-- usou o verbo editar: Cargos & Salários.
--
-- Vale registrar o que "ver Funcionários" implica: a ficha carrega SALÁRIO, e
-- o escopo de rh_colaboradores é o Grupo inteiro (MD-10, decisão fechada). DP
-- passa a ver salário de todo mundo. É coerente com quem processa folha, mas é
-- a permissão mais forte do lote e está aqui escrita em vez de implícita.

begin;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['admin','gerente','vendedor','suporte','marketing','gerente_marketing',
                           'agencia','rh','gerente_rh','dp','diretoria','comex','cliente']));

alter table public.profiles drop constraint if exists profiles_roles_check;
alter table public.profiles add constraint profiles_roles_check
  check (roles <@ array['admin','gerente','vendedor','suporte','marketing','gerente_marketing',
                        'agencia','rh','gerente_rh','dp','portal','diretoria','comex','cliente']);

-- Predicado de LEITURA do pessoal (RH + DP). Escrita continua em
-- current_user_is_rh(), que não conhece o DP.
create or replace function public.current_user_is_pessoal()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(
    (select roles && array['rh','gerente_rh','dp','admin']::text[]
     from public.profiles where id = (select auth.uid())),
    false
  );
$$;
-- Grant pra anon é NECESSÁRIO, não descuido: anon tem grant de tabela nestas
-- tabelas (default do PostgREST), então uma requisição anônima AVALIA este
-- predicado. Sem execute, ela recebe "permission denied for function" em vez
-- de lista vazia. Mesmo mecanismo que quebrou o upload público em 10/09.
-- Não vaza nada: devolve booleano sobre auth.uid(), que é NULL pra anon.
revoke all on function public.current_user_is_pessoal() from public;
grant execute on function public.current_user_is_pessoal() to authenticated, anon;

-- ---------- Funcionários: DP LÊ, RH escreve ----------
drop policy if exists rh_colaboradores_rh_access on public.rh_colaboradores;
create policy rh_colaboradores_rh_access on public.rh_colaboradores
  for all using (current_user_is_rh()) with check (current_user_is_rh());

create policy rh_colaboradores_dp_read on public.rh_colaboradores
  for select using (current_user_is_pessoal());

-- ---------- Cargos & Salários: DP edita (único verbo aprovado) ----------
drop policy if exists rh_cargo_templates_rh_access on public.rh_cargo_templates;
create policy rh_cargo_templates_rh_access on public.rh_cargo_templates
  for all using (current_user_is_pessoal()) with check (current_user_is_pessoal());

-- ---------- Movimentações: parte de Cargos & Salários ----------
-- DELETE fica com RH: apagar movimentação apaga trilha de promoção/mérito, e
-- isso não é "editar cargos e salários".
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

-- ---------- Férias: DP LÊ, RH aprova ----------
-- Sem gatilho de aprovação nesta tabela, dar UPDATE ao DP seria deixá-lo
-- aprovar as próprias férias — a classe de bug que o CLAUDE.md 3.1 já lista
-- como incidente conhecido aqui.
--
-- De quebra, o ramo de auto-atendimento é corrigido: ele usava um
-- `EXISTS (select 1 from rh_colaboradores ...)` inline, que é avaliado COMO O
-- USUÁRIO e portanto sofre a RLS de rh_colaboradores — onde não existe policy
-- de "vejo a minha própria ficha". Resultado: sempre falso pra quem não é RH,
-- e o colaborador não conseguia pedir nem ver as próprias férias
-- (MeuRHView.jsx:104 e :182). Zero linhas de rh_ferias pertencem a não-RH, o
-- que confere com o INSERT nunca ter passado. `is_own_colaborador` é
-- SECURITY DEFINER e atravessa a RLS — é o que rh_avaliacoes_read já usa.
drop policy if exists rh_ferias_read on public.rh_ferias;
create policy rh_ferias_read on public.rh_ferias
  for select using (is_own_colaborador(user_id) or current_user_is_pessoal());

drop policy if exists rh_ferias_insert on public.rh_ferias;
create policy rh_ferias_insert on public.rh_ferias
  for insert with check (
    (is_own_colaborador(user_id) and status = 'pendente' and approved_by is null and approved_at is null)
    or current_user_is_rh()
  );

-- update e delete de férias continuam como estão hoje (RH/admin) — não são
-- recriadas aqui de propósito, pra não haver dúvida de que nada mudou nelas.


-- ---------- Espelho no banco do que o menu mostra ----------
-- `current_user_has_module` é o gêmeo de src/utils/module-access.js. Sem o DP
-- aqui, a migration sozinha NÃO entrega a feature: `v_is_pure_rh` é falso pra
-- roles={'dp'}, então o DP cairia no ramo padrão, receberia o módulo Comercial
-- inteiro e não receberia nenhuma tela de RH (achado da revisão de segurança).
-- Regra 17: os dois espelhos mudam juntos ou divergem em silêncio.
create or replace function public.current_user_has_module(p_module text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_state text; v_override boolean; v_roles text[];
  v_is_admin boolean; v_is_manager boolean; v_is_marketing boolean;
  v_is_marketing_manager boolean; v_is_rh boolean; v_is_rh_manager boolean;
  v_is_agencia boolean; v_is_portal boolean; v_is_pure_marketing boolean;
  v_is_pure_rh boolean; v_is_market_intel boolean; v_is_diretoria boolean;
  v_is_pure_suporte boolean; v_is_dp boolean; v_is_pure_dp boolean;
begin
  select allow into v_override from public.profile_module_overrides
   where user_id = (select auth.uid()) and module_id = p_module;
  select roles into v_roles from public.profiles where id = (select auth.uid());
  if v_roles is null then v_roles := '{}'::text[]; end if;
  v_is_admin := v_roles && array['admin'];

  select state into v_state from public.module_states where module_id = p_module;
  v_state := coalesce(v_state, 'live');
  if v_state = 'off' then return false;
  elsif v_state = 'test' then
    if not (v_is_admin or v_override is true) then return false; end if;
  end if;

  if v_override is not null then return v_override; end if;

  v_is_manager           := v_roles && array['gerente','admin'];
  v_is_marketing         := v_roles && array['marketing','gerente_marketing','admin'];
  v_is_marketing_manager := v_roles && array['gerente_marketing','admin'];
  v_is_rh                := v_roles && array['rh','gerente_rh','admin'];
  v_is_rh_manager        := v_roles && array['gerente_rh','admin'];
  v_is_agencia           := v_roles && array['agencia'];
  v_is_portal            := array_length(v_roles,1) > 0 and v_roles <@ array['portal'];
  v_is_pure_marketing    := array_length(v_roles,1) > 0 and v_roles <@ array['marketing','gerente_marketing'];
  v_is_pure_rh           := array_length(v_roles,1) > 0 and v_roles <@ array['rh','gerente_rh'];
  v_is_pure_suporte      := array_length(v_roles,1) > 0 and v_roles <@ array['suporte'];
  v_is_dp                := v_roles && array['dp'];
  v_is_pure_dp           := array_length(v_roles,1) > 0 and v_roles <@ array['dp'];
  v_is_market_intel      := v_roles && array['vendedor','gerente','marketing','gerente_marketing','admin'];
  v_is_diretoria         := v_roles && array['diretoria'];

  if v_is_agencia or v_is_portal then return false; end if;
  if v_is_diretoria then return true; end if;

  if v_is_pure_suporte then
    return p_module = any(array['pedidos','clients','catalogo','chat','personal-tasks','meu-rh','tutorials',
                                'rh-onboarding','rh-treinamentos','rh-feedback']);
  end if;

  return case
    when p_module = 'catalogo'
      then (not v_is_pure_rh) and (not v_is_pure_dp) and (v_is_marketing or not v_is_pure_marketing)
    when p_module = any(array['commercial-overview','crm','clients','pedidos','signals','explorer','crm-viagens'])
      then not v_is_pure_marketing and not v_is_pure_rh and not v_is_pure_dp
    when p_module = 'crossref' then v_is_manager
    when p_module = any(array['marketing-home','marketing','marketing-solicitacoes','marketing-entregas',
         'marketing-fornecedores','marketing-compras','marketing-despesas','marketing-feiras'])
      then v_is_marketing
    -- As três do DP, separadas das demais de RH.
    when p_module = any(array['rh-funcionarios','rh-cargos','rh-ferias']) then v_is_rh or v_is_dp
    when p_module = any(array['rh-overview','rh-recrutamento','rh-comunicacao','rh-bem-estar','rh-fornecedores'])
      then v_is_rh
    when p_module = any(array['rh-onboarding','rh-treinamentos','rh-feedback']) then true
    when p_module = 'executive' then v_is_manager or v_is_marketing_manager or v_is_rh_manager
    when p_module = 'market-intel' then v_is_market_intel
    when p_module = 'agents' then v_is_manager or v_is_rh_manager
    when p_module = 'esg-carbono' then v_is_manager
    when p_module = 'automations' then v_is_manager or v_is_rh_manager
    when p_module = any(array['chat','personal-tasks','meu-rh','tutorials']) then true
    else false
  end;
end; $function$;

commit;
