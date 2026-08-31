-- Onda 4 (item 12) — Agendamento de bem-estar por QR com fila FIFO.
-- Sessão (ex: "Massagem 25/07") criada pelo RH; colaboradores entram na fila
-- por um link/QR público e recebem uma senha (ordem de chegada). O público só
-- vê a própria senha e quantos estão na frente — nunca a lista/contatos.
--
-- Já aplicada ao projeto vivo via MCP (apply_migration); este arquivo existe
-- para que um `supabase db reset` reproduza o mesmo schema.

CREATE TABLE IF NOT EXISTS public.rh_bemestar_sessoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      text NOT NULL,
  descricao   text,
  data        date,
  status      text NOT NULL DEFAULT 'aberta' CHECK (status = ANY (ARRAY['aberta','encerrada'])),
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rh_bemestar_sessoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rh_bemestar_sessoes_rh_all ON public.rh_bemestar_sessoes;
CREATE POLICY rh_bemestar_sessoes_rh_all ON public.rh_bemestar_sessoes
  FOR ALL USING (current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh'))
  WITH CHECK (current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh'));

CREATE TABLE IF NOT EXISTS public.rh_bemestar_fila (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id   uuid NOT NULL REFERENCES public.rh_bemestar_sessoes(id) ON DELETE CASCADE,
  senha       integer NOT NULL,
  nome        text NOT NULL,
  frente      text,
  status      text NOT NULL DEFAULT 'na_fila' CHECK (status = ANY (ARRAY['na_fila','chamado','atendido','faltou'])),
  created_at  timestamptz NOT NULL DEFAULT now(),
  called_at   timestamptz,
  UNIQUE (sessao_id, senha)
);
ALTER TABLE public.rh_bemestar_fila ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rh_bemestar_fila_rh_rw ON public.rh_bemestar_fila;
CREATE POLICY rh_bemestar_fila_rh_rw ON public.rh_bemestar_fila
  FOR ALL USING (current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh'))
  WITH CHECK (current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh'));

CREATE OR REPLACE FUNCTION public.get_bemestar_sessao_publica(p_id uuid)
RETURNS TABLE (id uuid, titulo text, descricao text, data date, na_fila integer)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT s.id, s.titulo, s.descricao, s.data,
         (SELECT count(*)::int FROM public.rh_bemestar_fila f WHERE f.sessao_id = s.id AND f.status = 'na_fila')
  FROM public.rh_bemestar_sessoes s
  WHERE s.id = p_id AND s.status = 'aberta';
$function$;
REVOKE ALL ON FUNCTION public.get_bemestar_sessao_publica(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_bemestar_sessao_publica(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_bemestar_agendamento(p_sessao_id uuid, p_nome text, p_frente text DEFAULT NULL)
RETURNS TABLE (senha integer, na_frente integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ok boolean;
  v_senha int;
  v_recent int;
BEGIN
  IF coalesce(trim(p_nome), '') = '' THEN RAISE EXCEPTION 'Nome obrigatório'; END IF;
  IF p_frente IS NOT NULL AND btrim(p_frente) <> '' AND btrim(p_frente) NOT IN ('sanwey','resibag','montemor') THEN
    RAISE EXCEPTION 'Unidade inválida';
  END IF;

  SELECT true INTO v_ok FROM public.rh_bemestar_sessoes WHERE id = p_sessao_id AND status = 'aberta';
  IF NOT coalesce(v_ok, false) THEN RAISE EXCEPTION 'Sessão não está aberta'; END IF;

  SELECT count(*) INTO v_recent FROM public.rh_bemestar_fila
  WHERE sessao_id = p_sessao_id AND created_at > now() - interval '2 minutes';
  IF v_recent >= 60 THEN RAISE EXCEPTION 'Muitas entradas no momento. Tente novamente em instantes.'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('rh_bemestar_' || p_sessao_id::text));
  SELECT coalesce(max(f.senha), 0) + 1 INTO v_senha FROM public.rh_bemestar_fila f WHERE f.sessao_id = p_sessao_id;

  INSERT INTO public.rh_bemestar_fila (sessao_id, senha, nome, frente)
  VALUES (p_sessao_id, v_senha, trim(p_nome), nullif(btrim(coalesce(p_frente, '')), ''));

  RETURN QUERY
    SELECT v_senha, (SELECT count(*)::int FROM public.rh_bemestar_fila f
                     WHERE f.sessao_id = p_sessao_id AND f.status = 'na_fila' AND f.senha < v_senha);
END;
$function$;
REVOKE ALL ON FUNCTION public.submit_bemestar_agendamento(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_bemestar_agendamento(uuid, text, text) TO anon, authenticated;
