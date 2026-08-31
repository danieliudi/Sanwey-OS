-- SEC-A2 (ALTO): policies de Storage de deliverable-attachments e
-- marketing-attachments checavam só role='agencia', descartando o escopo
-- por fornecedor (agencia_sees_supplier) que as TABELAS-pai já aplicam.
-- Qualquer conta agencia enxergava/gravava/apagava blobs de TODOS os
-- fornecedores. Corrigido delegando via EXISTS na tabela-pai — mesmo
-- padrão já correto usado em lead-attachments.

-- deliverable-attachments ------------------------------------------------
DROP POLICY IF EXISTS "Deliverable attachments read" ON storage.objects;
CREATE POLICY "Deliverable attachments read" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'deliverable-attachments'
  AND (
    current_user_is_marketing()
    OR EXISTS (
      SELECT 1 FROM public.marketing_deliverable_attachments a
      WHERE a.file_path = objects.name
    )
  )
);

DROP POLICY IF EXISTS "Deliverable attachments insert" ON storage.objects;
CREATE POLICY "Deliverable attachments insert" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'deliverable-attachments'
  AND (
    current_user_is_marketing()
    OR EXISTS (
      SELECT 1 FROM public.marketing_deliverables md
      WHERE md.id::text = (storage.foldername(objects.name))[1]
    )
  )
);

DROP POLICY IF EXISTS "Deliverable attachments delete" ON storage.objects;
CREATE POLICY "Deliverable attachments delete" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'deliverable-attachments'
  AND (
    current_user_is_marketing()
    OR EXISTS (
      SELECT 1 FROM public.marketing_deliverable_attachments a
      WHERE a.file_path = objects.name
    )
  )
);

-- marketing-attachments ---------------------------------------------------
DROP POLICY IF EXISTS mca_storage_read ON storage.objects;
CREATE POLICY mca_storage_read ON storage.objects
FOR SELECT
USING (
  bucket_id = 'marketing-attachments'
  AND (
    current_user_is_marketing()
    OR EXISTS (
      SELECT 1 FROM public.marketing_campaign_attachments a
      WHERE a.file_path = objects.name
    )
  )
);

DROP POLICY IF EXISTS mca_storage_insert ON storage.objects;
CREATE POLICY mca_storage_insert ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'marketing-attachments'
  AND (
    current_user_is_marketing()
    OR EXISTS (
      SELECT 1 FROM public.marketing_campaigns mc
      WHERE mc.id::text = (storage.foldername(objects.name))[1]
    )
  )
);

DROP POLICY IF EXISTS mca_storage_delete ON storage.objects;
CREATE POLICY mca_storage_delete ON storage.objects
FOR DELETE
USING (
  bucket_id = 'marketing-attachments'
  AND (
    current_user_is_marketing()
    OR EXISTS (
      SELECT 1 FROM public.marketing_campaign_attachments a
      WHERE a.file_path = objects.name
    )
  )
);
