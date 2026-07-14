-- Importante da auditoria: rh_ferias_insert só exigia user_id=auth.uid() ou
-- RH, sem restringir as colunas status/approved_by/approved_at — um
-- colaborador conseguia inserir a própria solicitação já com
-- status='aprovado' e approved_by/approved_at preenchidos, se auto-aprovando
-- sem passar pelo RH (o UPDATE já era restrito a RH, mas o INSERT não).
DROP POLICY IF EXISTS rh_ferias_insert ON public.rh_ferias;
CREATE POLICY rh_ferias_insert
  ON public.rh_ferias
  FOR INSERT
  WITH CHECK (
    (
      user_id = (SELECT auth.uid())
      AND status = 'pendente'
      AND approved_by IS NULL
      AND approved_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = ANY (ARRAY['admin', 'gerente_rh', 'rh'])
    )
  );
