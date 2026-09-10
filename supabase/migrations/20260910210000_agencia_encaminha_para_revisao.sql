-- Agência volta a poder encaminhar entrega para Revisão.
--
-- Correção de rumo pedida pelo Daniel em 10/09/2026: "A agência precisa
-- conseguir encaminhar para revisão. Foi um erro meu ter aprovado."
--
-- O que aconteceu: em 09/09 a policy md_update foi apertada pra que a agência
-- só escrevesse em 'encaminhado_para_agencia' e 'em_producao'. Na prática isso
-- prendeu a Beehave em Em Produção sem nenhum jeito de sinalizar que o
-- trabalho acabou — o time interno só descobriria olhando o quadro. A agência
-- reportou o erro cru de RLS ao tentar mover pra Revisão.
--
-- A policy passa a ser ASSIMÉTRICA, e é isso que faz o encaminhamento ser um
-- caminho só de ida:
--   USING      (linha ANTES) — encaminhado_para_agencia, em_producao.
--                Continua igual: a agência só mexe no que está com ela.
--   WITH CHECK (linha DEPOIS) — as duas acima MAIS revisao.
--                Ela pode empurrar pra Revisão; e como 'revisao' NÃO está no
--                USING, a partir daí o card sai das mãos dela e não muda
--                debaixo de quem está revisando.
--
-- Alternativa considerada e descartada: pôr 'revisao' nas duas listas, o que
-- deixaria a agência também puxar o card de volta e seguir editando durante a
-- revisão. Descartada porque conteúdo mudando embaixo do revisor é pior que a
-- inconveniência de pedir ao Marketing pra devolver. Se o Daniel preferir a
-- versão simétrica, é trocar o USING — o resto da migration não muda.

drop policy if exists md_update on public.marketing_deliverables;

create policy md_update on public.marketing_deliverables
  for update
  using (
    current_user_is_admin()
    OR (current_user_is_marketing() AND (company_ids && current_user_companies()))
    OR ((current_user_roles() && ARRAY['agencia'::text])
        AND stage = ANY (ARRAY['encaminhado_para_agencia'::text, 'em_producao'::text]))
  )
  with check (
    current_user_is_admin()
    OR (current_user_is_marketing() AND (company_ids && current_user_companies()))
    OR ((current_user_roles() && ARRAY['agencia'::text])
        AND stage = ANY (ARRAY['encaminhado_para_agencia'::text, 'em_producao'::text, 'revisao'::text]))
  );

comment on policy md_update on public.marketing_deliverables is
  'Assimétrica de propósito: agência mexe em encaminhado/em_producao (USING) e pode empurrar até revisao (WITH CHECK). Encaminhar pra revisão é só de ida.';
