-- Reunião com o RH (20/07): contratos com fornecedores precisam de um
-- responsável que recebe notificação/lembrete de vencimento (in-app + e-mail).
ALTER TABLE public.rh_fornecedor_contratos
  ADD COLUMN responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX rh_fornecedor_contratos_responsavel_idx ON public.rh_fornecedor_contratos (responsavel_id);
