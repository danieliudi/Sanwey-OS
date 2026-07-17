-- Proteção de dados estratégicos (item pedido pelo usuário): rastro de
-- quem exportou o quê da plataforma — leads, clientes, viagens etc. Não
-- impede exportação (times comerciais legitimamente precisam disso), mas
-- cria trilha auditável em caso de suspeita de vazamento pra concorrente.
-- Não é RLS-scoping (isso já existe e está correto — RLS de leads/clients
-- já restringe por empresa/papel, ver clients_read/leads policies), é
-- accountability sobre uma ação que já é permitida.
CREATE TABLE IF NOT EXISTS public.export_audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  exported_by   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain        text        NOT NULL,
  record_count  integer     NOT NULL DEFAULT 0,
  meta          jsonb,
  exported_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS export_audit_log_exported_by_idx ON public.export_audit_log (exported_by);
CREATE INDEX IF NOT EXISTS export_audit_log_exported_at_idx ON public.export_audit_log (exported_at DESC);

ALTER TABLE public.export_audit_log ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado registra a própria exportação (é só um log, não dá
-- pra silenciar nem forjar em nome de outra pessoa — exported_by trava em
-- auth.uid()).
CREATE POLICY export_audit_log_self_insert ON public.export_audit_log
  FOR INSERT WITH CHECK (exported_by = auth.uid());

-- Só admin revisa a trilha completa — é justamente o público que precisa
-- investigar suspeita de vazamento, não RH/gerente comum.
CREATE POLICY export_audit_log_admin_read ON public.export_audit_log
  FOR SELECT USING (current_user_is_admin());
