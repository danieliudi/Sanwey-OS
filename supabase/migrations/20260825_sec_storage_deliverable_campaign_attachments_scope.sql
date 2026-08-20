-- Achado de 18/08/2026 (auditoria de outros conflitos de sobreposição visual
-- levou a inspecionar os anexos de Entregas/Campanhas pra planejar a
-- consolidação em rh_attachments — no caminho, achamos que as policies de
-- Storage dos buckets `deliverable-attachments` e `marketing-attachments`
-- tinham um `EXISTS (select 1 from <tabela> a where a.file_path =
-- objects.name)` sem NENHUM filtro pelo usuário atual: bastava a linha
-- existir na tabela (verdade pra quase todo arquivo legítimo) pra
-- `current_user_is_marketing() OR EXISTS(...)` dar true — ou seja, qualquer
-- usuário autenticado (não só marketing/agência) conseguia ler/excluir
-- qualquer anexo desses dois buckets. As policies das TABELAS
-- (marketing_deliverable_attachments / marketing_campaign_attachments) já
-- tinham o escopo certo (agencia_sees_supplier / company_ids &&
-- current_user_companies()) — o gap era só na camada de Storage, que nunca
-- espelhou esse predicado. INSERT tinha o mesmo problema: só checava que o
-- deliverable_id/campaign_id da pasta existia, não que o usuário tinha
-- direito a ele.
--
-- Corrigido derivando a permissão de Storage a partir do MESMO predicado já
-- em produção na tabela irmã (padrão da regra de segurança 3.1 do
-- CLAUDE.md): SELECT/DELETE fazem join em file_path até a linha real do
-- anexo (evita reimplementar a lógica de escopo); INSERT usa o primeiro
-- segmento do path (deliverable_id/campaign_id, formato já usado pelos
-- hooks `use-deliverable-attachments.js`/`use-marketing-campaign-attachments.js`)
-- pra achar o registro pai antes da linha do anexo existir.

-- ── deliverable-attachments ────────────────────────────────────────────────

drop policy if exists "Deliverable attachments read" on storage.objects;
create policy "Deliverable attachments read" on storage.objects for select
using (
  bucket_id = 'deliverable-attachments' and (
    current_user_is_marketing()
    or agencia_sees_supplier((
      select mc.supplier_id
      from public.marketing_deliverable_attachments a
      join public.marketing_deliverables md on md.id = a.deliverable_id
      join public.marketing_campaigns mc on mc.id = md.campaign_id
      where a.file_path = objects.name
    ))
  )
);

drop policy if exists "Deliverable attachments delete" on storage.objects;
create policy "Deliverable attachments delete" on storage.objects for delete
using (
  bucket_id = 'deliverable-attachments' and (
    current_user_is_marketing()
    or agencia_sees_supplier((
      select mc.supplier_id
      from public.marketing_deliverable_attachments a
      join public.marketing_deliverables md on md.id = a.deliverable_id
      join public.marketing_campaigns mc on mc.id = md.campaign_id
      where a.file_path = objects.name
    ))
  )
);

drop policy if exists "Deliverable attachments insert" on storage.objects;
create policy "Deliverable attachments insert" on storage.objects for insert
with check (
  bucket_id = 'deliverable-attachments' and (
    current_user_is_marketing()
    or agencia_sees_supplier((
      select mc.supplier_id
      from public.marketing_deliverables md
      join public.marketing_campaigns mc on mc.id = md.campaign_id
      where md.id::text = (storage.foldername(objects.name))[1]
    ))
  )
);

-- ── marketing-attachments (Campanhas) ──────────────────────────────────────

drop policy if exists mca_storage_read on storage.objects;
create policy mca_storage_read on storage.objects for select
using (
  bucket_id = 'marketing-attachments' and (
    current_user_is_admin()
    or (current_user_is_marketing() and exists (
      select 1 from public.marketing_campaign_attachments a
      where a.file_path = objects.name and a.company_ids && current_user_companies()
    ))
    or agencia_sees_supplier((
      select mc.supplier_id
      from public.marketing_campaign_attachments a
      join public.marketing_campaigns mc on mc.id = a.campaign_id
      where a.file_path = objects.name
    ))
  )
);

drop policy if exists mca_storage_delete on storage.objects;
create policy mca_storage_delete on storage.objects for delete
using (
  bucket_id = 'marketing-attachments' and (
    current_user_is_admin()
    or (current_user_is_marketing() and exists (
      select 1 from public.marketing_campaign_attachments a
      where a.file_path = objects.name and a.company_ids && current_user_companies()
    ))
    or agencia_sees_supplier((
      select mc.supplier_id
      from public.marketing_campaign_attachments a
      join public.marketing_campaigns mc on mc.id = a.campaign_id
      where a.file_path = objects.name
    ))
  )
);

drop policy if exists mca_storage_insert on storage.objects;
create policy mca_storage_insert on storage.objects for insert
with check (
  bucket_id = 'marketing-attachments' and (
    current_user_is_admin()
    or (current_user_is_marketing() and exists (
      select 1 from public.marketing_campaigns mc
      where mc.id::text = (storage.foldername(objects.name))[1] and mc.company_ids && current_user_companies()
    ))
    or agencia_sees_supplier((
      select mc.supplier_id from public.marketing_campaigns mc
      where mc.id::text = (storage.foldername(objects.name))[1]
    ))
  )
);
