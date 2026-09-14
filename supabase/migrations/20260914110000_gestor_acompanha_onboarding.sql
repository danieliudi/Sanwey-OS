-- Gestor acompanha o onboarding da própria equipe (somente leitura)
--
-- TRAVA 03, reportada pelo Daniel em 14/09/2026: "Integração sempre acontece,
-- mas não tem aonde gestor acompanhar que etapa está, e tem que ficar
-- perguntando." Conferido: todo colaborador já tem a tela de Onboarding no
-- menu, mas quem não é do RH enxerga o PRÓPRIO checklist — a RLS de
-- rh_colaboradores devolve zero linha pra ele. O gestor literalmente não tem
-- onde olhar, e perguntar é a única saída que sobrou.
--
-- POR QUE UMA FUNÇÃO E NÃO UMA POLICY NOVA
-- Uma policy de SELECT em rh_colaboradores liberaria a LINHA INTEIRA: salário,
-- CPF, RG, endereço, dados de desligamento. O gestor precisa de uma coisa só —
-- em que etapa a pessoa está. Função SECURITY DEFINER com lista de colunas
-- fixa é o único jeito de entregar isso sem entregar o resto, e é o mesmo
-- padrão que get_my_colaborador() já usa pro autoatendimento.
--
-- O QUE ELA DEVOLVE: nome, cargo, departamento, etapa, quando mudou de etapa,
-- data de admissão e a vaga de origem. NADA de salário, documento, CPF,
-- endereço, custom_fields ou desligamento. Só leitura — não existe caminho de
-- escrita nenhum criado aqui.
--
-- QUEM É "MINHA EQUIPE" — três caminhos, em OU:
--   1. profiles.supervisor_id aponta pra mim (a hierarquia que a plataforma
--      já modela, usada por current_user_subordinate_ids no Comercial);
--   2. eu estou em rh_vagas.responsible_ids da vaga que originou a ficha —
--      ser nomeado responsável pela vaga JÁ É a autorização, não precisa de
--      papel nenhum por cima;
--   3. mesmo departamento que o meu, E eu tenho papel de gestor. Este é o
--      único dos três que precisa da checagem de papel: sem ela, todo colega
--      de departamento passaria a ver o onboarding dos outros, que é uma
--      ampliação de privacidade que ninguém pediu.
--
-- ⚠ LIMITAÇÃO MEDIDA, NÃO SUPOSTA (produção, 14/09/2026): os três sinais
-- estão VAZIOS hoje. profiles.supervisor_id = 0 de 15 · profiles.department =
-- 0 de 15 · rh_colaboradores.department = 0 de 15 · rh_colaboradores.vaga_id =
-- 0 de 15 (as 15 fichas vieram da importação por planilha, não de
-- recrutamento). Ou seja: esta função está correta e devolve ZERO linha pra
-- todo mundo até alguém preencher supervisor, departamento, ou até a próxima
-- contratação entrar por uma vaga com responsável. Isso está dito na tela
-- (ver RHOnboardingView) em vez de virar um quadro vazio sem explicação —
-- que seria indistinguível de "não tem ninguém em onboarding".

create or replace function public.get_onboarding_da_minha_equipe()
returns table (
  id                          uuid,
  full_name                   text,
  job_title                   text,
  department                  text,
  onboarding_stage            text,
  onboarding_stage_changed_at timestamptz,
  admission_date              date,
  vaga_id                     uuid
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select c.id, c.full_name, c.job_title, c.department,
         c.onboarding_stage, c.onboarding_stage_changed_at,
         c.admission_date, c.vaga_id
    from public.rh_colaboradores c
   where (select auth.uid()) is not null
     and c.employee_status <> 'desligado'
     and (
       -- 1. subordinado direto
       exists (
         select 1 from public.profiles p
          where p.id = c.profile_id
            and p.supervisor_id = (select auth.uid())
       )
       -- 2. responsável pela vaga que originou a ficha
       or exists (
         select 1 from public.rh_vagas v
          where v.id = c.vaga_id
            and (select auth.uid()) = any (v.responsible_ids)
       )
       -- 3. mesmo departamento E eu sou gestor
       or (
         coalesce(c.department, '') <> ''
         and exists (
           select 1 from public.profiles p
            where p.id = (select auth.uid())
              and coalesce(p.department, '') = c.department
         )
         and (public.current_user_is_manager() or public.current_user_is_marketing_manager())
       )
     )
   order by c.full_name;
$$;

-- A armadilha da seção 3.1 do CLAUDE.md: o Supabase mantém um
-- ALTER DEFAULT PRIVILEGES que concede EXECUTE a `anon` e `authenticated` em
-- toda função nova do schema public, e esse grant é NOMINAL — um
-- `revoke ... from public` não encosta nele e a função continua aberta pra
-- visitante anônimo. Por isso os dois papéis são nomeados no revoke abaixo,
-- e só `authenticated` é reconcedido. Conferir depois de aplicar com
-- has_function_privilege('anon', oid, 'EXECUTE'), nunca acreditando no revoke.
revoke all on function public.get_onboarding_da_minha_equipe() from public, anon, authenticated;
grant execute on function public.get_onboarding_da_minha_equipe() to authenticated;

comment on function public.get_onboarding_da_minha_equipe() is
  'Onboarding da equipe do usuário logado, somente leitura e com lista de colunas fixa (sem salário, documento, CPF ou custom_fields). Equipe = subordinado direto (profiles.supervisor_id) OU ficha vinda de vaga em que ele é responsável OU mesmo departamento sendo ele gestor. Ver 20260914110000.';
