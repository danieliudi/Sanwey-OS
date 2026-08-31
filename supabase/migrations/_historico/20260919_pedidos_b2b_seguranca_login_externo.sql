-- Revisão de segurança do módulo de Pedidos + Portal B2B (regra 3.1 do
-- CLAUDE.md). Aplicada em produção em 12/08/2026, logo depois de
-- 20260918_pedidos_catalogo_portal_b2b.sql.
--
-- Contexto: aquele schema introduziu a primeira classe de login EXTERNO com
-- dado próprio na plataforma ('cliente' + profiles.client_id). Os pontos
-- abaixo são lugares onde a plataforma ainda assumia que todo login era
-- funcionário. Dois vieram de revisão manual, um do get_advisors.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. SELF-ESCALATION (grave)
-- ─────────────────────────────────────────────────────────────────────────
-- `profiles_update` permite `id = auth.uid()` — todo mundo edita a própria
-- linha. Quem impede o abuso é este trigger, que congela as colunas que
-- carregam privilégio, inclusive `supplier_id` (o análogo exato do novo
-- `client_id`). Sem `client_id` na lista, um login de cliente apontava o
-- próprio perfil pra QUALQUER outro cliente e passava a ler preço, pedido e
-- contato do concorrente.
-- Aproveitando o rewrite, fixa também o search_path — achado do get_advisors
-- nesta mesma função.

create or replace function public.profiles_prevent_self_role_escalation()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
BEGIN
  IF auth.uid() = NEW.id AND NOT current_user_is_admin() THEN
    NEW.role := OLD.role;
    NEW.roles := OLD.roles;
    NEW.companies := OLD.companies;
    NEW.sectors := OLD.sectors;
    NEW.supervisor_id := OLD.supervisor_id;
    NEW.employee_status := OLD.employee_status;
    NEW.job_title := OLD.job_title;
    NEW.department := OLD.department;
    NEW.contract_type := OLD.contract_type;
    NEW.admission_date := OLD.admission_date;
    NEW.frente := OLD.frente;
    NEW.supplier_id := OLD.supplier_id;
    NEW.client_id := OLD.client_id;
    NEW.chat_enabled := OLD.chat_enabled;
  END IF;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Chat: login de cliente é externo, igual a fornecedor/agência
-- ─────────────────────────────────────────────────────────────────────────
-- As três portas de entrada do Chat já barravam 'agencia' e não conheciam
-- 'cliente'.

create or replace function public.chat_can_dm(p_target uuid)
returns boolean
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
DECLARE
  me     public.profiles%ROWTYPE;
  target public.profiles%ROWTYPE;
BEGIN
  IF p_target IS NULL OR auth.uid() IS NULL OR p_target = auth.uid() THEN RETURN false; END IF;
  SELECT * INTO me     FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO target FROM public.profiles WHERE id = p_target;
  IF me.id IS NULL OR target.id IS NULL THEN RETURN false; END IF;

  IF me.roles && ARRAY['agencia','cliente']::text[] OR target.roles && ARRAY['agencia','cliente']::text[] THEN
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

create or replace function public.chat_add_member(p_channel_id uuid, p_user_id uuid)
returns void
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.chat_can_manage(p_channel_id) then
    raise exception 'Você não pode editar este grupo/canal.';
  end if;
  if not exists (select 1 from public.chat_channels where id = p_channel_id and kind = 'canal') then
    raise exception 'Essa ação só vale pra grupo ou canal.';
  end if;
  if exists (select 1 from public.chat_channels where id = p_channel_id and sync_filter is not null) then
    raise exception 'Este grupo é sincronizado automaticamente por departamento — não dá pra adicionar pessoa à mão.';
  end if;
  if exists (select 1 from public.profiles where id = p_user_id and roles && array['agencia','cliente']::text[]) then
    raise exception 'Fornecedor, agência ou cliente não participa de grupo ou canal interno.';
  end if;
  insert into public.chat_channel_members (channel_id, user_id) values (p_channel_id, p_user_id) on conflict do nothing;
end; $$;

-- O sync automático casa só por departamento e empresa — e filtro VAZIO casa
-- com todo mundo (`chat_profile_matches_filter` devolve true quando a lista
-- não existe ou está vazia). Sem esta guarda, um canal com sync_filter aberto
-- arrastaria login de cliente pra dentro de canal interno assim que o primeiro
-- cliente fosse cadastrado.
create or replace function public.chat_sync_channel_membership()
returns trigger
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
DECLARE ch record;
BEGIN
  IF NEW.roles && ARRAY['agencia','cliente']::text[] THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.department IS NOT DISTINCT FROM OLD.department AND NEW.companies IS NOT DISTINCT FROM OLD.companies THEN
    RETURN NEW;
  END IF;
  FOR ch IN SELECT id FROM public.chat_channels WHERE sync_filter IS NOT NULL AND archived_at IS NULL LOOP
    PERFORM public.chat_sync_membership_for_channel(ch.id, NEW.id, NEW.department, NEW.companies);
  END LOOP;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. recalc_order_total() exposta como RPC (achado do get_advisors)
-- ─────────────────────────────────────────────────────────────────────────
-- É função de trigger, mas nasceu chamável em /rest/v1/rpc por anon e
-- authenticated. Chamar fora de contexto de trigger só daria erro, mas função
-- SECURITY DEFINER não fica pendurada em rota pública sem motivo.

revoke all on function public.recalc_order_total() from public;
revoke execute on function public.recalc_order_total() from anon;
revoke execute on function public.recalc_order_total() from authenticated;
