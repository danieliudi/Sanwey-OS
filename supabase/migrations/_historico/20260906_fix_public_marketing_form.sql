-- CORREÇÃO: formulário público de solicitação ao Marketing quebrado pra
-- visitante anônimo (reportado pela Tatiane 11/08/2026).
-- (Aplicado em produção via MCP; arquivado aqui pro histórico acompanhar.)
--
-- Causa raiz: as políticas internas (`..._write`, `..._insert_internal`) foram
-- criadas sem restringir o papel, então valiam também pro `anon`. O predicado
-- delas chama current_user_is_admin()/current_user_is_marketing(), que uma
-- rodada anterior de endurecimento REVOGOU do anon.
--
-- O Postgres avalia TODA política permissiva aplicável ao comando: ao inserir
-- como anônimo ele tentava avaliar a política interna, batia em
-- "permission denied for function current_user_is_admin" e abortava a inserção
-- inteira. A política pública dedicada nunca chegava a ser considerada.
--
-- Nenhuma permissão nova é concedida — o público segue limitado ao que
-- `..._public_insert` já permitia.
alter policy marketing_requests_write on public.marketing_requests to authenticated;
alter policy marketing_requests_read  on public.marketing_requests to authenticated;

alter policy marketing_purchase_requests_insert_internal on public.marketing_purchase_requests to authenticated;
alter policy marketing_purchase_requests_read            on public.marketing_purchase_requests to authenticated;
alter policy marketing_purchase_requests_update          on public.marketing_purchase_requests to authenticated;
alter policy marketing_purchase_requests_delete          on public.marketing_purchase_requests to authenticated;
