-- Aceite de termos de uso: proteção jurídica pra empresa (cada usuário
-- precisa ler e aceitar antes de usar a plataforma) — bloqueio no app fica
-- em useTermsAcceptance/TermsGateScreen. Guarda só o carimbo do aceite
-- (quem, qual versão, quando); o TEXTO em si mora no componente React
-- (TermsGateScreen), não no banco — versão incrementa lá quando o texto
-- jurídico mudar de forma relevante.
CREATE TABLE IF NOT EXISTS public.terms_acceptances (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  version     integer     NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, version)
);

ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;

-- Cada um só lê/grava o próprio aceite.
CREATE POLICY terms_acceptances_self ON public.terms_acceptances
  FOR ALL USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- RH/admin lê todo mundo — auditoria de compliance (quem aceitou, quando).
CREATE POLICY terms_acceptances_rh_read ON public.terms_acceptances
  FOR SELECT USING (
    current_user_is_admin() OR current_user_has_role('gerente_rh') OR current_user_has_role('rh')
  );
