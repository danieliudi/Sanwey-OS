-- A esteira editorial (trackforge-os) publica peça pronta na fila de aprovação,
-- e toda tentativa morre com HTTP 500 desde 01/09/2026.
--
-- Diagnóstico (03/09/2026, pelos logs de produção):
--   GET  ?action=list   → 200  ← a chave autentica, listPendingPieces funciona
--   POST ?action=create → 500  ← 12:29 de hoje
--
-- Não é credencial. O commit d80a0af (01/09) ensinou o gateway a autenticar o
-- agente `esteira` (AGENT_GATEWAY_KEY_ESTEIRA) e a tratar
-- `sugestao_peca_conteudo` na aprovação — mas NENHUMA migration acompanhou.
-- O gateway autentica, monta o insert com `agent_id: 'esteira'`
-- (index.ts:407, derivado de qual secret bateu) e o Postgres recusa, porque
-- 'esteira' não está na lista da restrição. O 500 não aparece nos logs de
-- função porque o catch genérico devolve 500 sem registrar o erro do banco —
-- por isso ninguém percebeu em dois dias.
--
-- Zero linhas de `sugestao_peca_conteudo` em produção é consequência disto,
-- não falta de uso: alguém tentou hoje.
--
-- A segunda violação encontrada no mesmo diagnóstico — trackforge manda
-- `priority: "alta"` e a coluna só aceita low/normal/high/urgent — NÃO é
-- corrigida aqui de propósito. As outras quatro prioridades já são inglês, e
-- aceitar português na mesma coluna deixaria os dois idiomas convivendo.
-- Corrige-se do lado do trackforge ("alta" → "high"), patch entregue junto.
alter table public.agent_actions
  drop constraint if exists agent_actions_agent_id_check;

alter table public.agent_actions
  add constraint agent_actions_agent_id_check
  check (agent_id = any (array[
    'sdr_q'::text, 'scout'::text, 'cadencia'::text,
    'sentinela'::text, 'cross'::text, 'automation'::text,
    'esteira'::text
  ]));
