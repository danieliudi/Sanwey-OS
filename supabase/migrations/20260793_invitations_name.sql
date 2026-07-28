-- BUG-08/10 da auditoria de QA: profiles.name nasce como o local-part do
-- e-mail (ex.: "iudiyano") porque o registro em profiles é criado no ENVIO
-- do convite (supabase.auth.admin.inviteUserByEmail), não na aceitação, e o
-- convite nunca pedia o nome real da pessoa. O trigger handle_new_user já
-- lê raw_user_meta_data->>'name' quando presente (só cai no fallback
-- split_part(email,'@',1) quando ausente) — falta só o convite passar esse
-- dado. Decisão confirmada com o Daniel: corrigir daqui pra frente, sem
-- mudar o momento de criação do profile (mudança maior, mexeria em função
-- SECURITY DEFINER e no fluxo de convite inteiro).
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS name text;
