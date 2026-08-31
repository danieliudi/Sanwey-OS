-- Datas de conformidade em rh_colaboradores, pra alimentar lembretes de RH:
-- vencimento de ASO/exame periódico (NR-7), fim de contrato (temporário) e
-- data de desligamento (pra estimar aviso-prévio). Período de experiência
-- CLT (45+45 dias) não precisa de coluna nova — já dá pra calcular a partir
-- de admission_date + contract_type='clt'.
ALTER TABLE public.rh_colaboradores
  ADD COLUMN IF NOT EXISTS aso_vencimento date,
  ADD COLUMN IF NOT EXISTS contrato_fim date,
  ADD COLUMN IF NOT EXISTS desligamento_date date;
