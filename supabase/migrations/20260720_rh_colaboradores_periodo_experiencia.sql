-- Período de experiência configurável por colaborador — antes,
-- periodoExperienciaInfo() (src/utils/rh-compliance-dates.js) assumia o
-- ciclo padrão CLT (45+45 dias) fixo, sem jeito de RH informar um valor
-- diferente no momento da contratação. Nulo mantém o comportamento antigo
-- (fallback pro cálculo 45/90 fixo, ver periodoExperienciaInfo).
ALTER TABLE public.rh_colaboradores
  ADD COLUMN IF NOT EXISTS periodo_experiencia_dias integer;
