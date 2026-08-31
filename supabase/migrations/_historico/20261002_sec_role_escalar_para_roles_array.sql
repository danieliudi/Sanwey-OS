-- Achado AL-06 (ALTO, relatório de segurança): profiles_delete/profiles_
-- update ainda checam a coluna escalar legada `role` para decidir "não é
-- admin", em vez de `roles[]` (fonte de verdade multi-cargo desde
-- 20260714_profiles_multi_role_foundation.sql). Como `role ∈ roles` sempre
-- (trigger profiles_sync_roles garante), um usuário com role='gerente' e
-- roles=['gerente','admin'] passa em `role <> 'admin'` mesmo tendo admin
-- como cargo adicional — um gerente da mesma empresa consegue apagar ou
-- rebaixar esse usuário.
--
-- Troca `role <> 'admin'` por `NOT ('admin' = ANY(COALESCE(roles,'{}')))`
-- nas 2 policies de profiles — mesma expressão que o WITH CHECK de
-- profiles_update já usa corretamente; aqui só propaga pro USING.
--
-- invitations_admin_update/delete NÃO entram nesta correção: revisão mais
-- cuidadosa (feita ao escrever esta migration) mostrou que `invitations`
-- não tem coluna `roles[]` irmã — um convite propõe um único cargo, então
-- `role <> 'admin'` já é a checagem correta ali. O relatório de segurança
-- original generalizou esse achado às 4 policies por engano; esta nota
-- corrige isso.

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete
  on public.profiles
  for delete
  using (
    current_user_is_admin()
    or (
      current_user_is_manager()
      and not ('admin' = any(coalesce(roles, '{}'::text[])))
      and companies && current_user_companies()
    )
  );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update
  on public.profiles
  for update
  using (
    current_user_is_admin()
    or (
      current_user_is_manager()
      and not ('admin' = any(coalesce(roles, '{}'::text[])))
      and companies && current_user_companies()
    )
    or (id = (select auth.uid()))
  )
  with check (
    current_user_is_admin()
    or (
      current_user_is_manager()
      and not ('admin' = any(coalesce(roles, '{}'::text[])))
      and companies && current_user_companies()
    )
    or (id = (select auth.uid()))
  );
