-- Achado F-15 (ALTO) da auditoria funcional de 19/08/2026: um vendedor sem
-- subordinados enxergava só o PRÓPRIO perfil em `profiles` (roster de 1
-- pessoa). Como @menção, escolha de responsável, AvatarStack e
-- transferência de lead consomem todos o mesmo roster (useProfiles), isso
-- desligava os quatro recursos silenciosamente — sem erro, as listas só
-- ficavam vazias.
--
-- Acrescenta um ramo a profiles_select: vendedor vê o roster (nome, cargo,
-- avatar, e-mail — mesmas colunas já visíveis pra qualquer colega hoje) dos
-- colegas da MESMA empresa. Não expõe nada que rh_colaboradores já não
-- torne visível ao RH por outro caminho, e não toca em nenhuma coluna
-- verdadeiramente sensível (salário/CPF vivem só em rh_colaboradores, que
-- continua com sua própria policy restrita a RH/admin).

drop policy if exists profiles_select on public.profiles;
create policy profiles_select
  on public.profiles
  for select
  using (
    (id = auth.uid())
    or ('admin' = any(current_user_roles()))
    or (('gerente' = any(current_user_roles())) and (companies && current_user_companies()))
    or ((current_user_roles() && array['marketing','gerente_marketing']::text[]) and (roles && array['marketing','gerente_marketing']::text[]))
    or ((current_user_roles() && array['rh','gerente_rh']::text[]) and (roles && array['rh','gerente_rh']::text[]))
    or ((current_user_roles() && array['agencia']::text[]) and (roles && array['marketing','gerente_marketing']::text[]))
    or ((current_user_roles() && array['marketing','gerente_marketing']::text[]) and (roles && array['agencia']::text[]))
    or ((current_user_roles() && array['vendedor']::text[]) and ((id)::text = any(current_user_subordinate_ids())))
    or ((current_user_roles() && array['vendedor']::text[]) and (companies && current_user_companies()))
  );
