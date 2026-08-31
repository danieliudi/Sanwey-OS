-- Fluxo externo de triagem por gestor de área (sem login na plataforma):
-- RH gera um link seguro por vaga (token de 256 bits, não é um slug
-- adivinhável), envia por e-mail pro gestor, e ele aprova/reprova cada
-- candidato daquela vaga sem precisar de conta. Duas camadas de defesa:
-- (1) o token em si (alta entropia, gerado client-side com crypto.randomUUID
-- x2, nunca reaproveitado); (2) o gestor também confirma o próprio e-mail
-- na página — se o link vazar/for encaminhado sem o e-mail junto, não abre.
-- Link expira e é revogável pelo RH a qualquer momento (whatsapp/e-mail
-- comprometido depois do prazo não continua funcionando).

CREATE TABLE public.rh_vaga_manager_links (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vaga_id           uuid NOT NULL REFERENCES public.rh_vagas(id) ON DELETE CASCADE,
  manager_name      text NOT NULL,
  manager_email     text NOT NULL,
  token             text NOT NULL UNIQUE,
  expires_at        timestamptz NOT NULL,
  revoked_at        timestamptz,
  last_accessed_at  timestamptz,
  created_by        uuid REFERENCES public.profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rh_vaga_manager_links_vaga_idx ON public.rh_vaga_manager_links (vaga_id);

ALTER TABLE public.rh_vaga_manager_links ENABLE ROW LEVEL SECURITY;
-- Só RH mexe na tabela diretamente (criar/revogar link). O acesso do
-- gestor externo (sem login) passa inteiro pela edge function
-- manager-vaga-review, que usa a service role — nunca lê essa tabela via
-- RLS de usuário anônimo.
CREATE POLICY rh_vaga_manager_links_rh_access ON public.rh_vaga_manager_links
  FOR ALL USING (public.current_user_is_rh()) WITH CHECK (public.current_user_is_rh());

-- Decisão do gestor fica na aplicação (rh_aplicacoes), não no link — um
-- link cobre N candidatos da mesma vaga, cada decisão é por aplicação.
ALTER TABLE public.rh_aplicacoes
  ADD COLUMN manager_decision       text CHECK (manager_decision = ANY (ARRAY['aprovado','reprovado'])),
  ADD COLUMN manager_decision_at    timestamptz,
  ADD COLUMN manager_decision_notes text,
  ADD COLUMN manager_link_id        uuid REFERENCES public.rh_vaga_manager_links(id);
