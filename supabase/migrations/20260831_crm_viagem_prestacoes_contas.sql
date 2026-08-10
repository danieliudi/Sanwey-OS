-- Prestação de contas (Viagens & Despesas) — spec aprovada com o Daniel
-- 10/08/2026 (artifact "Prestação de contas — spec"), a partir da comparação
-- com o Zoho Expense: hoje cada despesa é decidida sozinha pelo gestor; o
-- Zoho agrupa várias num "Relatório" e decide o lote de uma vez. Aqui o
-- nome escolhido foi "Prestação de contas" (evita colidir com a aba
-- "Relatórios" que já existe em CRMViagensRelatoriosView, que é
-- analítica/BI e não muda em nada).
--
-- Decisões do Daniel (mesma conversa):
-- 1. Despesa avulsa (fora de prestação) continua podendo ser aprovada
--    direto pelo gestor — não é obrigatório passar por prestação.
-- 2. Prestação pode ser por mês inteiro OU por viagem específica
--    ("sub-prestação" — `registro_id` abaixo, nullable).
-- 3. Puxar uma despesa de volta depois de a prestação já ter sido enviada
--    — Daniel quer pensar no trade-off. Fica travado por enquanto (trigger
--    abaixo), sem UI nenhuma pra isso nesta rodada.
-- 4. "Paga" continua manual (ação explícita do gestor), sem integração
--    automática com folha/financeiro.
--
-- Achado ao tentar aplicar esta migration: já existia uma tabela
-- `crm_viagem_prestacoes` viva no banco (aplicada em 07/08/2026, registrada
-- em supabase_migrations.schema_migrations como "20260807140348" — mas SEM
-- arquivo .sql correspondente neste repositório, um gap real de sincronismo
-- banco↔git). Schema bem mais simples (id/titulo/vendedor_id/enviado_em),
-- zero linhas, zero referência em qualquer hook ou tela — esboço abandonado
-- antes de qualquer uso real. Confirmado com o Daniel: substitui do zero
-- pelo desenho completo abaixo, em vez de adaptar o esboço.
--
-- Essa investigação também pegou um erro real que eu ia cometer: minha
-- primeira tentativa desta migration copiou o predicado de RLS
-- `role IN ('admin','gerente')` do arquivo de criação original
-- (20260706_crm_viagens_reembolsos.sql) — só que esse predicado já foi
-- CORRIGIDO por 20260724_scope_crm_viagens_by_company.sql (vazava
-- viagem/despesa entre empresas do grupo e ignorava cargo adicional). O
-- arquivo antigo continua no histórico do jeito que aplicou na hora (nunca
-- se edita migration já aplicada), mas o predicado ATUAL em produção usa
-- `current_user_manages_viagem_of(vendedor_id)` — é esse que a tabela nova
-- usa abaixo, não o do arquivo original.
DROP TABLE IF EXISTS public.crm_viagem_prestacoes CASCADE;

-- 1. Tabela de prestações
CREATE TABLE public.crm_viagem_prestacoes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  registro_id    uuid        REFERENCES public.crm_viagem_registros(id) ON DELETE SET NULL,
  titulo         text        NOT NULL,
  mes_referencia date        NOT NULL,
  status         text        NOT NULL DEFAULT 'rascunho'
                   CHECK (status IN ('rascunho','enviada','aprovada','rejeitada','parcial','paga')),
  enviada_em     timestamptz,
  decidida_em    timestamptz,
  decidida_por   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX crm_viagem_prestacoes_vendedor_mes_idx ON public.crm_viagem_prestacoes (vendedor_id, mes_referencia);
CREATE INDEX crm_viagem_prestacoes_status_idx ON public.crm_viagem_prestacoes (status);
CREATE INDEX crm_viagem_prestacoes_registro_idx ON public.crm_viagem_prestacoes (registro_id);

ALTER TABLE public.crm_viagem_prestacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_viagem_prestacoes_read" ON public.crm_viagem_prestacoes
  FOR SELECT
  USING (vendedor_id = auth.uid() OR current_user_manages_viagem_of(vendedor_id));

CREATE POLICY "crm_viagem_prestacoes_insert" ON public.crm_viagem_prestacoes
  FOR INSERT
  WITH CHECK (
    (vendedor_id = auth.uid() AND status = 'rascunho')
    OR current_user_manages_viagem_of(vendedor_id)
  );

-- Vendedor mexe na própria prestação enquanto ela ainda não foi decidida
-- (rascunho ou enviada) — mas nunca consegue gravar um status de decisão
-- (aprovada/rejeitada/parcial/paga) nessa branch: isso fecha a porta de
-- self-approval, só quem cai no branch de current_user_manages_viagem_of
-- decide de verdade.
CREATE POLICY "crm_viagem_prestacoes_update" ON public.crm_viagem_prestacoes
  FOR UPDATE
  USING (
    (vendedor_id = auth.uid() AND status IN ('rascunho','enviada'))
    OR current_user_manages_viagem_of(vendedor_id)
  )
  WITH CHECK (
    (vendedor_id = auth.uid() AND status IN ('rascunho','enviada'))
    OR current_user_manages_viagem_of(vendedor_id)
  );

CREATE POLICY "crm_viagem_prestacoes_delete" ON public.crm_viagem_prestacoes
  FOR DELETE
  USING (
    (vendedor_id = auth.uid() AND status = 'rascunho')
    OR current_user_manages_viagem_of(vendedor_id)
  );

CREATE OR REPLACE FUNCTION public.crm_viagem_prestacoes_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER crm_viagem_prestacoes_updated_at
  BEFORE UPDATE ON public.crm_viagem_prestacoes
  FOR EACH ROW EXECUTE FUNCTION public.crm_viagem_prestacoes_set_updated_at();

