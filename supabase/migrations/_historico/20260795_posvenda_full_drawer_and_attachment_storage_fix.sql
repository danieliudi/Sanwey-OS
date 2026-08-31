-- Pós-venda no padrão completo de drawer (aprovado pelo Daniel em 29/07/2026,
-- decisão 9 do documento de decisões) + correção de um bug adjacente
-- confirmado no banco (decisão 10).
--
-- PARTE A — Pós-venda passa a aceitar Histórico de etapa e Anexos, como os
-- outros 12 boards. Sem isto, as abas abrem, parecem certas e não gravam
-- nada, em silêncio — foi exatamente o que aconteceu com o Comex antes da
-- migration 20260791 (ver comentário lá).
--
-- PARTE B — a permissão de ESCRITA do bucket rh-attachments exigia cargo de
-- RH lido da coluna escalar legada `profiles.role`, e não da lista
-- `profiles.roles` que a plataforma passou a usar (FASE 1, migration
-- 20260714162510). Efeito medido no banco em 29/07/2026: dos 11 usuários,
-- só 3 passavam. Quando Marketing (20260782) e Comex (20260784) ganharam a
-- aba Anexos, a permissão foi acrescentada na TABELA rh_attachments mas
-- nunca no BUCKET — então anexar arquivo em Tarefas, Compras e Comex é
-- recusado pelo Storage. Nunca foi observado em produção porque
-- rh_attachments tem 0 linhas (o recurso nunca chegou a ser usado por
-- ninguém), mas a falha é determinística.
--
-- Checklists ficaram deliberadamente de fora (decisão 9): Pós-venda é
-- acompanhamento de cliente, não tarefa com lista fechada. Incluir depois
-- custa 2 linhas (CHECK + policy) se mudar de ideia.

-- ── PARTE A.1 — Histórico de etapa aceita 'posvenda' ──────────────────────

ALTER TABLE public.rh_stage_history
  DROP CONSTRAINT rh_stage_history_domain_check,
  ADD CONSTRAINT rh_stage_history_domain_check
    CHECK (domain = ANY (ARRAY[
      'vagas','candidatos','onboarding','feedback','ferias','treinamentos',
      'marketing','marketing_deliverables','marketing_tasks','marketing_purchase_requests',
      'comex','posvenda'
    ]));

-- Escopo por EXISTS na própria posvenda_cases, não por papel: a subquery
-- roda como o usuário chamador, então herda a RLS de dono/empresa que já
-- existe lá (posvenda_cases_select, migration 20260770) sem duplicar aquela
-- lógica aqui. Mesmo padrão de 20260713_fix_lead_attachments_storage_scope.
CREATE POLICY rh_stage_history_posvenda_access ON public.rh_stage_history
  FOR ALL
  USING (
    domain = 'posvenda'
    AND EXISTS (SELECT 1 FROM public.posvenda_cases pc WHERE pc.id = rh_stage_history.record_id)
  )
  WITH CHECK (
    domain = 'posvenda'
    AND EXISTS (SELECT 1 FROM public.posvenda_cases pc WHERE pc.id = rh_stage_history.record_id)
  );

-- Sem o trigger nada é gravado, mesmo com o CHECK aberto. A função genérica
-- já existe desde 20260715 — aqui só ligamos mais um domínio nela.
CREATE TRIGGER trg_log_posvenda_stage_change
  AFTER INSERT OR UPDATE ON public.posvenda_cases
  FOR EACH ROW EXECUTE FUNCTION public.log_rh_stage_change('posvenda', 'stage');

-- ── PARTE A.2 — Anexos aceitam 'posvenda' (tabela) ────────────────────────

-- NOTA (não corrigido aqui de propósito): a policy rh_attachments_self_read
-- (20260717124901) referencia os domínios 'holerite' e 'ponto', que NÃO
-- estão neste CHECK — ou seja, anexo de holerite/ponto nunca pôde ser
-- inserido. É a mesma classe de bug da PARTE B, mas está fora do que foi
-- aprovado nesta rodada; fica reportado pro Daniel decidir separadamente.
ALTER TABLE public.rh_attachments
  DROP CONSTRAINT rh_attachments_domain_check,
  ADD CONSTRAINT rh_attachments_domain_check
    CHECK (domain = ANY (ARRAY[
      'vagas','candidatos','onboarding','feedback','ferias','treinamentos',
      'fornecedor_contratos','marketing_tasks','marketing_purchase_requests',
      'comex','posvenda'
    ]));

