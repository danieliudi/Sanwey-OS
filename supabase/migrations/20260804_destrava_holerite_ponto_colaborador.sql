-- Destrava holerite e cartão de ponto no painel do colaborador (/meu-rh).
--
-- A tela (MeuRHView.jsx), o upload em lote pelo RH (RHFuncionariosView.jsx)
-- e a policy de leitura da TABELA (20260739) já existiam — mas o recurso
-- nunca funcionou, porque estava bloqueado em duas camadas independentes:
--
--   1. rh_attachments_domain_check não aceitava 'holerite' nem 'ponto',
--      então o INSERT do upload sempre falhava. A migration 20260795 já
--      tinha detectado isso e deixado registrado no próprio arquivo
--      ("anexo de holerite/ponto nunca pôde ser inserido"), fora de escopo
--      naquela rodada. É esta rodada.
--
--   2. Mesmo com o registro gravado, o download seria negado: a policy de
--      STORAGE rh_attachments_self_read (20260707) só libera a pasta
--      'onboarding'. O caminho gravado é `${domain}/${colaborador_id}/...`
--      (ver RHFuncionariosView), então holerite/ e ponto/ caíam fora.
--
-- Corrigir só uma das duas não entrega nada — daí virem juntas.

-- ── Camada 1: CHECK de domínio da tabela ────────────────────────────────
ALTER TABLE public.rh_attachments
  DROP CONSTRAINT rh_attachments_domain_check,
  ADD CONSTRAINT rh_attachments_domain_check
    CHECK (domain = ANY (ARRAY[
      'vagas','candidatos','onboarding','feedback','ferias','treinamentos',
      'fornecedor_contratos','marketing_tasks','marketing_purchase_requests',
      'comex','posvenda','holerite','ponto'
    ]));

-- ── Camada 2: policy de storage ─────────────────────────────────────────
-- Mesma regra de sempre (só SELECT, só a própria pasta do colaborador), com
-- a lista de pastas alinhada à policy de tabela rh_attachments_self_read.
DROP POLICY IF EXISTS "rh_attachments_self_read" ON storage.objects;
CREATE POLICY "rh_attachments_self_read" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'rh-attachments'
    AND EXISTS (
      SELECT 1 FROM public.rh_colaboradores c
      WHERE c.profile_id = (SELECT auth.uid())
        AND (storage.foldername(name))[1] = ANY (ARRAY['onboarding','holerite','ponto'])
        AND (storage.foldername(name))[2] = c.id::text
    )
  );
