-- Achado da própria correção (20/08/2026): REVOKE ... FROM anon (aplicado
-- na migration anterior, 20261020_sec_revoke_anon_unneeded_execute.sql) não
-- remove o GRANT ... TO PUBLIC que 21 das 26 funções ainda carregavam
-- (herdado de quando foram criadas) — anon é implicitamente membro de
-- PUBLIC, então continuava com EXECUTE por essa via mesmo depois do REVOKE
-- direto. Confirmado que `authenticated` tem GRANT próprio (direto, não via
-- PUBLIC) em todas as 21 antes de revogar — uso normal da plataforma não é
-- afetado (verificado com has_function_privilege em transação de teste).
REVOKE EXECUTE ON FUNCTION public.chat_sync_channel_membership() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.chat_touch_channel() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_margin_rule() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.esg_emission_factors_guard_update() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_rh_stage_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.marketing_deliverables_assign_protocol_number() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.marketing_deliverables_release_protocol_number() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.marketing_deliverables_sync_protocol_number() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.marketing_requests_assign_protocol_number() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.marketing_requests_release_protocol_number() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.marketing_requests_sync_protocol_number() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.orders_guard_stage_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.products_enforce_field_ownership() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.profile_secrets_ensure_row() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_vaga_approved_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_marketing_request_as_purchase(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_marketing_request_as_task(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_purchase_request(uuid, uuid, uuid, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.chat_create_channel(text, text, text, uuid[], boolean, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.chat_count_profiles_matching_filter(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_colaborador() FROM PUBLIC;
