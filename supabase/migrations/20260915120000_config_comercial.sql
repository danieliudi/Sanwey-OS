-- Configuração comercial por frente — hoje, um número só
--
-- Decidido com o Daniel em 15/09/2026 (opção B do mockup "Quatro decisões,
-- quatro telas"): o limiar de "alto volume" passa a ser editável em
-- Configurações, em vez de constante no código.
--
-- ── POR QUE ISTO EXISTE ───────────────────────────────────────────────────
-- A pergunta de maior peso do Checklist Comercial de Vendas — 20 dos 100
-- pontos — é "alto volume". A folha impressa nunca disse a partir de quantos
-- bags/mês uma conta conta como alto volume, e chutar faria o item de maior
-- peso mentir na carteira inteira. Enquanto o número não existia, o item
-- saía do numerador E do denominador, e o score fechava em 80 — a faixa A
-- (80-100) era inalcançável por construção.
--
-- ── POR QUE TABELA, E NÃO CONSTANTE ───────────────────────────────────────
-- Regra 5: antes de assumir schema novo, conferir se o dado já é
-- configurável. Foi conferido em 15/09/2026 — não há nenhuma tabela de
-- configuração neste banco (`information_schema` devolve zero para
-- %config%/%setting%/%param%/%preferen%), e `useLeadFormConfig` guarda em
-- localStorage, que é por navegador. Um número que alimenta um score que a
-- diretoria olha não pode ser por navegador.
--
-- ── POR QUE company_id É text SEM FK ──────────────────────────────────────
-- Não existe tabela de empresas: as frentes vivem em COMPANIES
-- (src/constants/companies.js). E `industria` é o id da frente Sanwey — é
-- CONTRATO, não nome: o trackforge-os lê `market_signals` mapeando
-- sanwey → "industria". Ver regra 18 do CLAUDE.md antes de renomear.

create table if not exists public.crm_config_comercial (
  company_id              text primary key,
  limiar_alto_volume_bags integer,
  updated_at              timestamptz not null default now(),
  updated_by              uuid
);

comment on table public.crm_config_comercial is
  'Configuração comercial por frente (company_id de COMPANIES: "industria", "resibag", ...). Uma linha por frente, criada sob demanda pela tela de Configurações. Nunca conter segredo — leitura é liberada a todo usuário autenticado porque o score do Checklist de Visita é calculado no cliente.';
comment on column public.crm_config_comercial.limiar_alto_volume_bags is
  'A partir de quantos bags/mês a conta pontua "alto volume" (+20) na seção 8 do Checklist Comercial de Vendas. NULO = não configurado: o item sai do numerador e do denominador do score, e a tela diz por quê (regra 14 — razão sem denominador honesto não sustenta decisão). Valor por frente de propósito: o que é alto volume pra Resibag não é o mesmo que pra Sanbag.';

-- Guarda-corpo de faixa: zero bags/mês como limiar faria todo mundo pontuar
-- alto volume, que é o oposto de medir.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.crm_config_comercial'::regclass
      and conname = 'crm_config_comercial_limiar_check'
  ) then
    alter table public.crm_config_comercial
      add constraint crm_config_comercial_limiar_check
      check (limiar_alto_volume_bags is null or limiar_alto_volume_bags > 0);
  end if;
end $$;

alter table public.crm_config_comercial enable row level security;

-- ── RLS ───────────────────────────────────────────────────────────────────
-- Espelha `rh_pipeline_stages`, a tabela-irmã mais próxima (configuração de
-- domínio, lida por todos, escrita por admin/gerente) — regra 3.1: policy
-- nova compara com o predicado já em produção, não inventa modelo próprio.
--
-- Leitura liberada porque o score é calculado no navegador de quem abre o
-- card: sem SELECT, o vendedor veria "alto volume fora da conta" para
-- sempre. Não há nada sensível aqui — é um número de política comercial.
-- TO authenticated, e não o default TO public: o default inclui `anon`, e com
-- o grant padrão do Supabase um visitante anônimo leria a configuração
-- comercial. A irmã que esta policy espelha (`rh_pipeline_stages_read`) é
-- TO authenticated — "espelha a tabela-irmã" tem que ser verdade, não só
-- estar escrito. (Achado de revisão, 15/09/2026.)
drop policy if exists crm_config_comercial_read on public.crm_config_comercial;
create policy crm_config_comercial_read
  on public.crm_config_comercial
  for select
  to authenticated
  using (true);

-- Escrita por cargo, via roles[] e nunca via profiles.role (regra 2.1 /
-- MD-11): o escalar nega acesso a quem tem o cargo como secundário.
-- `current_user_is_admin()` e `current_user_has_role()` já leem o array.
drop policy if exists crm_config_comercial_write on public.crm_config_comercial;
create policy crm_config_comercial_write
  on public.crm_config_comercial
  for all
  using      (current_user_is_admin() or current_user_has_role('gerente'))
  with check (current_user_is_admin() or current_user_has_role('gerente'));
