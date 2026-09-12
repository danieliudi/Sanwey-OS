-- Desfazer contratação: liga o funcionário criado à candidatura que o gerou
-- Mockup "Desistiu antes de começar", aprovado com o Daniel em 12/09/2026.
--
-- POR QUE ESTA COLUNA EXISTE
-- Converter um candidato em funcionário cria uma linha em rh_colaboradores e
-- carimba rh_aplicacoes.hired_at — mas os dois lados nunca ficaram ligados.
-- rh_colaboradores.vaga_id diz de qual VAGA a pessoa veio; numa vaga de 3
-- posições isso aponta para 3 pessoas diferentes e não serve pra dizer QUAL
-- candidatura gerou QUAL funcionário. Sem esse elo, desfazer uma contratação
-- teria que adivinhar por nome/e-mail.
--
-- ON DELETE SET NULL, não CASCADE: apagar a candidatura do funil não pode
-- apagar a ficha de um funcionário. O elo some, a pessoa fica.
--
-- SEM BACKFILL, de propósito. Preencher as fichas antigas exigiria casar por
-- nome/e-mail — exatamente o palpite que esta coluna existe pra eliminar, e
-- um palpite errado ligaria a ficha de uma pessoa à candidatura de outra. As
-- contratações que já aconteceram continuam com aplicacao_id nulo; o
-- front-end cai no reconhecimento por e-mail/nome dentro da mesma vaga e,
-- quando não tem certeza, pede confirmação em vez de escolher sozinho (ver
-- RHRecrutamentoView.jsx, encontrarColaboradorDaCandidatura).
--
-- RLS: nenhuma policy nova. rh_colaboradores já tem RLS ligada e as policies
-- são por linha (rh_colaboradores_rh_access, FOR ALL, roles[] via
-- current_user_has_role) — não existe grant por coluna nessa tabela, então a
-- coluna nova herda exatamente o mesmo controle das demais. Quem já podia
-- ler/editar a ficha passa a ler/editar este campo junto.
--
-- Quem pode desfazer: a MESMA população que já pode converter (qualquer
-- pessoa do RH com permissão de escrita) — decidido com o Daniel 12/09/2026
-- ("mantém"). Nenhuma trava nova de papel aqui, nem no banco nem na tela.

alter table public.rh_colaboradores
  add column if not exists aplicacao_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rh_colaboradores'::regclass
      and conname = 'rh_colaboradores_aplicacao_id_fkey'
  ) then
    alter table public.rh_colaboradores
      add constraint rh_colaboradores_aplicacao_id_fkey
      foreign key (aplicacao_id) references public.rh_aplicacoes(id) on delete set null;
  end if;
end $$;

-- Índice parcial: a esmagadora maioria das fichas não vem de candidatura
-- (importação, cadastro direto), e a única consulta que usa a coluna é
-- "qual ficha veio desta candidatura".
create index if not exists rh_colaboradores_aplicacao_id_idx
  on public.rh_colaboradores (aplicacao_id)
  where aplicacao_id is not null;

comment on column public.rh_colaboradores.aplicacao_id is
  'Candidatura (rh_aplicacoes) que gerou esta ficha, quando a pessoa entrou por recrutamento. Nulo em ficha criada por outro caminho e nas contratações anteriores a 12/09/2026 (sem backfill de propósito — ver a migration).';
