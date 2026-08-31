-- Crítico novo da auditoria: as 3 policies do bucket de Storage
-- lead-attachments só checavam bucket_id = 'lead-attachments' — qualquer
-- usuário autenticado (de qualquer empresa, inclusive agencia) conseguia
-- ler, enumerar e apagar anexos de leads de qualquer empresa via API de
-- Storage direta, mesmo a tabela lead_attachments (metadados) já tendo RLS
-- correta por empresa/dono. Reescreve as 3 policies pra exigir que exista
-- uma linha visível (respeitando a RLS de lead_attachments/leads da própria
-- sessão) apontando pro mesmo caminho.
--
-- Path convention (use-lead-attachments.js): `${leadId}/${timestamp}-${rand}.ext`.
-- No INSERT o registro em lead_attachments ainda não existe (o upload no
-- Storage acontece antes do insert na tabela), por isso o check de upload
-- junta direto com leads via o primeiro segmento do caminho.
DROP POLICY IF EXISTS "authenticated can read lead attachments" ON storage.objects;
CREATE POLICY "authenticated can read lead attachments"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'lead-attachments'
    AND EXISTS (SELECT 1 FROM public.lead_attachments la WHERE la.file_path = storage.objects.name)
  );

DROP POLICY IF EXISTS "authenticated can upload lead attachments" ON storage.objects;
CREATE POLICY "authenticated can upload lead attachments"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'lead-attachments'
    AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id::text = (storage.foldername(storage.objects.name))[1]
    )
  );

DROP POLICY IF EXISTS "authenticated can delete own attachments" ON storage.objects;
CREATE POLICY "authenticated can delete own attachments"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'lead-attachments'
    AND EXISTS (SELECT 1 FROM public.lead_attachments la WHERE la.file_path = storage.objects.name)
  );

-- Bônus direto relacionado: lead_attachments (metadados) tinha o mesmo furo
-- que leads_select/leads_update tinham antes desta auditoria — nenhum ramo
-- para a role consultor, que ficava sem conseguir ver/anexar/apagar arquivo
-- algum nos próprios leads.
DROP POLICY IF EXISTS attachments_select ON public.lead_attachments;
CREATE POLICY attachments_select
  ON public.lead_attachments
  FOR SELECT
  USING (
    current_user_is_admin()
    OR (current_user_role() = 'gerente' AND company_id = ANY (current_user_companies()))
    OR (
      current_user_role() = 'vendedor'
      AND company_id = ANY (current_user_companies())
      AND EXISTS (
        SELECT 1 FROM leads l
        WHERE l.id = lead_attachments.lead_id
          AND (l.owner IS NULL OR l.owner = (SELECT auth.uid())::text OR l.owner = ANY (current_user_subordinate_ids()))
      )
    )
    OR (
      current_user_role() = 'consultor'
      AND company_id = ANY (current_user_companies())
      AND EXISTS (
        SELECT 1 FROM leads l
        WHERE l.id = lead_attachments.lead_id AND l.owner = (SELECT auth.uid())::text
      )
    )
  );

DROP POLICY IF EXISTS attachments_insert ON public.lead_attachments;
CREATE POLICY attachments_insert
  ON public.lead_attachments
  FOR INSERT
  WITH CHECK (
    current_user_is_admin()
    OR (current_user_role() = 'gerente' AND company_id = ANY (current_user_companies()))
    OR (
      current_user_role() = 'vendedor'
      AND company_id = ANY (current_user_companies())
      AND EXISTS (
        SELECT 1 FROM leads l
        WHERE l.id = lead_attachments.lead_id
          AND (l.owner IS NULL OR l.owner = (SELECT auth.uid())::text OR l.owner = ANY (current_user_subordinate_ids()))
      )
    )
    OR (
      current_user_role() = 'consultor'
      AND company_id = ANY (current_user_companies())
      AND EXISTS (
        SELECT 1 FROM leads l
        WHERE l.id = lead_attachments.lead_id AND l.owner = (SELECT auth.uid())::text
      )
    )
  );

DROP POLICY IF EXISTS attachments_delete ON public.lead_attachments;
CREATE POLICY attachments_delete
  ON public.lead_attachments
  FOR DELETE
  USING (
    current_user_is_admin()
    OR (current_user_role() = 'gerente' AND company_id = ANY (current_user_companies()))
    OR (
      current_user_role() = 'vendedor'
      AND company_id = ANY (current_user_companies())
      AND EXISTS (
        SELECT 1 FROM leads l
        WHERE l.id = lead_attachments.lead_id
          AND (l.owner IS NULL OR l.owner = (SELECT auth.uid())::text OR l.owner = ANY (current_user_subordinate_ids()))
      )
    )
    OR (
      current_user_role() = 'consultor'
      AND company_id = ANY (current_user_companies())
      AND EXISTS (
        SELECT 1 FROM leads l
        WHERE l.id = lead_attachments.lead_id AND l.owner = (SELECT auth.uid())::text
      )
    )
  );
