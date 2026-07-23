-- Advisor de segurança apontou search_path mutável na função de trigger
-- criada na migration anterior — mesmo padrão das outras funções de
-- updated_at do projeto (marketing_tasks_set_updated_at etc.).
alter function public.posvenda_cases_set_updated_at() set search_path = public, pg_temp;
