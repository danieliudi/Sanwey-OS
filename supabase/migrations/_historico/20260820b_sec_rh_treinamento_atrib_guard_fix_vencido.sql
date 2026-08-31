-- Correção da migration anterior: o board de Treinamentos reconcilia
-- "vencido" no CLIENTE (use-rh-treinamentos.js:76, roda quando QUALQUER
-- colaborador — não só RH — abre a tela e vê a própria atribuição
-- expirada, App.jsx:1485 confirma que Treinamentos é acessível a todo
-- colaborador). O WITH_CHECK anterior só liberava 'pendente'/'concluido'
-- pro self, o que quebraria essa reconciliação legítima. 'vencido' nunca
-- beneficia quem autoatesta (é um estado pior que concluído), então
-- liberar não reabre a fraude que a migration anterior fechou.
DROP POLICY IF EXISTS rh_treinamento_atrib_update ON public.rh_treinamento_atribuicoes;
CREATE POLICY rh_treinamento_atrib_update ON public.rh_treinamento_atribuicoes
FOR UPDATE
USING (
  is_own_colaborador(colaborador_id)
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = ANY (ARRAY['admin','gerente_rh','rh'])
  )
)
WITH CHECK (
  (
    is_own_colaborador(colaborador_id)
    AND status = ANY (ARRAY['pendente','concluido','vencido'])
    AND (data_conclusao IS NULL OR data_conclusao BETWEEN now() - interval '5 minutes' AND now() + interval '1 minute')
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = ANY (ARRAY['admin','gerente_rh','rh'])
  )
);
