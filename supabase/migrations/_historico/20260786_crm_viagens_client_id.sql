-- Viagens & Reembolsos: "Cliente" era só texto livre (cliente_nome), com um
-- vínculo escondido a leads.id (lead_id) que a UI nem expunha como tal —
-- confirmado pelo Daniel: trocar por um vínculo real com o cadastro central
-- de Clientes (public.clients), removendo o vínculo com Lead da UI.
-- cliente_nome permanece (populado a partir do nome do cliente escolhido)
-- pra não quebrar relatórios/import CSV existentes que já leem essa coluna
-- (CRMViagensRelatoriosView.jsx) — client_id é a fonte de verdade nova.
ALTER TABLE public.crm_viagem_registros
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS crm_viagem_registros_client_idx ON public.crm_viagem_registros (client_id);
