-- Achado da auditoria (marketing-attachments): existem DUAS policies
-- redundantes por operação no bucket (mca_storage_* e mkt_attach_*), com o
-- mesmo escopo lógico (current_user_is_marketing() OR role='agencia' pra
-- leitura/insert; só marketing pra delete) — cruft de migrações antigas
-- duplicadas, não um alargamento real de acesso (RLS já faz OR entre
-- policies da mesma operação).
--
-- Agência ler todo anexo de campanha de marketing (sem escopo por
-- request/empresa) é o MESMO modelo já usado em marketing_campaigns.mc_read
-- e marketing_campaign_attachments.mca_read (tabelas-base do bucket) —
-- aparenta ser intencional (colaborador externo vendo os criativos das
-- campanhas em que trabalha), então não é restringido aqui. O achado real é
-- a duplicação: remove o segundo conjunto (mkt_attach_*), mantendo só
-- mca_storage_* como fonte única de verdade pro bucket.
DROP POLICY IF EXISTS mkt_attach_select ON storage.objects;
DROP POLICY IF EXISTS mkt_attach_insert ON storage.objects;
DROP POLICY IF EXISTS mkt_attach_delete ON storage.objects;
