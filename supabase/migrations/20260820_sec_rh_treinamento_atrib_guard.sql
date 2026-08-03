-- SEC-A4: rh_treinamento_atrib_update tinha with_check=NULL — no UPDATE o
-- Postgres reusa o USING (is_own_colaborador OR RH), sem nenhuma trava de
-- coluna. Investigação de código mostrou que "autoatestar sem certificado"
-- é comportamento DESENHADO do board (RHTreinamentosView.jsx trata
-- "autodeclarado"/"sem certificado" como estado visível e auditável, não
-- como bug) — restringir UPDATE a RH quebraria o autoatendimento real.
-- O que a RLS pura ainda permitia e NÃO é intencional: o colaborador
-- setar `data_conclusao` arbitrária (backdatar/postdatar) via chamada
-- direta à API, fora do fluxo normal (que sempre usa now()). Trava isso
-- sem tocar no comportamento de autoatestação em si.
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
    AND status = ANY (ARRAY['pendente','concluido'])
    AND (data_conclusao IS NULL OR data_conclusao BETWEEN now() - interval '5 minutes' AND now() + interval '1 minute')
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = ANY (ARRAY['admin','gerente_rh','rh'])
  )
);
