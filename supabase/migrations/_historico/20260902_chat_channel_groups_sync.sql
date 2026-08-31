-- Chat: canais criados por grupo (departamento/empresa), com sincronização
-- ao vivo — mockup "Chat: grupos e canais de aviso", aprovado pelo Daniel
-- 10/08/2026 (decisão 1: sincronizado ao vivo, não foto do dia; decisão 2:
-- todo gestor e admin pode criar canal "somente avisos" — já coberto pelo
-- gate existente chat_is_manager() em chat_create_channel, nenhuma mudança
-- necessária ali).
--
-- Achado ao investigar antes de escrever isto: `profiles.department` está
-- NULL pras 8 contas hoje no banco (`profiles.companies` é a única
-- dimensão de fato populada). Isso não muda o desenho — a UI ainda oferece
-- filtro por departamento, é decisão de produto — só significa que um
-- canal sincronizado só por departamento fica vazio até alguém preencher
-- esse campo pros usuários. Documentado aqui pra não parecer bug quando
-- alguém testar.

-- `sync_filter` null = canal manual (comportamento de sempre, sem mudança).
-- Não-nulo = canal "por grupo": {"departments": [...], "companies": [...]}.
-- Cada chave, se presente e não-vazia, é uma condição obrigatória (AND
-- entre chaves); dentro de uma chave, qualquer valor da lista basta (OR).
alter table public.chat_channels
  add column if not exists sync_filter jsonb;

comment on column public.chat_channels.sync_filter is
  'null = membros manuais. {"departments": [...], "companies": [...]} = membros sincronizados ao vivo com profiles.department/companies via trigger chat_sync_channel_membership.';

-- Único ponto de verdade de "esse profile bate com esse filtro" — usado
-- tanto pela função de popular membros na criação quanto pelo trigger de
-- sincronização, pra nunca divergir os dois.
create or replace function public.chat_profile_matches_filter(p_filter jsonb, p_department text, p_companies text[])
returns boolean
language sql
immutable
as $function$
  select
    (
      p_filter->'departments' is null
      or jsonb_array_length(p_filter->'departments') = 0
      or coalesce(p_department = any(array(select jsonb_array_elements_text(p_filter->'departments'))), false)
    )
    and (
      p_filter->'companies' is null
      or jsonb_array_length(p_filter->'companies') = 0
      or coalesce(p_companies, '{}'::text[]) && array(select jsonb_array_elements_text(p_filter->'companies'))
    );
$function$;

-- Sincroniza UM canal contra o profile dado — adiciona se bate e ainda não
-- é membro, remove se não bate mais e era membro. SECURITY DEFINER porque
-- roda a partir de um trigger em `profiles` (não é RPC pública).
create or replace function public.chat_sync_membership_for_channel(p_channel_id uuid, p_user_id uuid, p_department text, p_companies text[])
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE v_filter jsonb; v_matches boolean; v_is_member boolean;
BEGIN
  SELECT sync_filter INTO v_filter FROM public.chat_channels WHERE id = p_channel_id AND archived_at IS NULL;
  IF v_filter IS NULL THEN RETURN; END IF;

  v_matches := public.chat_profile_matches_filter(v_filter, p_department, p_companies);
  v_is_member := EXISTS(SELECT 1 FROM public.chat_channel_members WHERE channel_id = p_channel_id AND user_id = p_user_id);

  IF v_matches AND NOT v_is_member THEN
    INSERT INTO public.chat_channel_members (channel_id, user_id) VALUES (p_channel_id, p_user_id)
    ON CONFLICT DO NOTHING;
  ELSIF NOT v_matches AND v_is_member THEN
    -- Nunca remove quem é dono/criador do canal (is_admin) — sincronização
    -- ajusta a audiência, não expulsa quem administra o canal.
    DELETE FROM public.chat_channel_members
    WHERE channel_id = p_channel_id AND user_id = p_user_id AND is_admin IS NOT TRUE;
  END IF;
END;
$function$;

-- Roda em toda mudança de departamento/empresas de um profile (inclusive
-- INSERT — contratação nova já entra sincronizada) e reavalia contra TODO
-- canal com sync_filter — são poucos canais de grupo esperados (avisos
-- institucionais, não um por conversa), então isso não é hot path.
create or replace function public.chat_sync_channel_membership()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE ch record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.department IS NOT DISTINCT FROM OLD.department AND NEW.companies IS NOT DISTINCT FROM OLD.companies THEN
    RETURN NEW;
  END IF;
  FOR ch IN SELECT id FROM public.chat_channels WHERE sync_filter IS NOT NULL AND archived_at IS NULL LOOP
    PERFORM public.chat_sync_membership_for_channel(ch.id, NEW.id, NEW.department, NEW.companies);
  END LOOP;
  RETURN NEW;
END;
$function$;

drop trigger if exists chat_sync_channel_membership_trigger on public.profiles;
create trigger chat_sync_channel_membership_trigger
  after insert or update on public.profiles
  for each row execute function public.chat_sync_channel_membership();

-- chat_create_channel ganha p_sync_filter opcional — quando presente,
-- popula os membros iniciais varrendo profiles (em vez de depender só de
-- p_member_ids), e grava o filtro no canal pra manter sincronizado dali em
-- diante. Os dois parâmetros não são mutuamente exclusivos: dá pra criar
-- por grupo E ainda adicionar alguém avulso via p_member_ids no mesmo
-- momento (ex.: o time inteiro de Marketing + um convidado específico de
-- outro departamento).
create or replace function public.chat_create_channel(
  p_name text, p_icon text, p_description text, p_member_ids uuid[],
  p_read_only boolean default false, p_sync_filter jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
DECLARE new_id uuid; uid uuid; prof record;
BEGIN
  IF NOT public.chat_is_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas gestores podem criar canais.';
  END IF;
  IF coalesce(trim(p_name), '') = '' THEN
    RAISE EXCEPTION 'O canal precisa de um nome.';
  END IF;

  INSERT INTO public.chat_channels (kind, name, icon, description, read_only, created_by, sync_filter)
  VALUES ('canal', trim(p_name), p_icon, p_description, coalesce(p_read_only, false), auth.uid(), p_sync_filter)
  RETURNING id INTO new_id;

  INSERT INTO public.chat_channel_members (channel_id, user_id, is_admin) VALUES (new_id, auth.uid(), true);

  FOREACH uid IN ARRAY coalesce(p_member_ids, ARRAY[]::uuid[]) LOOP
    IF uid <> auth.uid() THEN
      INSERT INTO public.chat_channel_members (channel_id, user_id) VALUES (new_id, uid)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  IF p_sync_filter IS NOT NULL THEN
    FOR prof IN SELECT id, department, companies FROM public.profiles LOOP
      IF public.chat_profile_matches_filter(p_sync_filter, prof.department, prof.companies) THEN
        INSERT INTO public.chat_channel_members (channel_id, user_id) VALUES (new_id, prof.id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN new_id;
END;
$function$;
