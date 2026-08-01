-- Chat interno — Fase 1 (canais + DM + leitura/não-lida).
-- Governança de DM: o colaborador comum não "acha" e nem manda mensagem pra
-- qualquer um. Regra (chat_can_dm): só quem compartilha setor, o supervisor
-- direto, ou um subordinado direto. Gestor/admin/diretoria alcança qualquer
-- um (a hierarquia desce, não sobe). Diretoria/admin nunca recebem DM de
-- quem não é gestor — reclamação/escalonamento sobe por canal estruturado,
-- não por DM direta no presidente. `agencia` (fornecedor externo) fica fora
-- do chat interno inteiro.

CREATE TABLE IF NOT EXISTS public.chat_channels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text NOT NULL DEFAULT 'canal' CHECK (kind IN ('canal', 'dm')),
  name        text,
  description text,
  icon        text,
  company_id  text,
  read_only   boolean NOT NULL DEFAULT false,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  archived_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.chat_channel_members (
  channel_id   uuid NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_admin     boolean NOT NULL DEFAULT false,
  last_read_at timestamptz,
  joined_at    timestamptz DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);
CREATE INDEX IF NOT EXISTS chat_channel_members_user_idx ON public.chat_channel_members (user_id);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  uuid NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  author_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  body        text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz DEFAULT now(),
  edited_at   timestamptz,
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS chat_messages_channel_created_idx ON public.chat_messages (channel_id, created_at DESC);

