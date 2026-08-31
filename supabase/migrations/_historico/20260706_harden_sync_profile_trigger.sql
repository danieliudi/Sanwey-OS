-- sync_profile_to_colaborador() é só um handler de trigger (AFTER INSERT ON
-- profiles) — nunca deveria ter sido chamável via RPC. O linter de segurança
-- apontou que anon/authenticated ganharam EXECUTE por padrão (mesmo motivo do
-- fix em rh_submit_self_rating). Revoga de todo mundo — o trigger continua
-- funcionando normalmente, já que dispara com o privilégio do dono da tabela.
REVOKE ALL ON FUNCTION public.sync_profile_to_colaborador() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_profile_to_colaborador() FROM anon;
REVOKE ALL ON FUNCTION public.sync_profile_to_colaborador() FROM authenticated;
