-- Manual leads created via the kanban "Novo card" flow don't have a CNPJ.
-- Drop the NOT NULL constraint so the quick-add form can insert them.
ALTER TABLE public.leads ALTER COLUMN cnpj DROP NOT NULL;