CREATE POLICY rh_attachments_posvenda_access ON public.rh_attachments
  FOR ALL
  USING (
    domain = 'posvenda'
    AND EXISTS (SELECT 1 FROM public.posvenda_cases pc WHERE pc.id = rh_attachments.record_id)
  )
  WITH CHECK (
    domain = 'posvenda'
    AND EXISTS (SELECT 1 FROM public.posvenda_cases pc WHERE pc.id = rh_attachments.record_id)
  );

-- ── PARTE A.3 — gerente pode editar etapas/campos do Pós-venda ────────────
-- Conserta um bug que já existe hoje, independente desta migração: a
-- engrenagem "campos da etapa", o botão "Nova etapa" e o arrastar de coluna
-- aparecem para o gerente em PosVendaView, e gravam 0 linhas sem erro
-- nenhum, porque só admin passa na policy. Mesmo modo de falha descrito em
-- 20260792 para Tarefas e Compras.

DROP POLICY IF EXISTS rh_pipeline_stages_posvenda_write ON public.rh_pipeline_stages;
CREATE POLICY rh_pipeline_stages_posvenda_write ON public.rh_pipeline_stages
  FOR ALL
  USING (domain = 'posvenda' AND (current_user_is_admin() OR current_user_has_role('gerente')))
  WITH CHECK (domain = 'posvenda' AND (current_user_is_admin() OR current_user_has_role('gerente')));

DROP POLICY IF EXISTS rh_stage_fields_posvenda_write ON public.rh_pipeline_stage_fields;
CREATE POLICY rh_stage_fields_posvenda_write ON public.rh_pipeline_stage_fields
  FOR ALL
  USING (domain = 'posvenda' AND (current_user_is_admin() OR current_user_has_role('gerente')))
  WITH CHECK (domain = 'posvenda' AND (current_user_is_admin() OR current_user_has_role('gerente')));

-- ── PARTE B — permissão do BUCKET rh-attachments ──────────────────────────
-- O caminho gravado pelo app é `{domain}/{recordId}/{arquivo}`
-- (use-rh-attachments.js:41), então dá pra escopar por domínio usando o 1º
-- segmento da pasta — mesma técnica que a policy rh_attachments_self_read
-- (20260717124901) já usa neste bucket.
--
-- A policy de RH é recriada (não só complementada) porque a versão antiga
-- lia `profiles.role` escalar. Hoje isso ainda não exclui ninguém de RH por
-- acaso, mas excluiria qualquer pessoa que tivesse 'rh'/'gerente_rh' apenas
-- na lista `roles` — que é como a plataforma atribui cargo desde a FASE 1.

DROP POLICY IF EXISTS rh_attachments_rh_access ON storage.objects;
CREATE POLICY rh_attachments_rh_access ON storage.objects
  FOR ALL
  USING (bucket_id = 'rh-attachments' AND current_user_is_rh())
  WITH CHECK (bucket_id = 'rh-attachments' AND current_user_is_rh());

DROP POLICY IF EXISTS rh_attachments_marketing_storage ON storage.objects;
CREATE POLICY rh_attachments_marketing_storage ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'rh-attachments'
    AND (storage.foldername(name))[1] IN ('marketing_tasks','marketing_purchase_requests')
    AND current_user_is_marketing()
  )
  WITH CHECK (
    bucket_id = 'rh-attachments'
    AND (storage.foldername(name))[1] IN ('marketing_tasks','marketing_purchase_requests')
    AND current_user_is_marketing()
  );

DROP POLICY IF EXISTS rh_attachments_comex_storage ON storage.objects;
CREATE POLICY rh_attachments_comex_storage ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'rh-attachments'
    AND (storage.foldername(name))[1] = 'comex'
    AND current_user_is_comex()
  )
  WITH CHECK (
    bucket_id = 'rh-attachments'
    AND (storage.foldername(name))[1] = 'comex'
    AND current_user_is_comex()
  );

-- Pós-venda: escopado pelo caso, herdando a RLS de dono/empresa de
-- posvenda_cases (o 2º segmento da pasta é o id do caso). Um vendedor que
-- não enxerga o caso também não enxerga nem grava o anexo dele.
DROP POLICY IF EXISTS rh_attachments_posvenda_storage ON storage.objects;
CREATE POLICY rh_attachments_posvenda_storage ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'rh-attachments'
    AND (storage.foldername(name))[1] = 'posvenda'
    AND EXISTS (
      SELECT 1 FROM public.posvenda_cases pc
      WHERE pc.id::text = (storage.foldername(name))[2]
    )
  )
  WITH CHECK (
    bucket_id = 'rh-attachments'
    AND (storage.foldername(name))[1] = 'posvenda'
    AND EXISTS (
      SELECT 1 FROM public.posvenda_cases pc
      WHERE pc.id::text = (storage.foldername(name))[2]
    )
  );
