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
--                USING, a partir daí a LINHA DA ENTREGA sai das mãos dela.
--
-- Escopo honesto dessa garantia (achado da revisão de segurança): ela vale
-- para a linha de marketing_deliverables, NÃO para os anexos. A policy
-- "Deliverable attachments table delete" em marketing_deliverable_attachments
-- libera a agência sem filtro de etapa, empresa ou fornecedor, então ela ainda
-- consegue apagar a linha de um anexo de card em revisão. É buraco
-- pré-existente, não introduzido aqui, e está registrado para decisão do
-- Daniel — mas não dá pra escrever "não muda debaixo do revisor" sem esta
-- ressalva.
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

-- Buraco fechado a partir da revisão de segurança: o ramo da agência não
-- filtra company_ids em lugar nenhum — decisão consciente de 28/08, quando o
-- filtro de etapa substituiu o de empresa, pra que ela atenda as duas frentes.
-- O efeito colateral é que ela podia REESCREVER company_ids num UPDATE e o
-- card sumia do quadro filtrado do time interno, sem erro nenhum. É a mesma
-- classe de bug que a migration de 28/08 corrigiu na policy irmã
-- (orders_cliente_update, "um cliente externo trocando company_id faria o
-- próprio pedido sumir da fila do time certo").
--
-- Fechado por GATILHO e não por predicado de policy de propósito. Pôr
-- `company_ids && current_user_companies()` no WITH CHECK fecharia o buraco,
-- mas trocaria o alcance da agência: uma entrega de uma 3ª frente parada nas
-- etapas dela passaria a estourar "new row violates row-level security
-- policy" em QUALQUER edição — que é exatamente o erro cru que originou este
-- pedido. O gatilho bloqueia só o que é abuso (trocar a frente) e devolve
-- mensagem em português, deixando o alcance como está.
create or replace function public.marketing_deliverables_guard_agencia_frente()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if (current_user_roles() && ARRAY['agencia'::text])
     and not (current_user_is_admin() or current_user_is_marketing())
     and (new.company_ids is distinct from old.company_ids) then
    raise exception 'A agência não pode alterar a frente (empresa) de uma entrega.';
  end if;
  return new;
end;
$$;

drop trigger if exists marketing_deliverables_agencia_frente on public.marketing_deliverables;
create trigger marketing_deliverables_agencia_frente
  before update of company_ids on public.marketing_deliverables
  for each row execute function public.marketing_deliverables_guard_agencia_frente();
