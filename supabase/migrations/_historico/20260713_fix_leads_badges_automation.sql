-- Furo da auditoria: a ação add_badge grava um patch { _badges: [...] }, mas
-- leads não tem coluna badges/_badges nenhuma — o update falha (silenciado
-- por um .catch(() => {}) em App.jsx) e a automação "Badge VIP · valor ≥
-- R$50k" (ativa em produção) nunca produz efeito visível nenhum. Adiciona a
-- coluna real que falta.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS badges jsonb NOT NULL DEFAULT '[]'::jsonb;
