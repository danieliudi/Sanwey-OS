-- Menor da auditoria: activities_insert só checava "está autenticado" — sem
-- escopo de lead/empresa e sem restringir performed_by, um autenticado
-- conseguia inserir uma atividade forjada (performed_by de outra pessoa)
-- pra qualquer lead, inclusive de outra empresa. A tabela está órfã hoje
-- (0 linhas, 0 leitores no frontend — o timeline real vive em leads.activities
-- jsonb), mas a edge function agent-gateway grava nela (via service_role,
-- que ignora RLS de qualquer forma), então não é código morto o bastante
-- pra derrubar a tabela. Alinha o INSERT ao mesmo escopo já usado em
-- activities_select.
DROP POLICY IF EXISTS activities_insert ON public.activities;
CREATE POLICY activities_insert
  ON public.activities
  FOR INSERT
  WITH CHECK (
    (performed_by IS NULL OR performed_by = (SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM leads l
      WHERE l.id = activities.lead_id
        AND (
          current_user_role() = ANY (ARRAY['admin', 'gerente'])
          OR (
            current_user_role() = 'vendedor'
            AND l.company_id = ANY (current_user_companies())
            AND (l.owner IS NULL OR l.owner = (SELECT auth.uid())::text)
          )
        )
    )
  );
