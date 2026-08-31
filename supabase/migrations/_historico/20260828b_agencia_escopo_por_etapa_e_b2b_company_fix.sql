-- Dois fechamentos da auditoria de 28/08/2026, confirmados com o Daniel:
--
-- 1) Papel `agencia` em marketing_deliverables (Entregas): a migration
--    "agência vê tudo" (20261020_deliverables_agencia_ve_tudo.sql) deu
--    visão de TODAS as entregas ao papel agencia (decisão do Daniel), mas
--    o ramo de ESCRITA (md_update) ficou sem nenhum filtro — hoje com só
--    1 login de agência (Beehave) o dano é baixo, mas sem escopo ela
--    tecnicamente edita/reatribui qualquer uma das 20 entregas das 3
--    frentes, não só as que são dela. Decisão nova do Daniel (28/08/2026):
--    a agência só deve poder mexer em entregas que estão nas etapas
--    "Encaminhado à Agência" (encaminhado_para_agencia) e "Em Produção"
--    (em_producao) — o resto (Solicitação, Revisão e Aprovação, Entregue,
--    Reprovados/Arquivados) é só do time interno. USING restringe QUAL
--    linha ela pode selecionar pra editar (etapa atual); WITH CHECK
--    restringe pra QUE etapa ela pode deixar a linha (não sai desse par
--    de etapas sozinha — avançar pra Revisão é ação do time interno).
--    Leitura (deliverables_select) continua sem mudança — "ver tudo"
--    segue sendo a decisão de sempre.
--
-- 2) orders_cliente_update (Portal B2B): o WITH CHECK do UPDATE confere
--    client_id/situacao/kronosys_numero/confirmed_by mas não company_id —
--    a policy irmã de INSERT já tem esse filtro
--    (20260920_pedidos_b2b_fix_cliente_cria_pedido.sql:39). Sem ele, um
--    cliente externo trocando company_id no UPDATE faria o próprio pedido
--    sumir da fila do time certo (ou aparecer no errado). Hoje 0 login
--    externo e 0 pedido — fechando antes do portal abrir.

drop policy if exists md_update on public.marketing_deliverables;
create policy md_update
  on public.marketing_deliverables
  for update
  using (
    current_user_is_admin()
    or (current_user_is_marketing() and company_ids && current_user_companies())
    or (current_user_roles() && array['agencia']::text[] and stage = any(array['encaminhado_para_agencia','em_producao']::text[]))
  )
  with check (
    current_user_is_admin()
    or (current_user_is_marketing() and company_ids && current_user_companies())
    or (current_user_roles() && array['agencia']::text[] and stage = any(array['encaminhado_para_agencia','em_producao']::text[]))
  );

drop policy if exists orders_cliente_update on public.orders;
create policy orders_cliente_update
  on public.orders
  for update
  using (
    client_id = current_user_client_id()
    and situacao = 'rascunho'
  )
  with check (
    client_id = current_user_client_id()
    and company_id = any (public.current_user_client_companies())
    and situacao = any (array['rascunho', 'enviado'])
    and kronosys_numero is null
    and confirmed_by is null
  );
