-- Pedido do Daniel: formulário público "Solicitar ao Marketing" precisa
-- capturar orçamento (quando o solicitante já tem um) e quem precisa
-- aprovar internamente antes da entrega — hoje isso só era descoberto
-- depois, no meio da conversa. marketing_requests não tem coluna livre
-- (jsonb) pra guardar isso, então são colunas novas de verdade — mudança
-- de schema confirmada explicitamente com o Daniel antes de aplicar.
-- Ambas opcionais (nem toda solicitação tem orçamento definido ou exige
-- aprovador formal além da própria equipe de Marketing).
ALTER TABLE public.marketing_requests
  ADD COLUMN IF NOT EXISTS budget        numeric,
  ADD COLUMN IF NOT EXISTS approver_name text;
