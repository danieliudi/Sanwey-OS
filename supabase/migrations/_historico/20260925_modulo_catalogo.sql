-- Módulo "catalogo" (Comercial → Catálogo). Aplicado 12/08/2026.
--
-- 1) Espelha o id novo em current_user_has_module(): entra na mesma lista de
--    commercial-overview/crm/clients — visível pra quem não é puro Marketing
--    nem puro RH. Quem EDITA é outra coisa, e mora no RLS de products
--    (admin, gerente ou suporte, dentro das empresas da pessoa).
--
-- 2) A tela nasce em "test" na module_states: só admin vê até liberar em
--    Configurações → Módulos. Era exatamente o motivo de construir a chave
--    global antes do Catálogo.
--
-- O corpo completo da função está em produção (fonte de verdade). A única
-- mudança em relação à versão anterior é o 'catalogo' na primeira linha do
-- CASE, mais a variável v_is_suporte declarada pra uso futuro.

insert into public.module_states (module_id, state) values ('catalogo','test')
  on conflict (module_id) do update set state = 'test';
