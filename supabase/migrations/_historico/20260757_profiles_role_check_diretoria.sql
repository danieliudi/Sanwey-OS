-- Papel Diretoria (continuação de 20260756_papel_diretoria.sql): a migration
-- anterior só ampliou `profiles_roles_check` (a coluna array, fonte de
-- verdade pra RLS). Mas UserManagementView deixa escolher "Diretoria" como
-- CARGO PRINCIPAL (coluna escalar `role`, usada só pra decidir a landing
-- page) — sem ampliar `profiles_role_check` também, esse salvamento
-- quebraria com violação de constraint. Idem `invitations.role`, mesmo
-- caminho de convite por e-mail.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check,
  ADD CONSTRAINT profiles_role_check
    CHECK (role IN (
      'admin','gerente','vendedor','consultor',
      'marketing','gerente_marketing','agencia',
      'rh','gerente_rh','diretoria'
    ));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invitations') THEN
    ALTER TABLE public.invitations
      DROP CONSTRAINT IF EXISTS invitations_role_check;
    ALTER TABLE public.invitations
      ADD CONSTRAINT invitations_role_check
        CHECK (role IN (
          'admin','gerente','vendedor','consultor',
          'marketing','gerente_marketing','agencia',
          'rh','gerente_rh','diretoria'
        ));
  END IF;
END $$;