-- 2. Vínculo despesa -> prestação (nullable: null = despesa solta, decidida
--    direto pelo gestor como já era antes desta migration). A coluna em si
--    já existia (mesmo esboço órfão de 07/08) — só falta re-garantir a FK,
--    que o DROP TABLE CASCADE acima removeu junto com a tabela antiga.
ALTER TABLE public.crm_viagem_despesas
  ADD COLUMN IF NOT EXISTS prestacao_id uuid;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crm_viagem_despesas_prestacao_id_fkey'
  ) THEN
    ALTER TABLE public.crm_viagem_despesas
      ADD CONSTRAINT crm_viagem_despesas_prestacao_id_fkey
      FOREIGN KEY (prestacao_id) REFERENCES public.crm_viagem_prestacoes(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS crm_viagem_despesas_prestacao_idx ON public.crm_viagem_despesas (prestacao_id);

-- 3. Guarda de integridade: uma despesa só entra numa prestação do próprio
--    dono, só enquanto ela ainda está em rascunho, e não sai/troca de
--    prestação depois que a prestação de origem já foi enviada — opera a
--    decisão 3 em aberto (nada de "puxar de volta" ainda, nem por baixo dos
--    panos via API direta).
CREATE OR REPLACE FUNCTION public.crm_viagem_despesas_validate_prestacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_old_status text;
  v_new_vendedor uuid;
  v_new_status text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.prestacao_id IS NOT NULL AND NEW.prestacao_id IS DISTINCT FROM OLD.prestacao_id THEN
    SELECT status INTO v_old_status FROM public.crm_viagem_prestacoes WHERE id = OLD.prestacao_id;
    IF v_old_status IS DISTINCT FROM 'rascunho' THEN
      RAISE EXCEPTION 'Não é possível remover ou trocar a despesa de uma prestação já enviada.';
    END IF;
  END IF;

  IF NEW.prestacao_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.prestacao_id IS DISTINCT FROM NEW.prestacao_id) THEN
    SELECT vendedor_id, status INTO v_new_vendedor, v_new_status FROM public.crm_viagem_prestacoes WHERE id = NEW.prestacao_id;
    IF v_new_vendedor IS NULL THEN
      RAISE EXCEPTION 'Prestação de contas não encontrada.';
    END IF;
    IF v_new_vendedor <> NEW.vendedor_id THEN
      RAISE EXCEPTION 'A prestação de contas pertence a outro vendedor.';
    END IF;
    IF v_new_status <> 'rascunho' THEN
      RAISE EXCEPTION 'Só é possível adicionar despesa a uma prestação em rascunho.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.crm_viagem_despesas_validate_prestacao() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS crm_viagem_despesas_validate_prestacao_trg ON public.crm_viagem_despesas;
CREATE TRIGGER crm_viagem_despesas_validate_prestacao_trg
  BEFORE INSERT OR UPDATE ON public.crm_viagem_despesas
  FOR EACH ROW EXECUTE FUNCTION public.crm_viagem_despesas_validate_prestacao();

-- 4. Recomputa o status da prestação-mãe sempre que uma despesa dela é
--    decidida — some despesa pendente ainda? fica "enviada". Todas
--    aprovadas? "aprovada". Todas rejeitadas? "rejeitada". Mistura?
--    "parcial". "paga" fica de fora de propósito (ação manual explícita,
--    ver decisão 4 acima) — só mexe enquanto a prestação está "enviada".
CREATE OR REPLACE FUNCTION public.crm_viagem_prestacoes_recompute_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_status text;
  v_pendentes int;
  v_aprovados int;
  v_rejeitados int;
  v_total int;
BEGIN
  IF NEW.prestacao_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.status_reembolso IS NOT DISTINCT FROM OLD.status_reembolso THEN RETURN NEW; END IF;

  SELECT status INTO v_status FROM public.crm_viagem_prestacoes WHERE id = NEW.prestacao_id;
  IF v_status IS DISTINCT FROM 'enviada' THEN RETURN NEW; END IF;

  SELECT
    count(*) FILTER (WHERE status_reembolso = 'pendente'),
    count(*) FILTER (WHERE status_reembolso = 'aprovado'),
    count(*) FILTER (WHERE status_reembolso = 'rejeitado'),
    count(*)
  INTO v_pendentes, v_aprovados, v_rejeitados, v_total
  FROM public.crm_viagem_despesas WHERE prestacao_id = NEW.prestacao_id;

  IF v_pendentes > 0 THEN
    RETURN NEW;
  ELSIF v_aprovados = v_total THEN
    UPDATE public.crm_viagem_prestacoes SET status = 'aprovada', decidida_em = now(), decidida_por = auth.uid() WHERE id = NEW.prestacao_id;
  ELSIF v_rejeitados = v_total THEN
    UPDATE public.crm_viagem_prestacoes SET status = 'rejeitada', decidida_em = now(), decidida_por = auth.uid() WHERE id = NEW.prestacao_id;
  ELSE
    UPDATE public.crm_viagem_prestacoes SET status = 'parcial', decidida_em = now(), decidida_por = auth.uid() WHERE id = NEW.prestacao_id;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.crm_viagem_prestacoes_recompute_status() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS crm_viagem_despesas_recompute_prestacao_trg ON public.crm_viagem_despesas;
CREATE TRIGGER crm_viagem_despesas_recompute_prestacao_trg
  AFTER UPDATE ON public.crm_viagem_despesas
  FOR EACH ROW EXECUTE FUNCTION public.crm_viagem_prestacoes_recompute_status();