-- SECURITY DEFINER: evita recursão infinita entre a policy de chat_channels
-- e a de chat_channel_members (cada uma consultaria a outra).
CREATE OR REPLACE FUNCTION public.chat_is_member(p_channel uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_channel_members
    WHERE channel_id = p_channel AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.chat_is_manager(p_user uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user
      AND roles && ARRAY['admin','gerente','gerente_marketing','gerente_rh','diretoria']::text[]
  );
$$;

CREATE OR REPLACE FUNCTION public.chat_can_dm(p_target uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  me           public.profiles%ROWTYPE;
  target       public.profiles%ROWTYPE;
BEGIN
  IF p_target IS NULL OR auth.uid() IS NULL OR p_target = auth.uid() THEN RETURN false; END IF;
  SELECT * INTO me     FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO target FROM public.profiles WHERE id = p_target;
  IF me.id IS NULL OR target.id IS NULL THEN RETURN false; END IF;

  -- Fornecedor externo não participa do chat interno, nos dois sentidos.
  IF me.roles && ARRAY['agencia']::text[] OR target.roles && ARRAY['agencia']::text[] THEN
    RETURN false;
  END IF;

  -- Gestor alcança qualquer um (a hierarquia desce livremente).
  IF public.chat_is_manager(me.id) THEN RETURN true; END IF;

  -- Não-gestor nunca abre DM com diretoria/admin — escalonamento sobe por
  -- canal estruturado, não por mensagem direta no topo.
  IF target.roles && ARRAY['diretoria','admin']::text[] THEN RETURN false; END IF;

  -- Linha direta de reporte (nos dois sentidos).
  IF me.supervisor_id = target.id OR target.supervisor_id = me.id THEN RETURN true; END IF;

  -- Mesmo setor.
  IF me.sectors IS NOT NULL AND target.sectors IS NOT NULL AND me.sectors && target.sectors THEN
    RETURN true;
  END IF;

  RETURN false;
END $$;

-- Quem aparece na busca de "nova conversa" — é a mesma regra do can_dm, só
-- que como lista. Não achar a pessoa É o controle: não existe tela onde um
-- calouro encontre o diretor pra mandar mensagem.
CREATE OR REPLACE FUNCTION public.chat_dm_candidates()
RETURNS TABLE (id uuid, name text, initials text, avatar_bg text, avatar_url text, job_title text, department text)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT p.id, p.name, p.initials, p.avatar_bg, p.avatar_url, p.job_title, p.department
  FROM public.profiles p
  WHERE p.id <> auth.uid() AND public.chat_can_dm(p.id)
  ORDER BY p.name;
$$;

-- Canal read_only (ex.: "Direção"): só gestor publica; todo membro lê.
CREATE OR REPLACE FUNCTION public.chat_can_post(p_channel uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
DECLARE ch public.chat_channels%ROWTYPE;
BEGIN
  IF NOT public.chat_is_member(p_channel) THEN RETURN false; END IF;
  SELECT * INTO ch FROM public.chat_channels WHERE id = p_channel;
  IF ch.id IS NULL OR ch.archived_at IS NOT NULL THEN RETURN false; END IF;
  IF ch.read_only THEN RETURN public.chat_is_manager(auth.uid()); END IF;
  RETURN true;
END $$;

ALTER TABLE public.chat_channels        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_channels_read ON public.chat_channels;
CREATE POLICY chat_channels_read ON public.chat_channels FOR SELECT
  USING (public.chat_is_member(id));

DROP POLICY IF EXISTS chat_members_read ON public.chat_channel_members;
CREATE POLICY chat_members_read ON public.chat_channel_members FOR SELECT
  USING (public.chat_is_member(channel_id));

-- Só a própria linha de leitura é atualizável (marcar como lido).
DROP POLICY IF EXISTS chat_members_update_self ON public.chat_channel_members;
CREATE POLICY chat_members_update_self ON public.chat_channel_members FOR UPDATE
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS chat_messages_read ON public.chat_messages;
CREATE POLICY chat_messages_read ON public.chat_messages FOR SELECT
  USING (public.chat_is_member(channel_id));

DROP POLICY IF EXISTS chat_messages_insert ON public.chat_messages;
CREATE POLICY chat_messages_insert ON public.chat_messages FOR INSERT
  WITH CHECK (author_id = auth.uid() AND public.chat_can_post(channel_id));

DROP POLICY IF EXISTS chat_messages_update_own ON public.chat_messages;
CREATE POLICY chat_messages_update_own ON public.chat_messages FOR UPDATE
  USING      (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE OR REPLACE FUNCTION public.chat_touch_channel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$ BEGIN
  UPDATE public.chat_channels SET updated_at = now() WHERE id = NEW.channel_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS chat_messages_touch_channel ON public.chat_messages;
CREATE TRIGGER chat_messages_touch_channel
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_touch_channel();

-- ---------------------------------------------------------------------
-- RPCs: criar canal/DM, marcar lido, listar canais com badge
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.chat_start_dm(p_target uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE existing uuid; new_id uuid;
BEGIN
  IF NOT public.chat_can_dm(p_target) THEN
    RAISE EXCEPTION 'Você não pode iniciar uma conversa direta com essa pessoa.';
  END IF;

  SELECT c.id INTO existing
  FROM public.chat_channels c
  WHERE c.kind = 'dm'
    AND EXISTS (SELECT 1 FROM public.chat_channel_members m WHERE m.channel_id = c.id AND m.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.chat_channel_members m WHERE m.channel_id = c.id AND m.user_id = p_target)
    AND (SELECT count(*) FROM public.chat_channel_members m WHERE m.channel_id = c.id) = 2
  LIMIT 1;
  IF existing IS NOT NULL THEN RETURN existing; END IF;

  INSERT INTO public.chat_channels (kind, created_by) VALUES ('dm', auth.uid()) RETURNING id INTO new_id;
  INSERT INTO public.chat_channel_members (channel_id, user_id) VALUES (new_id, auth.uid()), (new_id, p_target);
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.chat_create_channel(
  p_name text, p_icon text, p_description text, p_member_ids uuid[], p_read_only boolean DEFAULT false
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE new_id uuid; uid uuid;
BEGIN
  IF NOT public.chat_is_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas gestores podem criar canais.';
  END IF;
  IF coalesce(trim(p_name), '') = '' THEN
    RAISE EXCEPTION 'O canal precisa de um nome.';
  END IF;

  INSERT INTO public.chat_channels (kind, name, icon, description, read_only, created_by)
  VALUES ('canal', trim(p_name), p_icon, p_description, coalesce(p_read_only, false), auth.uid())
  RETURNING id INTO new_id;

  INSERT INTO public.chat_channel_members (channel_id, user_id, is_admin) VALUES (new_id, auth.uid(), true);

  FOREACH uid IN ARRAY coalesce(p_member_ids, ARRAY[]::uuid[]) LOOP
    IF uid <> auth.uid() THEN
      INSERT INTO public.chat_channel_members (channel_id, user_id) VALUES (new_id, uid)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.chat_mark_read(p_channel uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.chat_channel_members
  SET last_read_at = now()
  WHERE channel_id = p_channel AND user_id = auth.uid();
$$;

-- Lista de canais do usuário já com contagem de não-lidas e prévia da última
-- mensagem — evita N+1 no cliente (uma query por canal só pra saber o badge).
CREATE OR REPLACE FUNCTION public.chat_my_channels()
RETURNS TABLE (
  id uuid, kind text, name text, icon text, description text, read_only boolean,
  updated_at timestamptz, last_read_at timestamptz, unread_count bigint,
  last_message_body text, last_message_at timestamptz, last_message_author uuid,
  dm_peer_id uuid, dm_peer_name text, dm_peer_initials text, dm_peer_avatar_bg text
)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    c.id, c.kind, c.name, c.icon, c.description, c.read_only, c.updated_at, m.last_read_at,
    (SELECT count(*) FROM public.chat_messages msg
      WHERE msg.channel_id = c.id AND msg.deleted_at IS NULL
        AND msg.author_id <> auth.uid()
        AND (m.last_read_at IS NULL OR msg.created_at > m.last_read_at)) AS unread_count,
    lm.body, lm.created_at, lm.author_id,
    peer.id, peer.name, peer.initials, peer.avatar_bg
  FROM public.chat_channel_members m
  JOIN public.chat_channels c ON c.id = m.channel_id AND c.archived_at IS NULL
  LEFT JOIN LATERAL (
    SELECT body, created_at, author_id FROM public.chat_messages
    WHERE channel_id = c.id AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  ) lm ON true
  LEFT JOIN LATERAL (
    SELECT p.id, p.name, p.initials, p.avatar_bg
    FROM public.chat_channel_members m2
    JOIN public.profiles p ON p.id = m2.user_id
    WHERE c.kind = 'dm' AND m2.channel_id = c.id AND m2.user_id <> auth.uid()
    LIMIT 1
  ) peer ON true
  WHERE m.user_id = auth.uid()
  ORDER BY coalesce(lm.created_at, c.updated_at) DESC;
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Chat é 100% interno: nenhuma função dele deve ser chamável sem login.
-- Na prática já retornariam vazio (todas dependem de auth.uid()), mas deixar
-- executável por `anon` aparece como achado no linter de segurança e é
-- superfície de API desnecessária.
REVOKE EXECUTE ON FUNCTION public.chat_is_member(uuid)      FROM anon;
REVOKE EXECUTE ON FUNCTION public.chat_is_manager(uuid)     FROM anon;
REVOKE EXECUTE ON FUNCTION public.chat_can_dm(uuid)         FROM anon;
REVOKE EXECUTE ON FUNCTION public.chat_can_post(uuid)       FROM anon;
REVOKE EXECUTE ON FUNCTION public.chat_dm_candidates()      FROM anon;
REVOKE EXECUTE ON FUNCTION public.chat_my_channels()        FROM anon;
REVOKE EXECUTE ON FUNCTION public.chat_mark_read(uuid)      FROM anon;
REVOKE EXECUTE ON FUNCTION public.chat_start_dm(uuid)       FROM anon;
REVOKE EXECUTE ON FUNCTION public.chat_create_channel(text, text, text, uuid[], boolean) FROM anon;

-- Ajuste da regra de DM: "mesmo setor" sozinho trava demais na prática.
-- Confirmado nos dados reais: a maioria dos profiles tem `sectors` vazio
-- (setor comercial só é preenchido pra quem trabalha segmento de mercado),
-- então um não-gestor ficaria sem poder falar com ninguém. `department` é o
-- campo que de fato representa "onde a pessoa trabalha" pro resto da
-- empresa (RH preenche no cadastro), então entra como segundo critério.
CREATE OR REPLACE FUNCTION public.chat_can_dm(p_target uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  me     public.profiles%ROWTYPE;
  target public.profiles%ROWTYPE;
BEGIN
  IF p_target IS NULL OR auth.uid() IS NULL OR p_target = auth.uid() THEN RETURN false; END IF;
  SELECT * INTO me     FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO target FROM public.profiles WHERE id = p_target;
  IF me.id IS NULL OR target.id IS NULL THEN RETURN false; END IF;

  IF me.roles && ARRAY['agencia']::text[] OR target.roles && ARRAY['agencia']::text[] THEN
    RETURN false;
  END IF;

  IF public.chat_is_manager(me.id) THEN RETURN true; END IF;

  IF target.roles && ARRAY['diretoria','admin']::text[] THEN RETURN false; END IF;

  IF me.supervisor_id = target.id OR target.supervisor_id = me.id THEN RETURN true; END IF;

  IF me.sectors IS NOT NULL AND target.sectors IS NOT NULL AND me.sectors && target.sectors THEN
    RETURN true;
  END IF;

  IF me.department IS NOT NULL AND target.department IS NOT NULL
     AND trim(lower(me.department)) = trim(lower(target.department)) THEN
    RETURN true;
  END IF;

  RETURN false;
END $$;

REVOKE EXECUTE ON FUNCTION public.chat_can_dm(uuid) FROM anon;
