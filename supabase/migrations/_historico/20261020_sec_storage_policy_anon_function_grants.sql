-- Achado descoberto testando o fix de MD-03 (simulação de RLS antes de
-- reportar como pronto — achou isso ANTES de chegar em produção): o
-- Postgres NÃO garante ordem de avaliação esquerda-pra-direita em AND/OR
-- (documentado: "the order of evaluation of subexpressions is not
-- defined"). Várias policies de storage.objects escritas como
-- `bucket_id = 'x' AND (...chama current_user_companies()/
-- current_user_is_admin()/agencia_sees_supplier()...)` assumiam que o
-- bucket_id errado bloquearia a chamada da função antes de ela rodar — não
-- é garantido. Resultado: QUALQUER insert de `anon` em storage.objects,
-- mesmo num bucket totalmente diferente (ex.: rh-curriculos), podia estourar
-- "permission denied for function" dependendo de como o planner decidisse
-- avaliar a expressão combinada — falha não-determinística, nunca
-- reproduzida antes só por sorte de plano.
--
-- Fix real: as 3 funções que essas policies chamam e que ainda faltava
-- anon ter EXECUTE (current_user_is_marketing/current_user_has_role já
-- tinham) são seguras de chamar como anon — todas leem
-- `... WHERE id = auth.uid()`, que pra anon é NULL, sempre devolvendo
-- vazio/falso. Conceder EXECUTE não abre nenhuma capacidade nova, só
-- remove a fragilidade de depender de ordem de avaliação não garantida.
GRANT EXECUTE ON FUNCTION public.current_user_companies() TO anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.agencia_sees_supplier(uuid) TO anon;
