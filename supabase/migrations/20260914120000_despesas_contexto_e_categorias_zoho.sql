-- Despesas: referência por contexto (Capital/Interior) e categorias espelhando o Zoho
--
-- Decidido com o Daniel em 14/09/2026 ("segue o que já temos, e segue o Zoho"),
-- a partir dos dois mockups de Despesas e do que foi LIDO da conta Zoho real
-- da Sanwey (org 881366952) no mesmo dia.
--
-- ── POR QUE "CAPITAL / INTERIOR" E NÃO "CIDADE / RODOVIA" ──────────────────
-- Eu tinha proposto "cidade / rodovia". Lendo o Zoho, descobri que a empresa
-- JÁ resolveu esse problema à mão: existem duas categorias contábeis,
-- "Hospedagem (Capital)" e "Hospedagem (Interior)", com o MESMO código
-- contábil (435) — ou seja, a distinção não é contábil, é de referência de
-- preço. É exatamente a ideia de teto por contexto, feita na unha e só para
-- hospedagem. Então o vocabulário é o deles, não o meu.
--
-- ── O QUE ESTAVA MORTO E PASSA A SER LIDO ─────────────────────────────────
-- `crm_viagem_categorias.limite_alerta` existe, está preenchido (Alimentação
-- 40, Combustível 250, Hospedagem 350, Transporte 80) e NENHUMA tela lê — foi
-- conferido por grep em todo o src/. Era o mesmo teto linear que o Daniel
-- reclama do Zoho, só que sem nem alertar. Ele vira duas colunas e passa a
-- valer NAS CATEGORIAS QUE CONTINUAM ATIVAS (na prática, Combustível 250); a
-- coluna antiga fica como está, sem uso, para não perder o valor original de
-- quem quiser conferir (ver comentário nela).
--
-- ── NÃO INVENTEI NENHUM VALOR DE REFERÊNCIA ───────────────────────────────
-- Os tetos reais da empresa NÃO estão nas categorias do Zoho: as 52 têm
-- `maximum_allowed_amount = 0`. Eles vivem numa política "custom" que a API
-- não expõe — conferido nos relatórios reais, onde
-- `amount_policy_violation_count` é 0 e todas as violações são `custom`.
-- Então as categorias novas nascem SEM referência, e categoria sem referência
-- não alerta nada. A tela diz quantas estão sem, em vez de fingir que está
-- configurado. Quem sabe a política preenche em 5 minutos no editor que já
-- existe.
--
-- ── CATEGORIAS ────────────────────────────────────────────────────────────
-- As 6 genéricas de antes ("Alimentação", "Transporte"…) ficam INATIVAS, não
-- apagadas: `categoria` é gravada como TEXTO na despesa, então apagar deixaria
-- despesa órfã de rótulo. Inativa some do seletor e continua legível no
-- histórico.
--
-- As novas são o subconjunto do Zoho que um vendedor em campo usa, com o
-- código contábil (gl_code) e o id do Zoho junto — é o que vai permitir mandar
-- a despesa pra lá sem adivinhar a categoria depois. Quem achar que sobrou ou
-- faltou alguma ativa/desativa na tela de categorias, sem migration.

-- ── 1. Referência por contexto ────────────────────────────────────────────

alter table public.crm_viagem_categorias
  add column if not exists referencia_capital  numeric,
  add column if not exists referencia_interior numeric,
  add column if not exists gl_code             text,
  add column if not exists zoho_category_id    text;

comment on column public.crm_viagem_categorias.referencia_capital is
  'Valor de referência em centro urbano. NULO = categoria não gera alerta nenhum (Pedágio, por exemplo, não tem referência que faça sentido).';
comment on column public.crm_viagem_categorias.referencia_interior is
  'Valor de referência em estrada/interior, onde o mesmo item custa mais e o vendedor não tem alternativa. NULO = sem alerta.';
comment on column public.crm_viagem_categorias.limite_alerta is
  'OBSOLETA desde 14/09/2026. Era um teto linear único e nenhuma tela lia. Substituída por referencia_capital/referencia_interior. Mantida só para conferência do valor antigo; não ler em código novo.';
comment on column public.crm_viagem_categorias.zoho_category_id is
  'category_id da categoria correspondente no Zoho Expense (org 881366952). É o que permite enviar a despesa pra lá sem re-adivinhar a categoria.';

-- ── 2. O contexto na despesa ──────────────────────────────────────────────

alter table public.crm_viagem_despesas
  add column if not exists contexto text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.crm_viagem_despesas'::regclass
      and conname = 'crm_viagem_despesas_contexto_check'
  ) then
    alter table public.crm_viagem_despesas
      add constraint crm_viagem_despesas_contexto_check
      check (contexto is null or contexto in ('capital', 'interior'));
  end if;
