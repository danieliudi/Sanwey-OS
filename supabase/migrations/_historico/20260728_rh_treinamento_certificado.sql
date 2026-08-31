-- Onda 2 (Áudio 4 do RH) — certificado de conclusão do treinamento NR.
-- Referência queryável (link do PDF, normalmente no Drive), separada do
-- link_conteudo (que é o material do treinamento, não o comprovante).
-- Complementa a aba "Anexos" do drawer (arquivo em si); este campo dá
-- visibilidade de conformidade ("concluído mas sem certificado em mãos").
-- Aditivo e nullable — herda a RLS existente do board de treinamentos.
--
-- Já aplicada ao projeto vivo via MCP (apply_migration); este arquivo existe
-- para que um `supabase db reset` reproduza o mesmo schema.
ALTER TABLE public.rh_treinamento_atribuicoes
  ADD COLUMN IF NOT EXISTS certificado_url text;

COMMENT ON COLUMN public.rh_treinamento_atribuicoes.certificado_url IS 'Link do certificado de conclusão (comprovante NR) — usado no relatório de conformidade e na projeção pré-auditoria';
