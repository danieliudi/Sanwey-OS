-- RASCUNHO — NÃO APLICAR sem confirmação explícita do Daniel.
--
-- Absorvido por _rascunho/20260903230000_modulos_toggles_paginas.sql
-- (o CASE de current_user_has_module de lá já inclui 'abm' no ramo comercial).
-- Este arquivo fica só como ponteiro pra não reaplicar o INSERT isolado.

-- insert into public.module_states (module_id, state) values ('abm','live')
--   on conflict (module_id) do nothing;
