-- Migration: add_client_classification
-- Adiciona classificação de maturidade de relacionamento (ABCD) na tabela leads
-- Execute via Supabase Dashboard > SQL Editor ou CLI: supabase db push

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS client_classification TEXT
    CHECK (client_classification IN ('D', 'C', 'B', 'A', 'X')),
  ADD COLUMN IF NOT EXISTS order_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_leads_client_classification
  ON public.leads (client_classification);

COMMENT ON COLUMN public.leads.client_classification IS
  'D=Desenvolvimento novo, C=Visita/Contato, B=Projeto concluído/orçamento, A=Pedidos colocados, X=Inativo';

COMMENT ON COLUMN public.leads.order_count IS
  'Quantidade de pedidos — preenchido apenas quando client_classification = A (ex: A-3)';
