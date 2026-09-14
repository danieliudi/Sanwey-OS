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
-- QUEM É "MINHA EQUIPE" — dois caminhos, em OU:
--   1. rh_colaboradores.gestor_id aponta para a MINHA ficha. Esta é a
--      definição canônica de hierarquia de RH na plataforma: tem seletor na
--      tela (NovoColaboradorModal / RHFuncionariosView), trava de ciclo no
--      banco e um utilitário único, `equipeDe` em src/utils/rh-hierarquia.js,
--      que o filtro "Só minha equipe" já usa. Esta função espelha aquele
--      predicado, inclusive a exclusão de desligado.
--   2. eu estou em rh_vagas.responsible_ids da vaga que originou a ficha —
--      ser nomeado responsável pela vaga JÁ É a autorização, sem papel por
--      cima. Cobre o período entre a contratação e o RH designar o gestor.
--
-- ⚠ DUAS COISAS QUE EU TINHA ERRADO NA PRIMEIRA VERSÃO, pegas na revisão de
-- segurança desta entrega — ficam escritas porque as duas são fáceis de
-- reintroduzir:
--
--   · Eu usava `profiles.supervisor_id`. Aquele é o supervisor COMERCIAL,
--     que decide escopo de LEAD, e a migration 20260910120000 criou
--     `gestor_id` exatamente para não confundir os dois ("São dois conceitos
--     com o mesmo nome popular; ficam separados de propósito"). Usar
--     supervisor_id aqui faria um supervisor de vendas enxergar RH dos seus
--     vendedores, o gestor designado pelo RH não enxergar nada, e o mesmo
--     UPDATE passaria a mexer em visibilidade de lead E de RH de uma vez.
--
--   · Eu tinha um terceiro caminho por `department` igual. Removido: era o
--     único que autorizava por texto livre batendo em vez de designação
--     explícita, não tinha recorte por empresa/frente (um "Comercial" da
--     Resibag e um da Sanwey são a mesma string), e era o único que ampliava
--     sozinho conforme o RH preenchesse campo. Designação explícita é mais
--     trabalho de cadastro e não tem esse tipo de surpresa.
--
-- ⚠ LIMITAÇÃO MEDIDA, NÃO SUPOSTA (produção, 14/09/2026): gestor_id está
-- vazio em 15 de 15 fichas e vaga_id também (as fichas vieram da importação
-- por planilha, não de recrutamento). Ou seja: esta função está correta e
-- devolve ZERO linha para todo mundo até o RH preencher o campo "Gestor" na
-- ficha — que é um seletor que já existe na tela, não um campo novo. Isso
-- está dito NA TELA (ver RHOnboardingView) em vez de virar um quadro vazio
-- mudo, que seria indistinguível de "não tem ninguém em onboarding".
--
-- ⚠ ETAPA TERMINAL FICA DE FORA. Medido no mesmo dia: 13 das 15 fichas estão
-- em "removido" (terminal), etapa que o próprio board do RH não mostra. Sem
-- este filtro, 87% do que o gestor veria sob o título "minha equipe em
-- onboarding" seria gente que já saiu do quadro — e "removido" carrega um
-- sinal que não é inócuo (contratação cancelada, cadastro duplicado).

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
     -- Só quem está de fato NO quadro: etapa não terminal, mesmo critério que
     -- RHOnboardingView usa pra montar as colunas do Kanban do RH.
     and exists (
       select 1 from public.rh_pipeline_stages s
        where s.domain = 'onboarding'
          and s.stage_key = c.onboarding_stage
          and s.terminal = false
     )
     and (
       -- 1. a ficha aponta pra mim como gestor (rh_colaboradores.gestor_id)
       exists (
         select 1 from public.rh_colaboradores g
          where g.id = c.gestor_id
            and g.profile_id = (select auth.uid())
       )
       -- 2. sou responsável pela vaga que originou a ficha
       or exists (
         select 1 from public.rh_vagas v
          where v.id = c.vaga_id
            and (select auth.uid()) = any (v.responsible_ids)
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
  'Onboarding da equipe do usuário logado, somente leitura e com lista de colunas fixa (sem salário, documento, CPF ou custom_fields). Equipe = ficha cujo gestor_id aponta pra ele (a hierarquia de RH, mesma de equipeDe) OU ficha vinda de vaga em que ele é responsável. Só etapas não terminais. Ver 20260914110000.';
