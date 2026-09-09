-- Despesas (Viagens + Marketing): centro de custo comercial e cartão.
--
-- Origem: conversa Daniel × Everton 09/09/2026 + PDF "LISTA DE CENTROS DE
-- CUSTOS 2021". Só Matriz SP / bloco COMERCIAL (701, 702, 711, 721, 722).
-- Filial SC propositalmente fora. A lista canônica dos códigos vive no front
-- (`src/constants/cost-centers.js`); aqui só as colunas pra gravar a escolha.
--
-- NÃO aplica sozinha — aguarda confirmação do Daniel (regra 5).

ALTER TABLE public.crm_viagem_despesas
  ADD COLUMN IF NOT EXISTS centro_custo text,
  ADD COLUMN IF NOT EXISTS cartao text;

COMMENT ON COLUMN public.crm_viagem_despesas.centro_custo IS
  'Código do centro de custo comercial Matriz SP (701/702/711/721/722).';
COMMENT ON COLUMN public.crm_viagem_despesas.cartao IS
  'Cartão usado no gasto (visa | mastercard | outro).';

ALTER TABLE public.marketing_expenses
  ADD COLUMN IF NOT EXISTS centro_custo text,
  ADD COLUMN IF NOT EXISTS cartao text;

COMMENT ON COLUMN public.marketing_expenses.centro_custo IS
  'Código do centro de custo comercial Matriz SP (mesma lista de Viagens).';
COMMENT ON COLUMN public.marketing_expenses.cartao IS
  'Cartão usado no gasto (visa | mastercard | outro).';
