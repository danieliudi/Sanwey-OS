-- validate_rh_stage() é um trigger de validação (BEFORE INSERT/UPDATE) e
-- nunca deveria ser chamável direto via RPC — mesmo tratamento já aplicado
-- aos outros triggers em 20260519_security_harden_functions.sql, que essa
-- função (criada depois) ficou de fora.
REVOKE EXECUTE ON FUNCTION public.validate_rh_stage() FROM PUBLIC, anon, authenticated;
