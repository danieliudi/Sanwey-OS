-- Jornada e escala de rh_cargo_templates eram texto livre ("44h semanais",
-- "12x36, comercial") — cada pessoa preenchia diferente, prejudicando a
-- coleta de dado. Achado do usuário 20/07.
--
-- schedule_blocks: array de { days: string[] (seg/ter/qua/qui/sex/sab/dom),
-- start, end } — cobre jornada com horário diferente por dia (ex.: sexta
-- encurtada por compensação de sábado) como blocos separados.
-- escala: padrão fechado (RH_ESCALA_TYPES em rh-config.js) em vez de texto.
--
-- schedule/shift (texto livre) continuam existindo — cargos já cadastrados
-- mantêm o valor antigo como histórico; a tela passa a exigir o novo campo
-- estruturado só daqui pra frente (não dá pra migrar texto arbitrário em
-- estrutura de forma confiável).
alter table public.rh_cargo_templates
  add column if not exists schedule_blocks jsonb not null default '[]',
  add column if not exists escala text;
