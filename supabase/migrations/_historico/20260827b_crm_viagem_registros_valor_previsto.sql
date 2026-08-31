-- Fase 1 do pedido do gerente comercial (via Daniel, 05/08/2026): vendedor
-- declara quanto pretende gastar na visita, não só aonde vai e por quê —
-- alimenta o motor de divergência (ver computeViagemDivergencias,
-- src/utils/viagens.js) que cruza previsto × realizado automaticamente.
-- Aditiva, sem tocar dado existente — nenhuma linha antiga tem esse valor,
-- fica NULL (o motor de divergência já trata NULL como "sem previsão pra
-- comparar", não como estouro).

ALTER TABLE public.crm_viagem_registros
  ADD COLUMN IF NOT EXISTS valor_previsto numeric CHECK (valor_previsto IS NULL OR valor_previsto >= 0);
