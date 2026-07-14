-- FASE 4 (@menção + notificações): infraestrutura server-side pra entregar
-- notificação de menção a OUTRO usuário — o sistema de notificações atual
-- (use-notifications.js) é só localStorage por navegador, então não existe
-- nenhuma forma de "avisar o usuário B" de dentro da sessão do usuário A.
-- Esta tabela + RPC é o mínimo necessário: uma notificação por destinatário,
-- lida via Realtime na própria sessão dele, com preferência de opt-out.

CREATE TABLE public.notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type         text NOT NULL DEFAULT 'mention',
  title        text NOT NULL,
  body         text,
  -- Deep-link genérico pro front navegar até o card certo, sem acoplar essa
  -- tabela a um módulo específico (lead/campanha/entrega/vaga/etc): sempre
  -- { module: 'leads'|'campaigns'|'deliverables'|'rh_vagas'|..., id: uuid }.
  link         jsonb,
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_recipient_created_idx ON public.notifications (recipient_id, created_at DESC);
CREATE INDEX notifications_recipient_unread_idx ON public.notifications (recipient_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select_own
  ON public.notifications FOR SELECT
  USING (recipient_id = auth.uid());

-- Só marcar como lida (read_at) — igual ao "mark read" do sistema local.
CREATE POLICY notifications_update_own
  ON public.notifications FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

CREATE POLICY notifications_delete_own
  ON public.notifications FOR DELETE
  USING (recipient_id = auth.uid());

-- Sem policy de INSERT de propósito: a única forma de criar uma notificação
-- pra OUTRO usuário é via create_mention_notifications (SECURITY DEFINER,
-- abaixo) — impede qualquer usuário autenticado de inserir notificação
-- arbitrária pra qualquer pessoa via REST direto.

-- Preferência de opt-out (default ligado, conforme pedido do usuário:
-- "sempre disparar notificação... mas deixar o usuário configurar se quer
-- ou não receber") — precisa ser lida pelo servidor (dentro da RPC), então
-- não pode viver só no localStorage como as outras preferências de
-- notificação hoje (use-user-settings.js).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mention_notifications_enabled boolean NOT NULL DEFAULT true;

-- RPC única de criação: quem comenta chama isso com a lista de usuários
-- mencionados no texto; a função filtra quem desativou notificação de
-- menção e ignora o próprio autor (não notifica a si mesmo). SECURITY
-- DEFINER porque não existe policy de INSERT direta na tabela.
CREATE OR REPLACE FUNCTION public.create_mention_notifications(
  p_recipient_ids uuid[],
  p_type text,
  p_title text,
  p_body text,
  p_link jsonb DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF p_title IS NULL OR trim(p_title) = '' THEN
    RAISE EXCEPTION 'Título obrigatório';
  END IF;

  INSERT INTO public.notifications (recipient_id, type, title, body, link, created_by)
  SELECT DISTINCT r, coalesce(p_type, 'mention'), p_title, p_body, p_link, v_uid
  FROM unnest(p_recipient_ids) AS r
  WHERE r <> v_uid
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = r AND mention_notifications_enabled = true
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.create_mention_notifications(uuid[], text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_mention_notifications(uuid[], text, text, text, jsonb) TO authenticated;
