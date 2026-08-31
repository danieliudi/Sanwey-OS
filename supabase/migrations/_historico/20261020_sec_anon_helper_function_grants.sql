-- Continuação do achado anterior (Postgres não garante ordem de avaliação
-- em AND/OR — qualquer policy escrita como "bucket_id = 'x' AND
-- chama_função()" pode acabar chamando a função mesmo quando bucket_id não
-- bate). Rodando a simulação de RLS do fix de MD-03 iteração a iteração,
-- foram aparecendo mais funções da mesma família current_user_* sem
-- EXECUTE pra anon, uma de cada vez — em vez de continuar destampando uma
-- por vez, levantamento completo: toda current_user_* ainda sem grant pra
-- anon, todas SECURITY DEFINER, todas resolvendo pra vazio/falso quando
-- auth.uid() é nulo (anon) — conceder EXECUTE não abre nenhuma capacidade
-- nova em nenhuma delas, só remove a fragilidade de depender de ordem de
-- avaliação não garantida em QUALQUER policy futura que as use perto de um
-- bucket_id/company_id guard.
GRANT EXECUTE ON FUNCTION public.current_user_can_manage_client(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_see_lead(text) TO anon;
GRANT EXECUTE ON FUNCTION public.current_user_client_companies() TO anon;
GRANT EXECUTE ON FUNCTION public.current_user_client_id() TO anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_manager() TO anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_marketing_manager() TO anon;
GRANT EXECUTE ON FUNCTION public.current_user_manages_commercial_tools() TO anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO anon;
GRANT EXECUTE ON FUNCTION public.current_user_sectors() TO anon;
GRANT EXECUTE ON FUNCTION public.current_user_subordinate_ids() TO anon;
