-- Badge de "comentário não lido" no card do Kanban (gap identificado ao
-- comparar com o PRD "Norva: Comentários Contextuais") — sem migrar
-- comentários pra tabela normalizada nenhuma: só marca quando cada usuário
-- abriu por último cada registro, comparado no cliente contra o timestamp
-- do último item do array de notes/activities já existente em cada tabela.
-- "module" usa os mesmos identificadores já usados no link jsonb de
-- notifications (leads/campaigns/deliverables/purchase_requests/rh_*).
CREATE TABLE public.record_views (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module         text NOT NULL,
  record_id      uuid NOT NULL,
  last_viewed_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT record_views_unique UNIQUE (user_id, module, record_id)
);

CREATE INDEX record_views_user_module_idx ON public.record_views (user_id, module);

ALTER TABLE public.record_views ENABLE ROW LEVEL SECURITY;

-- Só o próprio usuário lê/grava seus registros de "última vez que vi" —
-- nunca revela pra ninguém quando outra pessoa abriu um card.
CREATE POLICY record_views_own_select
  ON public.record_views FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY record_views_own_insert
  ON public.record_views FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY record_views_own_update
  ON public.record_views FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
