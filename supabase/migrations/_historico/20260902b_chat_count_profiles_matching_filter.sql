-- Preview "N pessoas correspondem" no modal de "Criar canal por grupo" —
-- RPC dedicada em vez de deixar o front consultar `profiles` direto: só
-- devolve uma contagem (nunca a lista), e só pra quem já pode criar canal
-- (chat_is_manager). Gate simétrico ao de chat_create_channel — sem isso o
-- preview vazaria "quantas pessoas existem em cada departamento/empresa"
-- pra qualquer usuário autenticado, não só gestor.
create or replace function public.chat_count_profiles_matching_filter(p_filter jsonb)
returns integer
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select case
    when not public.chat_is_manager(auth.uid()) then 0
    else (
      select count(*)::int
      from public.profiles p
      where public.chat_profile_matches_filter(p_filter, p.department, p.companies)
    )
  end;
$function$;
