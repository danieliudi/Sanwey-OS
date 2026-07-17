-- Jovem Aprendiz (Áudio 6 do RH — Onda 1): datas dedicadas do contrato de
-- aprendizagem, separadas de contrato_fim (que é "fim de contrato temporário")
-- para não misturar os dois lembretes. Aditivo e nullable — herda a RLS
-- existente (rh_colaboradores_rh_access). contract_type='aprendiz' NÃO precisa
-- de migração: a coluna é text livre, sem CHECK constraint.
--
-- Já aplicada ao projeto vivo via MCP (apply_migration); este arquivo existe
-- para que um `supabase db reset` reproduza o mesmo schema.
ALTER TABLE public.rh_colaboradores
  ADD COLUMN IF NOT EXISTS aprendiz_inicio date,
  ADD COLUMN IF NOT EXISTS aprendiz_fim date;

COMMENT ON COLUMN public.rh_colaboradores.aprendiz_inicio IS 'Início do contrato de aprendizagem (jovem aprendiz)';
COMMENT ON COLUMN public.rh_colaboradores.aprendiz_fim IS 'Término previsto do contrato de aprendizagem — base do lembrete de reposição ~2 meses antes';
