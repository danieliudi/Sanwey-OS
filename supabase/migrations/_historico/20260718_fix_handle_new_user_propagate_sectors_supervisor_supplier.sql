-- handle_new_user() só propagava role+companies do convite pro profile novo
-- — sectors e supervisor_id definidos na hora de convidar (Configurações →
-- Usuários) eram gravados em `invitations` mas nunca chegavam no profile
-- recém-criado (achado ao cablear supplier_id: ia sofrer o mesmo problema).
-- Corrige propagando os três.
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
begin
  select id, role, companies, sectors, supervisor_id, supplier_id
    into invitation_id, assigned_role, assigned_companies, assigned_sectors, assigned_supervisor, assigned_supplier
    from public.invitations
    where lower(email) = lower(new.email)
      and accepted_at is null
    order by created_at desc
    limit 1;

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

  -- Marca aceito imediatamente se o e-mail já está confirmado no INSERT
  -- (auto-confirm habilitado). Caso contrário, handle_user_confirmed cuida disso.
  if invitation_id is not null and new.email_confirmed_at is not null then
    update public.invitations
      set accepted_at = now(), accepted_by = new.id
      where id = invitation_id;
  end if;

  return new;
end;
$function$;
