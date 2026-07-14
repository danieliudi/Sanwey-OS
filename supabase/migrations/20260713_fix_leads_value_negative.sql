-- Importante da auditoria: o botão de submit do LeadCreateModal ficava
-- FORA do <form> (onClick direto, bypassando validação nativa), e mesmo
-- com o input de valor mascarado (CurrencyInput já impede digitar "-"),
-- não havia nenhuma barreira no banco — leads.value não tinha CHECK >=0.
-- Adiciona a constraint como última linha de defesa (a correção de UI/JS
-- fica no componente).
ALTER TABLE public.leads
  ADD CONSTRAINT leads_value_check CHECK (value >= 0);
