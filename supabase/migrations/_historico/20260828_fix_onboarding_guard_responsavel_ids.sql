-- CORREÇÃO DE REGRESSÃO (28/08/2026)
--
-- A migration 20260827201715 fez DROP COLUMN responsavel em
-- rh_onboarding_tarefas depois de conferir que nenhuma policy do REPO
-- referenciava a coluna. A conferência estava certa pro repo e ERRADA pra
-- produção: a função de trigger rh_onboarding_tarefas_guard_self_update()
-- existe apenas no banco (nunca foi commitada aqui) e referencia
-- new.responsavel / old.responsavel.
--
-- Em PL/pgSQL o campo de NEW/OLD é resolvido em RUNTIME, então o DROP passou
-- sem erro e a quebra só aparece na execução: qualquer UPDATE que caia no
-- ramo da guarda estoura
--   42703: record "new" has no field "responsavel"
--
-- O ramo só é avaliado quando is_own_colaborador(old.colaborador_id) é
-- verdadeiro E o usuário NÃO é rh/gerente_rh/admin — ou seja, o colaborador
-- comum marcando a própria tarefa de onboarding como concluída. Quem testa
-- como RH nunca vê o erro, e por isso passou despercebido.
--
-- Aqui a guarda é reescrita sobre responsavel_ids (a coluna sucessora),
-- preservando a intenção original: o colaborador só pode mexer no STATUS da
-- própria tarefa, nunca em quem é responsável, prazo, título, dono ou
-- template.
CREATE OR REPLACE FUNCTION public.rh_onboarding_tarefas_guard_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if is_own_colaborador(old.colaborador_id) and not exists (
    select 1 from profiles where profiles.id = auth.uid() and profiles.role = any(array['admin','gerente_rh','rh'])
  ) then
    if new.responsavel_ids is distinct from old.responsavel_ids
       or new.data_limite is distinct from old.data_limite
       or new.titulo is distinct from old.titulo
       or new.colaborador_id is distinct from old.colaborador_id
       or new.template_id is distinct from old.template_id then
      raise exception 'colaborador só pode alterar o status da própria tarefa de onboarding';
    end if;
  end if;
  return new;
end;
$function$;
