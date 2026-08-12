-- Metade "vitrine" do produto. Aplicada em produção 12/08/2026.
--
-- O registro de produto do portal B2B não é ficha comercial — é vitrine:
-- chamada, destaques, especificações, aplicações, categoria. Conteúdo de
-- Marketing. Se o portal ler do nosso banco, o catálogo precisa carregar os
-- dois conjuntos; senão o produto volta a viver em dois lugares.
--
-- DOIS DONOS NA MESMA LINHA:
--   suporte   → sku, unit, moq, preco_tabela, certifications, homologado, active
--   marketing → name, tagline, description, features, specs, applications,
--               category, icon, proposed
-- Quem garante isso é o trigger no fim deste arquivo, não a tela.

alter table public.products
  add column tagline text,
  add column features text[] not null default '{}',
  -- Pares rótulo/valor. jsonb em vez de dois arrays paralelos (que é como o
  -- portal guarda hoje) — array paralelo desalinha na primeira edição e
  -- ninguém percebe até a vitrine mostrar "Capacidade: INMETRO".
  add column specs jsonb not null default '[]'::jsonb,
  add column applications text[] not null default '{}',
  add column category text,
  add column icon text,
  -- Produto conceitual, ainda sem SKU/preço validados. O catálogo do portal
  -- tem 6 assim hoje, marcados no próprio arquivo deles como "candidatos
  -- propostos, não SKUs reais". Não some da vitrine — aparece marcado.
  add column proposed boolean not null default false,
  -- Tripla homologação INMETRO + ANTT 5998 + NORMAM-05. É o `certified` do
  -- portal. Fica do lado do SUPORTE porque é dado de compliance.
  add column homologado boolean not null default false;

comment on column public.products.specs is
  'Especificações da vitrine: [{"label":"Capacidade","value":"1.000 kg"}, ...]. O portal consome como specLabels/specValues.';
comment on column public.products.homologado is
  'Tripla homologação INMETRO + ANTT 5998 + NORMAM-05. Só produto homologado pode carregar essas três certificações.';

-- A trava de compliance. A regra da Resibag é que INMETRO, ANTT 5998 e
-- NORMAM-05 valem só para as linhas homologadas (Standard, Estruturado) —
-- nunca Filtrante ou Resíduo Verde. Certificação errada em embalagem de
-- resíduo perigoso, numa vitrine que o cliente lê, não é erro de digitação.
alter table public.products add constraint products_certificacao_restrita check (
  homologado
  or not (certifications && array['INMETRO','ANTT 5998','NORMAM-05']::text[])
);

alter table public.products add constraint products_specs_formato check (
  jsonb_typeof(specs) = 'array'
);

alter table public.products add constraint products_category_conhecida check (
  category is null
  or category = any (array['resibag','epi-seguranca','movimentacao','compliance'])
);

-- ─────────────────────────────────────────────────────────────────────────
-- Cada dono escreve só o seu lado
-- ─────────────────────────────────────────────────────────────────────────
-- Postgres não faz RLS por coluna, e a plataforma já resolve isso com trigger
-- que congela o que a pessoa não pode mexer — mesmo molde de
-- profiles_prevent_self_role_escalation. Congelar (em vez de recusar) evita
-- que um formulário que manda a linha inteira quebre sem motivo: cada um
-- salva, e o que não é dele simplesmente não muda.

create or replace function public.products_enforce_field_ownership()
returns trigger language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_roles text[];
begin
  select coalesce(roles,'{}'::text[]) into v_roles from public.profiles where id = auth.uid();
  if v_roles && array['admin','gerente']::text[] then return new; end if;

  if not (v_roles && array['suporte']::text[]) then          -- marketing não mexe no comercial
    new.sku := old.sku;  new.unit := old.unit;  new.moq := old.moq;
    new.preco_tabela := old.preco_tabela;  new.certifications := old.certifications;
    new.homologado := old.homologado;  new.active := old.active;
    new.company_id := old.company_id;
  end if;

  if not (v_roles && array['marketing','gerente_marketing']::text[]) then   -- suporte não mexe na vitrine
    new.tagline := old.tagline;  new.description := old.description;
    new.features := old.features;  new.specs := old.specs;
    new.applications := old.applications;  new.category := old.category;
    new.icon := old.icon;  new.proposed := old.proposed;
  end if;

  return new;
end; $$;

create trigger trg_products_field_ownership
  before update on public.products
  for each row execute function public.products_enforce_field_ownership();

-- Marketing alcança o Catálogo (leitura do catálogo das empresas dele; a
-- escrita já está limitada pelo trigger acima). Espelhado em
-- defaultModulesForRoles e em current_user_has_module('catalogo').
alter policy products_read_interno on public.products
  using (
    public.current_user_is_admin()
    or public.current_user_has_role('diretoria')
    or ((public.is_comercial_operator()
         or public.is_comercial_support()
         or public.current_user_roles() && array['marketing','gerente_marketing']::text[])
        and company_id = any (public.current_user_companies()))
  );

alter policy products_write on public.products
  using (
    public.current_user_is_admin()
    or ((public.current_user_has_role('gerente')
         or public.is_comercial_support()
         or public.current_user_roles() && array['marketing','gerente_marketing']::text[])
        and company_id = any (public.current_user_companies()))
  )
  with check (
    public.current_user_is_admin()
    or ((public.current_user_has_role('gerente')
         or public.is_comercial_support()
         or public.current_user_roles() && array['marketing','gerente_marketing']::text[])
        and company_id = any (public.current_user_companies()))
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Verificado em produção, 7 casos em transação revertida
-- ─────────────────────────────────────────────────────────────────────────
-- Suporte muda o preço de tabela e NÃO muda a chamada · Marketing escreve
-- chamada e especificações e NÃO muda o preço · INMETRO em produto não
-- homologado é recusado · ISO 9001 no mesmo produto é aceito.
