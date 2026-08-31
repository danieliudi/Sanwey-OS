-- SEC-A3/NOVO-1 (ALTO): `profiles` guardava 3 colunas sensíveis (ai_config
-- em texto plano, calendar_token, salary) numa tabela lida por LINHA
-- inteira por muita gente — gerente, marketing↔marketing, rh↔rh, agencia→
-- marketing, supervisor→subordinados. RLS é por linha, não por coluna, então
-- não dava pra "esconder só uma coluna" sem tirar a coluna da tabela.
--
-- ai_config/calendar_token são usados de verdade (self-read/self-write, ver
-- use-supabase-auth.js/use-profiles.js/SettingsView.jsx/calendar-ics) — vão
-- pra tabela own-only. `salary` está zerada nas 9 linhas hoje e não é lida/
-- escrita por nenhuma tela (grep confirmado) — é resquício morto, dropada
-- direto.

CREATE TABLE public.profile_secrets (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  ai_config jsonb,
  calendar_token text NOT NULL DEFAULT (gen_random_uuid())::text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX profile_secrets_calendar_token_key ON public.profile_secrets (calendar_token);

ALTER TABLE public.profile_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY profile_secrets_self ON public.profile_secrets
FOR ALL
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Backfill preservando o calendar_token existente — assinaturas de
-- calendário já ativas não podem quebrar.
INSERT INTO public.profile_secrets (id, ai_config, calendar_token)
SELECT id, ai_config, COALESCE(calendar_token, (gen_random_uuid())::text)
FROM public.profiles
ON CONFLICT (id) DO NOTHING;

-- Garante que todo profile novo ganha sua linha de secrets automaticamente.
CREATE OR REPLACE FUNCTION public.profile_secrets_ensure_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO public.profile_secrets (id) VALUES (NEW.id) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_profile_created_ensure_secrets
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profile_secrets_ensure_row();

ALTER TABLE public.profiles DROP COLUMN ai_config;
ALTER TABLE public.profiles DROP COLUMN calendar_token;
ALTER TABLE public.profiles DROP COLUMN salary;
