-- Últimas 2 funções da varredura completa de todas as policies de
-- storage.objects (não só as que bateram no ILIKE anterior) — mesmo
-- racional dos dois fixes anteriores: SECURITY DEFINER, resolvem pra falso
-- quando auth.uid() é nulo (anon), conceder EXECUTE não abre capacidade
-- nova nenhuma.
GRANT EXECUTE ON FUNCTION public.chat_is_manager(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.chat_is_member(uuid) TO anon;
