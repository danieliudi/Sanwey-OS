-- Gestão de fornecedores de RH (convênio médico, seguradora, terceirizada)
-- com contrato real (vigência/valor) + histórico de eventos (reajuste,
-- renovação, fatura, nota, orçamento, compra) — diferente de
-- marketing_suppliers, que é cadastro+cotação pra agência/gráfica/etc e não
-- modela vigência de contrato. E catálogo de benefícios genéricos
-- (VT/VR/VA/Wellhub/convênio médico), linkado a um fornecedor daqui, com o
-- vínculo por colaborador (solicitado → aprovado → ativo).

CREATE TABLE public.rh_fornecedores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  tipo          text NOT NULL CHECK (tipo = ANY (ARRAY['convenio_medico','seguradora','terceirizada_rh','outro'])),
  contact_name  text,
  email         text,
  phone         text,
  notes         text,
  is_active     boolean NOT NULL DEFAULT true,
  created_by    uuid REFERENCES public.profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rh_fornecedor_contratos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id     uuid NOT NULL REFERENCES public.rh_fornecedores(id) ON DELETE CASCADE,
  titulo            text NOT NULL,
  vigencia_inicio   date,
  vigencia_fim      date,
  valor             numeric,
  status            text NOT NULL DEFAULT 'ativo' CHECK (status = ANY (ARRAY['ativo','vencido','renovacao_pendente','cancelado'])),
  notes             text,
  created_by        uuid REFERENCES public.profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rh_fornecedor_contratos_fornecedor_idx ON public.rh_fornecedor_contratos (fornecedor_id);

-- Histórico de alterações do contrato — reajuste de valor, renovação de
-- vigência, fatura/nota/orçamento recebidos, compra avulsa. Anexo (PDF da
-- fatura/nota/orçamento) reaproveita rh_attachments (ver ALTER da constraint
-- de domínio abaixo), não uma coluna de arquivo aqui.
CREATE TABLE public.rh_fornecedor_contrato_eventos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id       uuid NOT NULL REFERENCES public.rh_fornecedor_contratos(id) ON DELETE CASCADE,
  tipo              text NOT NULL CHECK (tipo = ANY (ARRAY['reajuste','renovacao','fatura','nota','orcamento','compra','outro'])),
  valor_anterior    numeric,
  valor_novo        numeric,
  descricao         text,
  data_evento       date NOT NULL DEFAULT current_date,
  created_by        uuid REFERENCES public.profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rh_fornecedor_contrato_eventos_contrato_idx ON public.rh_fornecedor_contrato_eventos (contrato_id, data_evento DESC);

CREATE TABLE public.rh_beneficios_catalogo (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo            text NOT NULL CHECK (tipo = ANY (ARRAY['vt','vr','va','wellhub','convenio_medico','outro'])),
  nome_exibicao   text NOT NULL,
  fornecedor_id   uuid REFERENCES public.rh_fornecedores(id) ON DELETE SET NULL,
  valor_padrao    numeric,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES public.profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Vínculo colaborador ↔ benefício, com status de aprovação — o gatilho real
-- (período de experiência concluído → nova tarefa "solicitar benefícios")
-- fica no app (use-my-tasks.js), não em trigger de banco, pra reaproveitar o
-- mesmo padrão de alerta já usado nos outros lembretes de RH.
CREATE TABLE public.rh_colaborador_beneficios (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id        uuid NOT NULL REFERENCES public.rh_colaboradores(id) ON DELETE CASCADE,
  beneficio_catalogo_id uuid NOT NULL REFERENCES public.rh_beneficios_catalogo(id),
  status                text NOT NULL DEFAULT 'solicitado' CHECK (status = ANY (ARRAY['solicitado','aprovado','ativo','cancelado'])),
  valor                 numeric,
  solicitado_em         timestamptz NOT NULL DEFAULT now(),
  aprovado_em           timestamptz,
  aprovado_por          uuid REFERENCES public.profiles(id),
  notes                 text
);

CREATE INDEX rh_colaborador_beneficios_colaborador_idx ON public.rh_colaborador_beneficios (colaborador_id);

-- rh_attachments ganha um domínio novo pra anexar fatura/nota/orçamento nos
-- eventos de contrato (mesmo padrão já usado por vagas/candidatos/etc).
ALTER TABLE public.rh_attachments
  DROP CONSTRAINT rh_attachments_domain_check,
  ADD CONSTRAINT rh_attachments_domain_check
    CHECK (domain = ANY (ARRAY['vagas','candidatos','onboarding','feedback','ferias','treinamentos','fornecedor_contratos']));

-- RLS — mesmo padrão RH-only já usado em todo o módulo, mas via
-- current_user_is_rh()/current_user_is_rh_manager() (checam profiles.roles,
-- o array multi-cargo da FASE 1) em vez de repetir profiles.role = ANY(...)
-- (checagem legada de cargo único que os primeiros domínios de RH usavam).
ALTER TABLE public.rh_fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY rh_fornecedores_rh_access ON public.rh_fornecedores
  FOR ALL USING (public.current_user_is_rh()) WITH CHECK (public.current_user_is_rh());

ALTER TABLE public.rh_fornecedor_contratos ENABLE ROW LEVEL SECURITY;
CREATE POLICY rh_fornecedor_contratos_rh_access ON public.rh_fornecedor_contratos
  FOR ALL USING (public.current_user_is_rh()) WITH CHECK (public.current_user_is_rh());

ALTER TABLE public.rh_fornecedor_contrato_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY rh_fornecedor_contrato_eventos_rh_access ON public.rh_fornecedor_contrato_eventos
  FOR ALL USING (public.current_user_is_rh()) WITH CHECK (public.current_user_is_rh());

ALTER TABLE public.rh_beneficios_catalogo ENABLE ROW LEVEL SECURITY;
CREATE POLICY rh_beneficios_catalogo_rh_access ON public.rh_beneficios_catalogo
  FOR ALL USING (public.current_user_is_rh()) WITH CHECK (public.current_user_is_rh());

ALTER TABLE public.rh_colaborador_beneficios ENABLE ROW LEVEL SECURITY;
CREATE POLICY rh_colaborador_beneficios_rh_access ON public.rh_colaborador_beneficios
  FOR ALL USING (public.current_user_is_rh()) WITH CHECK (public.current_user_is_rh());
-- Colaborador vê os próprios benefícios (self-read), mesmo espírito de
-- rh_attachments_self_read pro domínio onboarding.
CREATE POLICY rh_colaborador_beneficios_self_read ON public.rh_colaborador_beneficios
  FOR SELECT USING (public.is_own_colaborador(colaborador_id));
