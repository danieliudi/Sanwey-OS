-- Reporte de bug sem atrito (mockup aprovado pelo Daniel, 02/09/2026):
-- botão "Reportar isso" na própria tela de erro, atalho fixo na TopBar, e
-- contexto técnico anexado sozinho — em vez de a pessoa sair da tela, achar
-- a Central de Bugs e reconstruir de memória o que aconteceu.
--
-- Duas colunas só. `contexto` guarda tudo num jsonb em vez de uma coluna por
-- campo de propósito: o que é útil coletar vai mudar (hoje rota/navegador/
-- últimos erros, amanhã talvez outra coisa), e cada mudança dessas viraria
-- migration nova. Nada aqui é consultado por filtro — é leitura humana na
-- triagem — então jsonb não custa índice nenhum.
alter table public.bug_reports
  add column if not exists contexto jsonb,
  add column if not exists origem   text;

-- `origem` responde uma pergunta de produto que hoje não tem resposta: os
-- reports estão vindo da tela de erro (bug que quebra) ou do atalho (bug
-- silencioso)? Sem isso não dá pra saber se as camadas novas pegaram.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bug_reports_origem_check'
  ) then
    alter table public.bug_reports
      add constraint bug_reports_origem_check
      check (origem is null or origem in ('tela-de-erro', 'atalho', 'central'));
  end if;
end $$;

comment on column public.bug_reports.contexto is
  'Contexto técnico capturado automaticamente no momento do report: rota, ação, versão do app, navegador, empresa e últimos erros de console. Substitui o print manual. Nunca contém conteúdo de tela — ver decisão de 02/09/2026 sobre não capturar screenshot (RH mostra salário/CPF).';

comment on column public.bug_reports.origem is
  'De onde o report partiu: "tela-de-erro" (botão no ErrorBoundary), "atalho" (ícone da TopBar) ou "central" (formulário da Central de Bugs). Nulo nos reports anteriores a 02/09/2026.';

-- RLS: nenhuma policy nova. As duas colunas entram nas policies que já
-- existem (bug_reports_insert_own / _select_own / _admin_all), e os GRANTs
-- de bug_reports são de tabela, não de coluna (conferido antes de aplicar:
-- 19/19 colunas pra cada grantee), então as novas herdam sem GRANT extra.
