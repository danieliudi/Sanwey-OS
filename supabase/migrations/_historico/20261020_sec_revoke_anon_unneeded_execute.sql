-- BX-01 da auditoria de segurança (19/08/2026): 52 (hoje 64 — a diferença é
-- em boa parte fruto das correções desta mesma sessão, ver MD-03/MD-06/MD-07)
-- funções SECURITY DEFINER com EXECUTE concedido a `anon` via
-- ALTER DEFAULT PRIVILEGES do projeto. A auditoria já verificou uma a uma:
-- nenhuma é explorável hoje (as sensíveis têm guarda interna, o resto são
-- funções de trigger que falham se chamadas direto) — isto é higiene de
-- superfície (menos GRANT amplo desnecessário), não correção de furo ativo.
--
-- Revoga só as 26 funções que NÃO precisam de `anon` de verdade — as duas
-- categorias abaixo. NÃO toca nos helpers current_user_*/chat_is_* (regra
-- 20261020_sec_storage_policy_anon_function_grants.sql e irmãs): esses
-- precisam de EXECUTE pra anon pra que as policies de Storage funcionem de
-- forma confiável (Postgres não garante ordem de avaliação AND/OR — ver
-- comentário nessas migrations). Também não toca nos formulários públicos
-- legítimos (submit_*, get_vaga_publica, get_marketing_request_number etc.)
-- — esses precisam de anon por desenho.

-- Grupo 1 — funções de TRIGGER: falham se chamadas fora do contexto de
-- trigger (retornam `trigger`), então o GRANT amplo nunca foi explorável,
-- mas também nunca foi necessário.
REVOKE EXECUTE ON FUNCTION public.chat_sync_channel_membership() FROM anon;
REVOKE EXECUTE ON FUNCTION public.chat_touch_channel() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_margin_rule() FROM anon;
REVOKE EXECUTE ON FUNCTION public.esg_emission_factors_guard_update() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_rh_stage_change() FROM anon;
REVOKE EXECUTE ON FUNCTION public.marketing_deliverables_assign_protocol_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.marketing_deliverables_release_protocol_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.marketing_deliverables_sync_protocol_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.marketing_requests_assign_protocol_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.marketing_requests_release_protocol_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.marketing_requests_sync_protocol_number() FROM anon;
REVOKE EXECUTE ON FUNCTION public.orders_guard_stage_change() FROM anon;
REVOKE EXECUTE ON FUNCTION public.products_enforce_field_ownership() FROM anon;
REVOKE EXECUTE ON FUNCTION public.profile_secrets_ensure_row() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_vaga_approved_at() FROM anon;

-- Grupo 2 — ações autenticadas de verdade (já guardadas internamente com
-- `IF v_uid IS NULL THEN RAISE EXCEPTION` + checagem de cargo/gestor, ver
-- spot-check em approve_purchase_request/chat_create_channel) que anon
-- nunca deveria legitimamente chamar, mais 2 leituras sem guarda nenhuma
-- que também não têm uso por anon: get_my_colaborador (filtra por
-- profile_id = auth.uid(), que é NULL pra anon — já devolvia vazio, mas
-- não precisa do GRANT) e get_purchase_request_number (zero referência em
-- todo o código — nem público nem autenticado a chama).
REVOKE EXECUTE ON FUNCTION public.approve_marketing_request_as_purchase(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.approve_marketing_request_as_task(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.approve_purchase_request(uuid, uuid, uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.approve_rh_data_update_request(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.approve_rh_movimentacao(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_rh_data_update_request(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_rh_movimentacao(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.chat_create_channel(text, text, text, uuid[], boolean, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.chat_count_profiles_matching_filter(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_colaborador() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_purchase_request_number(uuid) FROM anon;
