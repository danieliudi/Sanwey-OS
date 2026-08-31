-- QA multi-lente da "Prestação de contas" (10/08/2026) achou 2 furos reais
-- na trava da decisão 3 ("nada de puxar despesa de volta, nem por baixo dos
-- panos via API direta" — ver comentário de 20260831_crm_viagem_prestacoes_contas.sql):
--
-- 1. A policy de UPDATE de crm_viagem_prestacoes permitia status IN
--    ('rascunho','enviada') tanto em USING quanto em WITH CHECK — ou seja, o
--    PRÓPRIO vendedor conseguia (via chamada Supabase direta, não pela UI)
--    regredir a própria prestação de 'enviada' de volta pra 'rascunho'
--    enquanto o gestor ainda estava decidindo, reabrindo a porta do trigger
--    de validação (que só libera vincular/desvincular despesa quando a
--    prestação está 'rascunho') pra editar o lote sem o gestor saber, e
--    reenviar depois sem deixar rastro.
-- 2. A policy de DELETE de crm_viagem_despesas (herdada sem alteração desde
--    20260706/20260725) nunca checava prestacao_id nem o status da
--    prestação-mãe — o vendedor podia excluir direto (não só editar) uma
--    despesa pendente/rejeitada mesmo já fazendo parte de uma prestação
--    enviada, esvaziando o lote em revisão sem nenhum trigger barrar (só
--    existe recômputo em UPDATE, nunca em DELETE). Levado ao limite, apagar
--    todas as despesas de uma prestação "enviada" trava ela pra sempre
--    nesse status: "Aprovar/Rejeitar tudo" afeta 0 linhas, o trigger de
--    recômputo nunca dispara.
--
-- Fix 1: aperta USING da policy de UPDATE pro vendedor só conseguir tocar a
-- prestação enquanto ela AINDA está 'rascunho' (WITH CHECK continua
-- aceitando o resultado 'rascunho' ou 'enviada' — é o que permite o envio
-- em si, rascunho -> enviada; mas como USING já barra qualquer prestação
-- que não esteja mais em rascunho, o caminho enviada -> rascunho nunca é
-- alcançado por essa branch).
DROP POLICY IF EXISTS "crm_viagem_prestacoes_update" ON public.crm_viagem_prestacoes;
CREATE POLICY "crm_viagem_prestacoes_update" ON public.crm_viagem_prestacoes
  FOR UPDATE
  USING (
    (vendedor_id = auth.uid() AND status = 'rascunho')
    OR current_user_manages_viagem_of(vendedor_id)
  )
  WITH CHECK (
    (vendedor_id = auth.uid() AND status IN ('rascunho','enviada'))
    OR current_user_manages_viagem_of(vendedor_id)
  );

-- Fix 2: trigger novo, BEFORE DELETE — mesma regra do guard de
-- INSERT/UPDATE (crm_viagem_despesas_validate_prestacao), só que pra
-- exclusão: despesa vinculada a uma prestação que já não é mais rascunho
-- não pode ser apagada, dono ou não.
CREATE OR REPLACE FUNCTION public.crm_viagem_despesas_block_delete_prestada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_status text;
BEGIN
  IF OLD.prestacao_id IS NOT NULL THEN
    SELECT status INTO v_status FROM public.crm_viagem_prestacoes WHERE id = OLD.prestacao_id;
    IF v_status IS DISTINCT FROM 'rascunho' THEN
      RAISE EXCEPTION 'Não é possível excluir uma despesa que já faz parte de uma prestação de contas enviada.';
    END IF;
  END IF;
  RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION public.crm_viagem_despesas_block_delete_prestada() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS crm_viagem_despesas_block_delete_prestada_trg ON public.crm_viagem_despesas;
CREATE TRIGGER crm_viagem_despesas_block_delete_prestada_trg
  BEFORE DELETE ON public.crm_viagem_despesas
  FOR EACH ROW EXECUTE FUNCTION public.crm_viagem_despesas_block_delete_prestada();
