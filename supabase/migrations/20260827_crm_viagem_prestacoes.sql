-- Prestação de contas em lote (Viagens & Despesas, Comercial): o vendedor
-- agrupa várias despesas do mês num "envelope" (crm_viagem_prestacoes) e
-- manda pro gestor decidir de uma vez, em vez de aprovação despesa-por-
-- despesa avulsa. Nome "Prestação de contas" — não "Relatório" — decisão
-- explícita do Daniel: já existe uma aba "Relatórios" (analytics, CSV,
-- gráficos) em CRMViagensRelatoriosView.jsx, completamente diferente disso.
--
-- Estado da prestação é só `enviado_em` (nullable): NULL = rascunho, editável
-- pelo vendedor; timestamp = enviada, travada pro vendedor, só o gestor mexe
-- dali em diante. Deliberadamente sem coluna de status separada — um único
-- timestamp nullable já cobre as duas fases.

CREATE TABLE public.crm_viagem_prestacoes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      text        NOT NULL,
  vendedor_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enviado_em  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX crm_viagem_prestacoes_vendedor_idx ON public.crm_viagem_prestacoes (vendedor_id);

ALTER TABLE public.crm_viagem_prestacoes ENABLE ROW LEVEL SECURITY;

-- Mesmo predicado de crm_viagem_despesas/crm_viagem_registros
-- (20260724_scope_crm_viagens_by_company.sql), reaproveitando
-- current_user_manages_viagem_of — não um modelo de permissão novo.
CREATE POLICY "crm_viagem_prestacoes_read" ON public.crm_viagem_prestacoes
  FOR SELECT
  USING (vendedor_id = auth.uid() OR current_user_manages_viagem_of(vendedor_id));

-- INSERT espelha crm_viagem_despesas_insert (permite o gestor criar em nome
-- do vendedor), não crm_viagem_registros_insert (mais estrito) — prestação é
-- só um envelope de despesas, a irmã mais próxima aqui é despesas.
CREATE POLICY "crm_viagem_prestacoes_insert" ON public.crm_viagem_prestacoes
  FOR INSERT
  WITH CHECK (vendedor_id = auth.uid() OR current_user_manages_viagem_of(vendedor_id));

-- Update/Delete: o vendedor só mexe na própria prestação enquanto ainda é
-- rascunho (enviado_em IS NULL) — depois de enviada, fica travada pro
-- vendedor ("fica travada pro vendedor" do mockup aprovado), só o gestor
-- decide dali em diante.
CREATE POLICY "crm_viagem_prestacoes_update" ON public.crm_viagem_prestacoes
  FOR UPDATE
  USING (
    (vendedor_id = auth.uid() AND enviado_em IS NULL)
    OR current_user_manages_viagem_of(vendedor_id)
  )
  WITH CHECK (
    (vendedor_id = auth.uid() AND enviado_em IS NULL)
    OR current_user_manages_viagem_of(vendedor_id)
  );

CREATE POLICY "crm_viagem_prestacoes_delete" ON public.crm_viagem_prestacoes
  FOR DELETE
  USING (
    (vendedor_id = auth.uid() AND enviado_em IS NULL)
    OR current_user_manages_viagem_of(vendedor_id)
  );

CREATE OR REPLACE FUNCTION public.crm_viagem_prestacoes_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER crm_viagem_prestacoes_updated_at
  BEFORE UPDATE ON public.crm_viagem_prestacoes
  FOR EACH ROW EXECUTE FUNCTION public.crm_viagem_prestacoes_set_updated_at();

-- Despesa avulsa (sem prestação) continua funcionando exatamente como hoje —
-- coluna nullable, ON DELETE SET NULL pra não arrastar despesas junto se a
-- prestação for apagada.
ALTER TABLE public.crm_viagem_despesas
  ADD COLUMN prestacao_id uuid REFERENCES public.crm_viagem_prestacoes(id) ON DELETE SET NULL;

CREATE INDEX crm_viagem_despesas_prestacao_idx ON public.crm_viagem_despesas (prestacao_id);

-- Limite de alerta por categoria (Decisão 3 do mockup aprovado): substitui a
-- constante flat COMPROVANTE_OBRIGATORIO_ACIMA_DE por um valor configurável
-- por categoria, com a constante como fallback quando a categoria não tem
-- limite próprio (NULL).
ALTER TABLE public.crm_viagem_categorias
  ADD COLUMN limite_alerta numeric;

update public.crm_viagem_categorias set limite_alerta = 40  where nome = 'Alimentação';
update public.crm_viagem_categorias set limite_alerta = 250 where nome = 'Combustível';
update public.crm_viagem_categorias set limite_alerta = 350 where nome = 'Hospedagem';
update public.crm_viagem_categorias set limite_alerta = 80  where nome = 'Transporte';
-- Pedágio e Outros ficam sem limite (limite_alerta NULL) — caem no padrão da constante

-- Trava de edição pós-envio: uma vez que a prestação foi enviada
-- (enviado_em IS NOT NULL), o vendedor não pode mais inserir/editar/apagar
-- as despesas dela, mesmo que ainda estejam 'pendente' (o gestor ainda não
-- decidiu) — só o gestor mexe dali em diante. Despesa avulsa
-- (prestacao_id IS NULL) ou de prestação ainda rascunho continua 100%
-- inalterada. Cláusula do gestor (current_user_manages_viagem_of) intocada
-- nas três policies — é o gestor quem decide despesas de uma prestação
-- enviada, esse é o objetivo de enviar.
DROP POLICY IF EXISTS "crm_viagem_despesas_insert" ON public.crm_viagem_despesas;
CREATE POLICY "crm_viagem_despesas_insert" ON public.crm_viagem_despesas
  FOR INSERT
  WITH CHECK (
    (
      vendedor_id = auth.uid() AND status_reembolso = 'pendente'
      AND (prestacao_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.crm_viagem_prestacoes p
        WHERE p.id = crm_viagem_despesas.prestacao_id AND p.enviado_em IS NOT NULL
      ))
    )
    OR current_user_manages_viagem_of(vendedor_id)
  );

DROP POLICY IF EXISTS "crm_viagem_despesas_update" ON public.crm_viagem_despesas;
CREATE POLICY "crm_viagem_despesas_update" ON public.crm_viagem_despesas
  FOR UPDATE
  USING (
    (
      vendedor_id = auth.uid() AND status_reembolso = 'pendente'
      AND (prestacao_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.crm_viagem_prestacoes p
        WHERE p.id = crm_viagem_despesas.prestacao_id AND p.enviado_em IS NOT NULL
      ))
    )
    OR current_user_manages_viagem_of(vendedor_id)
  )
  WITH CHECK (
    (
      vendedor_id = auth.uid() AND status_reembolso = 'pendente'
      AND (prestacao_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.crm_viagem_prestacoes p
        WHERE p.id = crm_viagem_despesas.prestacao_id AND p.enviado_em IS NOT NULL
      ))
    )
    OR current_user_manages_viagem_of(vendedor_id)
  );

DROP POLICY IF EXISTS "crm_viagem_despesas_delete" ON public.crm_viagem_despesas;
CREATE POLICY "crm_viagem_despesas_delete" ON public.crm_viagem_despesas
  FOR DELETE
  USING (
    (
      vendedor_id = auth.uid() AND status_reembolso IN ('pendente', 'rejeitado')
      AND (prestacao_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.crm_viagem_prestacoes p
        WHERE p.id = crm_viagem_despesas.prestacao_id AND p.enviado_em IS NOT NULL
      ))
    )
    OR current_user_manages_viagem_of(vendedor_id)
  );
