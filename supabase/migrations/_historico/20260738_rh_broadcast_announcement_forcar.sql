-- Comunicado "importante" (a pedido): RH precisa poder alcançar todo mundo,
-- mesmo quem desativou notificações — pela importância do aviso (ex: recesso,
-- mudança de política, segurança). Adiciona p_importante: quando true, ignora
-- o filtro mention_notifications_enabled e marca o type como
-- 'comunicado_importante' (o sino mostra com destaque visual diferente).
-- Só alcança quem TEM login na plataforma — não resolve quem não tem
-- perfil (ver rh_colaboradores sem profile_id); isso é WhatsApp/SMS, uma
-- integração à parte, ainda não construída.
--
-- CREATE OR REPLACE com uma assinatura diferente cria um OVERLOAD, não
-- substitui a função antiga — remove a assinatura de 5 parâmetros
-- (pré-p_importante) explicitamente antes de recriar.
--
-- Já aplicada ao projeto vivo via MCP (apply_migration); este arquivo existe
-- para que um `supabase db reset` reproduza o mesmo schema.
DROP FUNCTION IF EXISTS public.broadcast_announcement(text, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.broadcast_announcement(
  p_title text, p_body text,
  p_scope_type text DEFAULT 'todos', p_scope_value text DEFAULT NULL,
  p_link jsonb DEFAULT NULL,
  p_importante boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer := 0;
  v_type text := CASE WHEN p_importante THEN 'comunicado_importante' ELSE 'comunicado' END;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
  IF NOT (current_user_is_admin() OR current_user_has_role('gerente_rh')) THEN
    RAISE EXCEPTION 'Sem permissão para enviar comunicados';
  END IF;
  IF coalesce(trim(p_title), '') = '' THEN RAISE EXCEPTION 'Título obrigatório'; END IF;
  IF p_scope_type NOT IN ('todos','frente','departamento') THEN RAISE EXCEPTION 'Escopo inválido'; END IF;

  INSERT INTO public.notifications (recipient_id, type, title, body, link, created_by)
  SELECT p.id, v_type, p_title, p_body, p_link, v_uid
  FROM public.profiles p
  WHERE (p_importante OR p.mention_notifications_enabled = true)
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
REVOKE ALL ON FUNCTION public.broadcast_announcement(text, text, text, text, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broadcast_announcement(text, text, text, text, jsonb, boolean) TO authenticated;
