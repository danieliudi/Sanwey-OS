-- Guarda-corpo de margem. Aplicada em produção 12/08/2026.
-- Pedido do Daniel: "abaixo de % X avisar, e deixar negociar até tanto de
-- desconto, mas regra dura de nunca menor que tanto" — com o gerente
-- escolhendo usar aviso, regra dura, ou os dois.
--
-- UM EIXO SÓ, COM SINAL. O Daniel descreveu de dois jeitos ("margem em cima"
-- e "desconto"), que são a mesma reta vista de lados opostos. Então o número
-- guardado é a variação percentual sobre o preço de tabela:
--
--     preco_cliente = preco_tabela × (1 + pct/100)
--
--   +20  → vender 20% acima da tabela
--     0  → vender na tabela
--   -10  → conceder 10% de desconto
--
-- Assim "avisar abaixo de 15%" e "nunca abaixo de -10% de desconto" convivem
-- na mesma configuração, sem dois campos que significam a mesma coisa em
-- unidades diferentes — que é como esse tipo de regra costuma virar bug.

create table public.margin_rules (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  -- NULL = regra padrão da empresa. Preenchido = exceção pra um produto
  -- específico, que ganha do padrão. Duas linhas, uma tabela, sem herança
  -- complicada: o mais específico vence.
  product_id uuid references public.products(id) on delete cascade,
  margem_aviso_pct numeric(6,2),    -- abaixo disto a tela avisa. NULL = não avisa.
  margem_minima_pct numeric(6,2),   -- abaixo disto o banco recusa. NULL = sem regra dura.
  active boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Avisar num patamar abaixo do que já é proibido nunca dispararia.
  constraint margin_rules_aviso_acima_do_minimo check (
    margem_aviso_pct is null or margem_minima_pct is null
    or margem_aviso_pct >= margem_minima_pct
  ),
  -- Uma regra que não avisa nem bloqueia é linha morta ocupando o slot da
  -- empresa/produto e escondendo a regra que deveria estar ali.
  constraint margin_rules_tem_alguma_regra check (
    margem_aviso_pct is not null or margem_minima_pct is not null
  )
);

create unique index margin_rules_padrao_empresa
  on public.margin_rules(company_id) where product_id is null;
create unique index margin_rules_excecao_produto
  on public.margin_rules(company_id, product_id) where product_id is not null;

alter table public.margin_rules enable row level security;

-- Quem define a orientação é a gerência.
create policy margin_rules_write on public.margin_rules for all
  using (public.current_user_is_admin()
         or (public.current_user_has_role('gerente') and company_id = any (public.current_user_companies())))
  with check (public.current_user_is_admin()
              or (public.current_user_has_role('gerente') and company_id = any (public.current_user_companies())));

-- Vendedor e suporte leem: o vendedor precisa ver o limite pra negociar
-- dentro dele, e a tela precisa saber quando avisar.
create policy margin_rules_read on public.margin_rules for select
  using (
    public.current_user_is_admin()
    or public.current_user_has_role('diretoria')
    or ((public.is_comercial_operator() or public.is_comercial_support())
        and company_id = any (public.current_user_companies()))
  );

create trigger trg_margin_rules_touch before update on public.margin_rules
  for each row execute function public.uniform_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- Uma fonte só pra conta
-- ─────────────────────────────────────────────────────────────────────────
-- A tela e a trava do banco usam ESTA função. Se a fórmula mudar, muda num
-- lugar — nunca em dois, que é como tela e banco começam a discordar e o
-- vendedor vê "ok" na tela e leva erro ao salvar.

create or replace function public.margin_check(
  p_company_id text,
  p_product_id uuid,
  p_price numeric
)
returns table (
  preco_tabela numeric,
  margem_pct numeric,
  aviso_pct numeric,
  minimo_pct numeric,
  avisa boolean,
  bloqueia boolean
)
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  with tabela as (
    select p.preco_tabela from public.products p where p.id = p_product_id
  ),
  regra as (
    select r.margem_aviso_pct, r.margem_minima_pct
    from public.margin_rules r
    where r.company_id = p_company_id
      and r.active
      and (r.product_id = p_product_id or r.product_id is null)
    order by (r.product_id is null)   -- exceção do produto ganha do padrão
    limit 1
  ),
  calc as (
    select t.preco_tabela,
           case when t.preco_tabela is null or t.preco_tabela = 0 then null
                else round((p_price / t.preco_tabela - 1) * 100, 2) end as margem_pct
    from tabela t
  )
  select c.preco_tabela,
         c.margem_pct,
         g.margem_aviso_pct,
         g.margem_minima_pct,
         coalesce(c.margem_pct is not null and g.margem_aviso_pct  is not null and c.margem_pct < g.margem_aviso_pct,  false),
         coalesce(c.margem_pct is not null and g.margem_minima_pct is not null and c.margem_pct < g.margem_minima_pct, false)
  from calc c left join regra g on true;
$$;
revoke all on function public.margin_check(text, uuid, numeric) from public;
revoke execute on function public.margin_check(text, uuid, numeric) from anon;
grant execute on function public.margin_check(text, uuid, numeric) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- A regra dura mora no banco, não na tela
-- ─────────────────────────────────────────────────────────────────────────
-- Se a trava vivesse só no formulário, seria uma sugestão: qualquer caminho
-- que não passe por aquele botão fura. Aqui não fura.
--
-- Sem preço de tabela cadastrado não há base de cálculo — nesse caso passa.
-- É ausência de conta possível, não permissão concedida; a tela avisa que o
-- produto está sem tabela.
--
-- Admin passa por cima: é a válvula de escape pra exceção pontual, e fica
-- registrado em updated_by quem salvou. Gerente NÃO passa — se a orientação
-- mudou, o caminho é mudar a regra, que é auditável, em vez de furar caso a
-- caso. Se na prática isso apertar demais, é uma linha pra afrouxar.

create or replace function public.enforce_margin_rule()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_company text;
  v record;
  v_msg text;
begin
  if public.current_user_is_admin() then
    return new;
  end if;

  select p.company_id into v_company from public.products p where p.id = new.product_id;
  if v_company is null then return new; end if;

  select * into v from public.margin_check(v_company, new.product_id, new.price);

  if v.bloqueia then
    v_msg := format(
      'Margem de %s%% está abaixo do mínimo de %s%% definido pela gerência para este produto. Fale com a gerência para revisar a regra.',
      to_char(v.margem_pct, 'FM990.00'), to_char(v.minimo_pct, 'FM990.00'));
    raise exception '%', v_msg using errcode = 'check_violation';
  end if;

  return new;
end; $$;

create trigger trg_client_products_margem
  before insert or update of price on public.client_products
  for each row execute function public.enforce_margin_rule();

-- ─────────────────────────────────────────────────────────────────────────
-- Verificado em produção, 8 casos em transação revertida
-- ─────────────────────────────────────────────────────────────────────────
-- Regra: avisa abaixo de +15%, bloqueia abaixo de -10%. Tabela R$ 100.
--   R$ 130 (+30%)  → passa limpo
--   R$ 108  (+8%)  → avisa, não bloqueia
--   R$  85 (-15%)  → avisa e bloqueia
--   exceção de produto com mínimo 0% → -5% bloqueia, onde a empresa deixaria
--   produto sem preço de tabela → margem null, não bloqueia
--   salvar a R$ 85 → recusado com a mensagem pro vendedor
--   salvar a R$ 92 (-8%) → aceito
--   baixar depois pra R$ 80 → recusado (o UPDATE também passa pela trava)
