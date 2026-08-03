-- SEC-M3: self-signup público é aberto (LoginScreen "Criar conta") e
-- handle_new_user já vinculava role/companies do convite pendente NO
-- INSERT de auth.users — antes de qualquer confirmação de e-mail. Se
-- "Confirm email" estiver desligado no painel de Auth (não verificável
-- via SQL), um atacante que soubesse um e-mail com convite pendente
-- ganhava sessão com o papel/empresa do convidado imediatamente.
-- Correção backend-only (sem mudar UI, sem precisar de mockup): o profile
-- nasce com o papel padrão (mesmo caminho de "sem convite"); só recebe o
-- papel/empresa REAIS do convite quando o e-mail é confirmado de verdade
-- (handle_user_confirmed, que já existe e já reage à transição
-- email_confirmed_at null->not null). Fail-open teórico de auto-confirm
-- deixa de expor qualquer privilégio adicional.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  display_name text;
  user_count int;
  assigned_role text;
  assigned_companies text[];
  assigned_sectors text[];
  assigned_supervisor uuid;
  assigned_supplier uuid;
  invitation_id uuid;
  invitation_confirmed_already boolean := false;
begin
  select id, role, companies, sectors, supervisor_id, supplier_id
    into invitation_id, assigned_role, assigned_companies, assigned_sectors, assigned_supervisor, assigned_supplier
    from public.invitations
    where lower(email) = lower(new.email)
      and accepted_at is null
    order by created_at desc
    limit 1;

  -- Só aplica o papel/empresa do convite de imediato se o e-mail JÁ chegou
  -- confirmado no INSERT (ex.: fluxo administrativo/auto-confirm real).
  -- Caso contrário, entra como 'vendedor' sem empresa — igual a quem não
  -- tem convite nenhum — e handle_user_confirmed promove no momento em
  -- que a confirmação de e-mail realmente acontecer.
  if invitation_id is not null and new.email_confirmed_at is not null then
    invitation_confirmed_already := true;
  else
    invitation_id := null;
  end if;

  if invitation_id is null then
    select count(*) into user_count from public.profiles;
    if user_count = 0 then
      assigned_role := 'admin';
      assigned_companies := array['industria', 'resibag', 'montemor'];
    else
      assigned_role := 'vendedor';
      assigned_companies := '{}'::text[];
    end if;
    assigned_sectors := '{}'::text[];
    assigned_supervisor := null;
    assigned_supplier := null;
  end if;

  display_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));

  insert into public.profiles (id, email, name, initials, role, companies, sectors, supervisor_id, supplier_id)
  values (
    new.id,
    new.email,
    display_name,
    upper(substring(display_name from 1 for 2)),
    assigned_role,
    assigned_companies,
    coalesce(assigned_sectors, '{}'::text[]),
    assigned_supervisor,
    assigned_supplier
  )
  on conflict (id) do nothing;

  if invitation_confirmed_already then
    update public.invitations
      set accepted_at = now(), accepted_by = new.id
      where id = invitation_id;
  end if;

  return new;
end;
$function$;

-- handle_user_confirmed agora também aplica o papel/empresa do convite
-- (antes só marcava accepted_at) — é o ÚNICO momento em que um convite
-- pendente concede privilégio, e só depois de confirmação real de e-mail.
CREATE OR REPLACE FUNCTION public.handle_user_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  inv record;
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    select * into inv
      from public.invitations
      where lower(email) = lower(new.email)
        and accepted_at is null
      order by created_at desc
      limit 1;

    if inv.id is not null then
      update public.profiles
        set role = inv.role,
            companies = inv.companies,
            sectors = coalesce(inv.sectors, '{}'::text[]),
            supervisor_id = inv.supervisor_id,
            supplier_id = inv.supplier_id
        where id = new.id;

      update public.invitations
        set accepted_at = now(), accepted_by = new.id
        where id = inv.id;
    end if;
  end if;
  return new;
end;
$function$;
