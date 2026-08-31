-- Padronização 18/08/2026: preparação pra consolidar anexos de
-- Entregas/Campanhas (marketing_deliverable_attachments /
-- marketing_campaign_attachments, 2 tabelas + 2 buckets bespoke) no
-- rh_attachments genérico (domain+record_id), já usado por Tarefas de
-- Marketing, Compras e todo RH.
--
-- Esta migration só adiciona as policies novas (tabela + Storage) pros
-- domínios "marketing_deliverables"/"marketing_campaigns" — espelhando
-- exatamente o predicado já em produção nas tabelas antigas
-- (agencia_sees_supplier / company_ids && current_user_companies()), regra
-- 3.1 do CLAUDE.md. Não copia dado nenhum ainda — isso é um passo
-- separado, depois que os arquivos physicos forem movidos pro bucket novo.

-- ── tabela rh_attachments ───────────────────────────────────────────────────

create policy rh_attachments_marketing_deliverables_access on public.rh_attachments for all
using (
  domain = 'marketing_deliverables' and (
    current_user_is_marketing()
    or agencia_sees_supplier((
      select mc.supplier_id
      from public.marketing_deliverables md
      join public.marketing_campaigns mc on mc.id = md.campaign_id
      where md.id = rh_attachments.record_id
    ))
  )
)
with check (
  domain = 'marketing_deliverables' and (
    current_user_is_marketing()
    or agencia_sees_supplier((
      select mc.supplier_id
      from public.marketing_deliverables md
      join public.marketing_campaigns mc on mc.id = md.campaign_id
      where md.id = rh_attachments.record_id
    ))
  )
);

create policy rh_attachments_marketing_campaigns_access on public.rh_attachments for all
using (
  domain = 'marketing_campaigns' and (
    current_user_is_admin()
    or (current_user_is_marketing() and exists (
      select 1 from public.marketing_campaigns mc
      where mc.id = rh_attachments.record_id and mc.company_ids && current_user_companies()
    ))
    or agencia_sees_supplier((
      select mc.supplier_id from public.marketing_campaigns mc where mc.id = rh_attachments.record_id
    ))
  )
)
with check (
  domain = 'marketing_campaigns' and (
    current_user_is_admin()
    or (current_user_is_marketing() and exists (
      select 1 from public.marketing_campaigns mc
      where mc.id = rh_attachments.record_id and mc.company_ids && current_user_companies()
    ))
    or agencia_sees_supplier((
      select mc.supplier_id from public.marketing_campaigns mc where mc.id = rh_attachments.record_id
    ))
  )
);

-- ── bucket rh-attachments (Storage) ─────────────────────────────────────────

create policy rh_attachments_marketing_deliverables_storage on storage.objects for all
using (
  bucket_id = 'rh-attachments'
  and (storage.foldername(name))[1] = 'marketing_deliverables'
  and (
    current_user_is_marketing()
    or agencia_sees_supplier((
      select mc.supplier_id
      from public.marketing_deliverables md
      join public.marketing_campaigns mc on mc.id = md.campaign_id
      where md.id::text = (storage.foldername(name))[2]
    ))
  )
)
with check (
  bucket_id = 'rh-attachments'
  and (storage.foldername(name))[1] = 'marketing_deliverables'
  and (
    current_user_is_marketing()
    or agencia_sees_supplier((
      select mc.supplier_id
      from public.marketing_deliverables md
      join public.marketing_campaigns mc on mc.id = md.campaign_id
      where md.id::text = (storage.foldername(name))[2]
    ))
  )
);

create policy rh_attachments_marketing_campaigns_storage on storage.objects for all
using (
  bucket_id = 'rh-attachments'
  and (storage.foldername(name))[1] = 'marketing_campaigns'
  and (
    current_user_is_admin()
    or (current_user_is_marketing() and exists (
      select 1 from public.marketing_campaigns mc
      where mc.id::text = (storage.foldername(name))[2] and mc.company_ids && current_user_companies()
    ))
    or agencia_sees_supplier((
      select mc.supplier_id from public.marketing_campaigns mc where mc.id::text = (storage.foldername(name))[2]
    ))
  )
)
with check (
  bucket_id = 'rh-attachments'
  and (storage.foldername(name))[1] = 'marketing_campaigns'
  and (
    current_user_is_admin()
    or (current_user_is_marketing() and exists (
      select 1 from public.marketing_campaigns mc
      where mc.id::text = (storage.foldername(name))[2] and mc.company_ids && current_user_companies()
    ))
    or agencia_sees_supplier((
      select mc.supplier_id from public.marketing_campaigns mc where mc.id::text = (storage.foldername(name))[2]
    ))
  )
);
