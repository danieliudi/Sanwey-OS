-- Fix de segurança + funcional achado pela revisão QA/Segurança (regra 3.1)
-- da migration 20260902_chat_channel_groups_sync.sql, antes do merge pra main:
--
-- 1) chat_sync_membership_for_channel era SECURITY DEFINER sem NENHUMA
--    checagem de autorização interna, confiando cegamente em p_department/
--    p_companies vindos do chamador — e por padrão do Postgres/Supabase toda
--    função nova ganha EXECUTE pra PUBLIC. Combinado, isso deixava qualquer
--    usuário autenticado chamar a RPC direto e inserir/remover qualquer
--    pessoa de qualquer canal sincronizado, ignorando o gate de gestor em
--    chat_create_channel e a trigger de auto-proteção em profiles. Só deve
--    ser chamada internamente pela trigger chat_sync_channel_membership —
--    revoga o EXECUTE de PUBLIC/anon/authenticated. Isso não quebra o
--    caminho legítimo: uma função SECURITY DEFINER que chama outra roda sob
--    o dono da função, não sob o caller original.
--
-- 2) chat_create_channel foi recriada em 20260902 com um 6º parâmetro
--    (p_sync_filter) via CREATE OR REPLACE — mas Postgres identifica função
--    por nome+assinatura, não só nome, então isso criou um SEGUNDO overload
--    em vez de substituir o original. Resultado: PostgREST vê duas funções
--    "chat_create_channel" e responde PGRST203 (ambíguo) pra qualquer
--    chamada com 5 parâmetros. Derruba a assinatura antiga.
--
-- 3) Hardening: {"departments": [], "companies": []} (ou objeto vazio) hoje
--    bate com QUALQUER profile em chat_profile_matches_filter — a única
--    defesa hoje é um ternário no front (ChatView.jsx) que nunca manda um
--    filtro assim pra API. Sem defesa no servidor, isso é uma armadilha
--    (footgun) esperando uma chamada direta à RPC. chat_create_channel passa
--    a tratar um sync_filter cujo departments E companies estão ambos vazios/
--    ausentes como equivalente a NULL (canal manual).

revoke execute on function public.chat_sync_membership_for_channel(uuid, uuid, text, text[]) from public;
revoke execute on function public.chat_sync_membership_for_channel(uuid, uuid, text, text[]) from anon;
revoke execute on function public.chat_sync_membership_for_channel(uuid, uuid, text, text[]) from authenticated;

drop function if exists public.chat_create_channel(text, text, text, uuid[], boolean);

create or replace function public.chat_create_channel(
  p_name text, p_icon text, p_description text, p_member_ids uuid[],
  p_read_only boolean default false, p_sync_filter jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE new_id uuid; uid uuid; prof record; v_filter jsonb;
BEGIN
  IF NOT public.chat_is_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas gestores podem criar canais.';
  END IF;
  IF coalesce(trim(p_name), '') = '' THEN
    RAISE EXCEPTION 'O canal precisa de um nome.';
  END IF;

  -- Filtro "vazio" (sem departments e sem companies) equivale a nenhum
  -- filtro — nunca deixa um sync_filter não-nulo bater com todo mundo.
  v_filter := p_sync_filter;
  IF v_filter IS NOT NULL
     AND coalesce(jsonb_array_length(v_filter->'departments'), 0) = 0
     AND coalesce(jsonb_array_length(v_filter->'companies'), 0) = 0 THEN
    v_filter := NULL;
  END IF;

  INSERT INTO public.chat_channels (kind, name, icon, description, read_only, created_by, sync_filter)
  VALUES ('canal', trim(p_name), p_icon, p_description, coalesce(p_read_only, false), auth.uid(), v_filter)
  RETURNING id INTO new_id;

  INSERT INTO public.chat_channel_members (channel_id, user_id, is_admin) VALUES (new_id, auth.uid(), true);

  FOREACH uid IN ARRAY coalesce(p_member_ids, ARRAY[]::uuid[]) LOOP
    IF uid <> auth.uid() THEN
      INSERT INTO public.chat_channel_members (channel_id, user_id) VALUES (new_id, uid)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  IF v_filter IS NOT NULL THEN
    FOR prof IN SELECT id, department, companies FROM public.profiles LOOP
      IF public.chat_profile_matches_filter(v_filter, prof.department, prof.companies) THEN
        INSERT INTO public.chat_channel_members (channel_id, user_id) VALUES (new_id, prof.id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN new_id;
END;
$function$;
