-- Vaga para mais de uma pessoa
-- Mockup "Vaga para mais de uma pessoa", aprovado com o Daniel em 11/09/2026.
--
-- POR QUE COLUNA E NÃO custom_fields (rule 5 do CLAUDE.md manda perguntar):
-- rh_vagas.custom_fields já existe e caberia o número, mas ali ele seria só
-- texto guardado — a tela precisa CONTAR em cima dele (barra de progresso,
-- "1 de 3 contratados", etiqueta sugerindo encerrar quando fecha). Número com
-- lógica em cima é coluna de verdade.
--
-- COMPATIBILIDADE: default 1 e NOT NULL — toda vaga que já existe vira uma
-- vaga de 1 posição, que é exatamente o que ela sempre foi. Nenhuma tela
-- muda de comportamento para elas (o front só mostra barra/contador quando
-- positions > 1).
--
-- O QUE ESTA MIGRATION NÃO FAZ, de propósito:
--   · não encerra vaga sozinha ao bater o número — encerrar continua sendo
--     decisão de gente (o RH pode manter aberta pra repor desistência antes
--     do primeiro dia);
--   · não fecha o link público de candidatura quando as posições enchem —
--     decidido com o Daniel: continua recebendo enquanto a vaga não for
--     encerrada.
--
-- RLS: nenhuma policy nova. A coluna entra numa tabela que já tem RLS e cujas
-- policies são por linha (rh_vagas), não por coluna — quem já podia ler/editar
-- a vaga passa a ler/editar este campo junto, que é o comportamento desejado.

alter table public.rh_vagas
  add column if not exists positions integer not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.rh_vagas'::regclass
      and conname = 'rh_vagas_positions_check'
  ) then
    alter table public.rh_vagas
      add constraint rh_vagas_positions_check check (positions >= 1 and positions <= 999);
  end if;
end $$;

comment on column public.rh_vagas.positions is
  'Quantas pessoas serão contratadas nesta vaga. 1 = caso normal. A contagem de preenchimento na tela usa rh_aplicacoes.hired_at (a conversão em funcionário), não a aprovação no processo.';
