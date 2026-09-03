-- Reverte a fila de prospects criada horas antes, em 20260903120000.
--
-- POR QUE: ela nunca deveria ter existido. A premissa que a justificou estava
-- errada — eu afirmei que aprovar um prospect "não levava a lugar nenhum",
-- depois de conferir `leads` e `clients` por CNPJ e não achar. Nunca conferi a
-- tabela certa.
--
-- O que realmente acontece, e sempre aconteceu: `agent-gateway/index.ts:257`
-- trata `sugestao_prospect` na aprovação e grava em `prospect_seeds`. Em
-- produção há 57 seeds, 24 delas com source='agente_pesquisa_mercado' —
-- exatamente os 24 prospects aprovados. E `ProspectSuggestions.jsx`, montado
-- em `ExplorerView.jsx:203`, já lista essas seeds dentro do Explorador com
-- `onAddLead` — que é o "puxar da fila" que a migration revertida aqui
-- reimplementou do zero.
--
-- Ou seja: a migration de 20260903120000 criou uma SEGUNDA caixa de entrada
-- para a mesma decisão. É literalmente o erro contra o qual o comentário do
-- próprio trackforge alerta em src/lib/crm.ts ("criar uma segunda fila daria
-- duas caixas de entrada para a mesma decisão").
--
-- Nada é perdido ao remover: a tela que consumiria isto nunca foi construída,
-- e a função nunca foi chamada. O que sai é uma superfície SECURITY DEFINER
-- em produção sem nenhum consumidor.

drop function if exists public.puxar_prospect_sugerido(uuid);
drop policy if exists agent_actions_seller_prospect_read on public.agent_actions;
