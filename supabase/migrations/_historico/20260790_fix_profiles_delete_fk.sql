-- Corrige exclusão de usuário travada silenciosamente: 10 FKs pra
-- public.profiles(id) foram criadas sem ON DELETE (default NO ACTION), o
-- que bloqueia o DELETE FROM profiles feito pela edge function
-- delete-user. O erro era descartado (bug corrigido em
-- supabase/functions/delete-user/index.ts na mesma rodada), e a função
-- seguia deletando a conta em auth.users mesmo assim — usuário ficava sem
-- login mas com o profile intacto, reaparecendo na lista pra sempre.
--
-- ON DELETE SET NULL é consistente com o padrão já usado em toda coluna
-- created_by/aprovado_por/changed_by equivalente na plataforma (ver
-- 20260609_marketing_module.sql, 20260613_rh_module.sql etc.) — preserva o
-- registro histórico (contrato, cadastro, benefício) e só desvincula o
-- autor removido.

ALTER TABLE public.rh_stage_history
  DROP CONSTRAINT IF EXISTS rh_stage_history_changed_by_fkey,
  ADD CONSTRAINT rh_stage_history_changed_by_fkey
    FOREIGN KEY (changed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.rh_fornecedores
  DROP CONSTRAINT IF EXISTS rh_fornecedores_created_by_fkey,
  ADD CONSTRAINT rh_fornecedores_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.rh_fornecedor_contratos
  DROP CONSTRAINT IF EXISTS rh_fornecedor_contratos_created_by_fkey,
  ADD CONSTRAINT rh_fornecedor_contratos_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.rh_fornecedor_contrato_eventos
  DROP CONSTRAINT IF EXISTS rh_fornecedor_contrato_eventos_created_by_fkey,
  ADD CONSTRAINT rh_fornecedor_contrato_eventos_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.rh_beneficios_catalogo
  DROP CONSTRAINT IF EXISTS rh_beneficios_catalogo_created_by_fkey,
  ADD CONSTRAINT rh_beneficios_catalogo_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.rh_colaborador_beneficios
  DROP CONSTRAINT IF EXISTS rh_colaborador_beneficios_aprovado_por_fkey,
  ADD CONSTRAINT rh_colaborador_beneficios_aprovado_por_fkey
    FOREIGN KEY (aprovado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.rh_signature_requests
  DROP CONSTRAINT IF EXISTS rh_signature_requests_created_by_fkey,
  ADD CONSTRAINT rh_signature_requests_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.rh_vaga_manager_links
  DROP CONSTRAINT IF EXISTS rh_vaga_manager_links_created_by_fkey,
  ADD CONSTRAINT rh_vaga_manager_links_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.profile_module_overrides
  DROP CONSTRAINT IF EXISTS profile_module_overrides_created_by_fkey,
  ADD CONSTRAINT profile_module_overrides_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.rh_report_presets
  DROP CONSTRAINT IF EXISTS rh_report_presets_created_by_fkey,
  ADD CONSTRAINT rh_report_presets_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
