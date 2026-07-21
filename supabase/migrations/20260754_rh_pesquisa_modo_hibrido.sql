-- Reunião com o RH (20/07): pesquisa precisa poder ser enviada "igual
-- comunicado" (identificada e notificada), além do modelo anônimo já
-- existente — modelo híbrido, a critério de quem cria a pesquisa.

ALTER TABLE public.rh_pesquisas
  ADD COLUMN modo        text NOT NULL DEFAULT 'anonima' CHECK (modo = ANY (ARRAY['anonima','identificada'])),
  ADD COLUMN scope_type  text NOT NULL DEFAULT 'todos' CHECK (scope_type = ANY (ARRAY['todos','frente','departamento'])),
  ADD COLUMN scope_value text;

-- Só pesquisas "identificada" gravam quem respondeu — anônima nunca grava
-- identidade, independente de quem chamou a RPC estar logado ou não.
ALTER TABLE public.rh_pesquisa_respostas
  ADD COLUMN respondente_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Um colaborador só responde uma vez uma pesquisa identificada.
CREATE UNIQUE INDEX rh_pesquisa_respostas_identificada_uniq
  ON public.rh_pesquisa_respostas (pesquisa_id, respondente_id)
  WHERE respondente_id IS NOT NULL;

-- Muda o formato de retorno (novo campo `modo`) — precisa dropar antes.
DROP FUNCTION IF EXISTS public.get_pesquisa_publica(uuid);

CREATE FUNCTION public.get_pesquisa_publica(p_id uuid)
RETURNS TABLE (id uuid, titulo text, descricao text, perguntas jsonb, modo text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT p.id, p.titulo, p.descricao, p.perguntas, p.modo
  FROM public.rh_pesquisas p
  WHERE p.id = p_id
    AND p.status = 'aberta'
    AND (p.abre_em IS NULL OR p.abre_em <= (now() AT TIME ZONE 'America/Sao_Paulo')::date)
    AND (p.fecha_em IS NULL OR p.fecha_em >= (now() AT TIME ZONE 'America/Sao_Paulo')::date);
$function$;
REVOKE ALL ON FUNCTION public.get_pesquisa_publica(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pesquisa_publica(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_pesquisa_resposta(p_pesquisa_id uuid, p_respostas jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_modo text;
  v_uid uuid := auth.uid();
  v_recent int;
  v_ja_respondeu boolean;
BEGIN
  SELECT modo INTO v_modo FROM public.rh_pesquisas
  WHERE id = p_pesquisa_id AND status = 'aberta'
    AND (abre_em IS NULL OR abre_em <= (now() AT TIME ZONE 'America/Sao_Paulo')::date)
    AND (fecha_em IS NULL OR fecha_em >= (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  IF v_modo IS NULL THEN RAISE EXCEPTION 'Pesquisa não está aberta'; END IF;

  IF v_modo = 'identificada' THEN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Você precisa estar logado na plataforma para responder esta pesquisa.'; END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.rh_pesquisa_respostas WHERE pesquisa_id = p_pesquisa_id AND respondente_id = v_uid
    ) INTO v_ja_respondeu;
    IF v_ja_respondeu THEN RAISE EXCEPTION 'Você já respondeu esta pesquisa.'; END IF;

    INSERT INTO public.rh_pesquisa_respostas (pesquisa_id, respostas, respondente_id)
    VALUES (p_pesquisa_id, coalesce(p_respostas, '{}'::jsonb), v_uid);
    RETURN true;
  END IF;

  -- Anônima: mesmo comportamento de sempre, sem gravar identidade.
  SELECT count(*) INTO v_recent FROM public.rh_pesquisa_respostas
  WHERE pesquisa_id = p_pesquisa_id AND created_at > now() - interval '10 minutes';
  IF v_recent >= 200 THEN RAISE EXCEPTION 'Muitas respostas no momento. Tente novamente em instantes.'; END IF;

  INSERT INTO public.rh_pesquisa_respostas (pesquisa_id, respostas)
  VALUES (p_pesquisa_id, coalesce(p_respostas, '{}'::jsonb));
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.submit_pesquisa_resposta(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_pesquisa_resposta(uuid, jsonb) TO anon, authenticated;

-- Notifica (in-app) os colaboradores do escopo sobre uma pesquisa
-- identificada — mesmo espírito do broadcast_announcement, mas o link vai
-- direto pra página de resposta (fora do shell autenticado, então usa
-- `url` em vez de `module`/`id`).
CREATE OR REPLACE FUNCTION public.enviar_pesquisa_notificacao(p_pesquisa_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_pesquisa record;
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
  IF NOT (current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh')) THEN
    RAISE EXCEPTION 'Sem permissão para enviar pesquisas';
  END IF;

  SELECT * INTO v_pesquisa FROM public.rh_pesquisas WHERE id = p_pesquisa_id;
  IF v_pesquisa.id IS NULL THEN RAISE EXCEPTION 'Pesquisa não encontrada'; END IF;
  IF v_pesquisa.modo <> 'identificada' THEN RAISE EXCEPTION 'Só pesquisas identificadas podem ser notificadas.'; END IF;

  INSERT INTO public.notifications (recipient_id, type, title, body, link, created_by)
  SELECT p.id, 'pesquisa', 'Nova pesquisa: ' || v_pesquisa.titulo, v_pesquisa.descricao,
         jsonb_build_object('url', '/pesquisa/' || v_pesquisa.id::text), v_uid
  FROM public.profiles p
  WHERE p.mention_notifications_enabled = true
    AND p.id <> v_uid
    AND (
      v_pesquisa.scope_type = 'todos'
      OR (v_pesquisa.scope_type = 'frente'       AND EXISTS (SELECT 1 FROM public.rh_colaboradores c WHERE c.profile_id = p.id AND c.frente = v_pesquisa.scope_value AND c.employee_status = 'ativo'))
      OR (v_pesquisa.scope_type = 'departamento' AND EXISTS (SELECT 1 FROM public.rh_colaboradores c WHERE c.profile_id = p.id AND c.department = v_pesquisa.scope_value AND c.employee_status = 'ativo'))
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;
REVOKE ALL ON FUNCTION public.enviar_pesquisa_notificacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enviar_pesquisa_notificacao(uuid) TO authenticated;
