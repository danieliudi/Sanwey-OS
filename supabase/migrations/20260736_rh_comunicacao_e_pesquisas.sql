-- Onda 4 (item 11) — Comunicação interna + pesquisas anônimas.
--
-- Já aplicada ao projeto vivo via MCP (apply_migration); este arquivo existe
-- para que um `supabase db reset` reproduza o mesmo schema.

-- (11a) Comunicado: broadcast reaproveitando a tabela notifications (mesmo
-- canal das @menções). Expande um escopo (todos/frente/departamento) em uma
-- linha por destinatário, respeitando o opt-out mention_notifications_enabled.
CREATE OR REPLACE FUNCTION public.broadcast_announcement(
  p_title text, p_body text,
  p_scope_type text DEFAULT 'todos', p_scope_value text DEFAULT NULL,
  p_link jsonb DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
  IF NOT (current_user_is_admin() OR current_user_has_role('gerente_rh')) THEN
    RAISE EXCEPTION 'Sem permissão para enviar comunicados';
  END IF;
  IF coalesce(trim(p_title), '') = '' THEN RAISE EXCEPTION 'Título obrigatório'; END IF;
  IF p_scope_type NOT IN ('todos','frente','departamento') THEN RAISE EXCEPTION 'Escopo inválido'; END IF;

  INSERT INTO public.notifications (recipient_id, type, title, body, link, created_by)
  SELECT p.id, 'comunicado', p_title, p_body, p_link, v_uid
  FROM public.profiles p
  WHERE p.mention_notifications_enabled = true
    AND p.id <> v_uid
    AND (
      p_scope_type = 'todos'
      OR (p_scope_type = 'frente'       AND EXISTS (SELECT 1 FROM public.rh_colaboradores c WHERE c.profile_id = p.id AND c.frente = p_scope_value AND c.employee_status = 'ativo'))
      OR (p_scope_type = 'departamento' AND EXISTS (SELECT 1 FROM public.rh_colaboradores c WHERE c.profile_id = p.id AND c.department = p_scope_value AND c.employee_status = 'ativo'))
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;
REVOKE ALL ON FUNCTION public.broadcast_announcement(text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broadcast_announcement(text, text, text, text, jsonb) TO authenticated;

-- (11b) Pesquisas. Definição gerenciada por RH.
CREATE TABLE IF NOT EXISTS public.rh_pesquisas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      text NOT NULL,
  descricao   text,
  perguntas   jsonb NOT NULL DEFAULT '[]'::jsonb,
  status      text NOT NULL DEFAULT 'aberta' CHECK (status = ANY (ARRAY['aberta','encerrada'])),
  abre_em     date,
  fecha_em    date,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rh_pesquisas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rh_pesquisas_rh_all ON public.rh_pesquisas;
CREATE POLICY rh_pesquisas_rh_all ON public.rh_pesquisas
  FOR ALL USING (current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh'))
  WITH CHECK (current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh'));

-- Respostas: SEM identidade/contato. Invariante estrutural — NENHUMA policy de
-- SELECT (nem pra RH); leitura só via RPC de agregação. INSERT só pela RPC.
CREATE TABLE IF NOT EXISTS public.rh_pesquisa_respostas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pesquisa_id uuid NOT NULL REFERENCES public.rh_pesquisas(id) ON DELETE CASCADE,
  respostas   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rh_pesquisa_respostas ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_pesquisa_publica(p_id uuid)
RETURNS TABLE (id uuid, titulo text, descricao text, perguntas jsonb)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT p.id, p.titulo, p.descricao, p.perguntas
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
  v_ok boolean;
  v_recent int;
BEGIN
  SELECT true INTO v_ok FROM public.rh_pesquisas
  WHERE id = p_pesquisa_id AND status = 'aberta'
    AND (abre_em IS NULL OR abre_em <= (now() AT TIME ZONE 'America/Sao_Paulo')::date)
    AND (fecha_em IS NULL OR fecha_em >= (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  IF NOT coalesce(v_ok, false) THEN RAISE EXCEPTION 'Pesquisa não está aberta'; END IF;

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

CREATE OR REPLACE FUNCTION public.pesquisa_respostas_aggregado(p_pesquisa_id uuid)
RETURNS TABLE (total bigint, respostas jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT (current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  RETURN QUERY
    SELECT count(*)::bigint, coalesce(jsonb_agg(r.respostas), '[]'::jsonb)
    FROM public.rh_pesquisa_respostas r
    WHERE r.pesquisa_id = p_pesquisa_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.pesquisa_respostas_aggregado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pesquisa_respostas_aggregado(uuid) TO authenticated;