end $$;

comment on column public.crm_viagem_despesas.contexto is
  'Onde o gasto aconteceu: "capital" (centro urbano) ou "interior" (estrada/rodovia). PERGUNTADO ao vendedor, nunca inferido do destino — decidido com o Daniel 14/09/2026: inferir erra em silêncio, e aqui o erro vira conversa sobre dinheiro. Nulo nas despesas anteriores a esta data; sem contexto, a tela compara com a referência de Capital (a mais apertada) e diz qual usou.';

-- ── 3. Categorias: as genéricas saem do seletor ───────────────────────────

-- "Combustível" e "Pedágio" NÃO entram aqui: existem com o mesmo nome no
-- Zoho, então em vez de sair do seletor elas só ganham o vínculo (passo 5).
update public.crm_viagem_categorias
   set ativo = false
 where nome in ('Alimentação', 'Transporte', 'Hospedagem', 'Outros')
   and zoho_category_id is null;

-- Só DEPOIS de desativar é que o valor antigo é carregado como referência de
-- Capital — e por isso ele só alcança categoria que continua ativa
-- (Combustível 250; Pedágio é nulo). A ordem importa: carregar antes fazia as
-- referências de Alimentação/Hospedagem/Transporte nascerem e sumirem na
-- mesma migration, porque o hook lê `.eq("ativo", true)`
-- (use-crm-viagem-categorias.js:15). O valor histórico das desativadas
-- continua em `limite_alerta`, legível pra quem quiser conferir.
--
-- `limite_alerta` é NUMERIC (baseline.sql:308) — sem replace(), sem regex: a
-- versão anterior tratava a coluna como texto e abortava a migration inteira
-- no primeiro UPDATE (achado da revisão de segurança, 14/09/2026).
--
-- DECISÃO EM ABERTO, deliberadamente não tomada aqui: "Hospedagem" tinha 350,
-- e nasce dividida em "Hospedagem (Capital)"/"(Interior)" SEM referência. Se o
-- 350 deve semear uma das duas (ou as duas) é decisão do Daniel — semear na
-- unha seria transformar um teto linear no teto dos dois contextos, que é
-- exatamente o que esta entrega existe pra parar de fazer.
update public.crm_viagem_categorias
   set referencia_capital = limite_alerta
 where limite_alerta is not null
   and referencia_capital is null
   and ativo;

-- ── 4. Categorias do Zoho usadas pelo comercial ───────────────────────────
-- Idempotente por `nome`. Sem referência de propósito (ver cabeçalho).

insert into public.crm_viagem_categorias (nome, ativo, gl_code, zoho_category_id)
select v.nome, true, v.gl_code, v.zoho_id
from (values
  ('Café da manhã',             '430', '6133455000000094451'),
  ('Café da manhã c/ cliente',  '430', '6133455000000094460'),
  ('Almoço',                    '430', '6133455000000094143'),
  ('Almoço c/ cliente',         '430', '6133455000000094413'),
  ('Jantar',                    '430', '6133455000000094478'),
  ('Jantar c/ cliente',         '430', '6133455000000094487'),
  ('Hospedagem (Capital)',      '435', '6133455000000094119'),
  ('Hospedagem (Interior)',     '435', '6133455000000032023'),
  ('Combustível',               '433', '6133455000000091159'),
  ('Pedágio',                   '432', '6133455000000094511'),
  ('Estacionamento',            '432', '6133455000000091204'),
  ('Conduções',                 '434', '6133455000000000424'),
  ('Passagem aérea',            '431', '6133455000000000418'),
  ('Locação de auto',           '495', '6133455000000094495'),
  ('Manutenção de auto',        '472', '6133455000000094503'),
  ('Amostra grátis',            '301', '6133455000000094421'),
  ('Brindes e presentes',       '303', '6133455000000094443'),
  ('Feiras e Convenções',       '306', '6133455000000240075'),
  ('Correios',                  '418', '6133455000000094470'),
  ('Telefone Celular',          '416', '6133455000000240131'),
  ('Outras despesas',           '500', '6133455000000000460')
) as v(nome, gl_code, zoho_id)
where not exists (
  select 1 from public.crm_viagem_categorias c where c.nome = v.nome
);

-- Categoria que já existia com o mesmo nome do Zoho (Combustível, Pedágio)
-- ganha o vínculo em vez de virar duplicata — o `not exists` acima pulou as
-- duas justamente por já existirem.
update public.crm_viagem_categorias c
   set gl_code = v.gl_code,
       zoho_category_id = v.zoho_id
from (values
  ('Combustível', '433', '6133455000000091159'),
  ('Pedágio',     '432', '6133455000000094511')
) as v(nome, gl_code, zoho_id)
where c.nome = v.nome and c.zoho_category_id is null;
