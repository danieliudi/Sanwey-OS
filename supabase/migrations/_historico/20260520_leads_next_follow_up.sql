-- Coluna pra agendamento de follow-up por lead, usada no LeadDetailDrawer.
-- Antes essa info se perdia: o drawer mandava onUpdate({ nextFollowUp: ... })
-- mas use-leads.js não tinha mapping pra next_follow_up, então o Supabase
-- ignorava silenciosamente o patch.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS next_follow_up timestamptz;

CREATE INDEX IF NOT EXISTS leads_next_follow_up_idx
  ON public.leads (next_follow_up)
  WHERE next_follow_up IS NOT NULL;
