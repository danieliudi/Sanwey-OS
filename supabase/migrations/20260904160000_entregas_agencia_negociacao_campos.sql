-- Feedback Beehave (04/09/2026) sobre Entregas de Marketing:
--
-- 1) SLA combinado e Brief validado eram obrigatórios em
--    "Encaminhado à Agência" e bloqueavam a movimentação antes da
--    negociação de prazo/prazo. Viram opcionais — preenchem quando
--    combinarem, sem travar o card.
--
-- 2) "Observações de triagem" (e os dois campos acima) sumiam ao
--    mover pra "Em Produção". O valor NÃO era apagado: mora em
--    custom_fields e a tela só renderiza campos da etapa atual. Ao
--    repetir o mesmo field_key em em_producao, o texto volta a
--    aparecer sem migration de dado.
--
-- Idempotente: UPDATE / INSERT só se ainda não existir a linha.

-- ── 1. Tirar obrigatoriedade na etapa da agência ──────────────────────────
UPDATE public.rh_pipeline_stage_fields
SET required = false
WHERE domain = 'marketing_deliverables'
  AND stage_key = 'encaminhado_para_agencia'
  AND field_key IN ('sla_combinado', 'brief_validado')
  AND required = true;

-- ── 2. Manter contexto visível em Em Produção (mesmos field_keys) ─────────
INSERT INTO public.rh_pipeline_stage_fields
  (domain, stage_key, field_key, label, field_type, required, help_text, order_idx, options)
SELECT
  'marketing_deliverables',
  'em_producao',
  v.field_key,
  v.label,
  v.field_type,
  false,
  v.help_text,
  v.order_idx,
  v.options::jsonb
FROM (VALUES
  ('observacoes_triagem', 'Observações de triagem',        'textarea', 'Pendências, dúvidas ou escopo acordados na triagem', -3, '[]'),
  ('sla_combinado',       'SLA combinado (data)',          'datetime', 'Prazo acordado com solicitante',                     -2, '[]'),
  ('brief_validado',      'Brief validado?',               'select',   '',                                                    -1, '["Sim","Não"]')
) AS v(field_key, label, field_type, help_text, order_idx, options)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.rh_pipeline_stage_fields f
  WHERE f.domain = 'marketing_deliverables'
    AND f.stage_key = 'em_producao'
    AND f.field_key = v.field_key
);
