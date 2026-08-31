-- Mesmo motivo da migração em rh_cargo_templates (jornada/escala texto livre
-- prejudicando coleta de dado) — esqueci que Nova Vaga grava em rh_vagas, não
-- em rh_cargo_templates, e só tinha adicionado as colunas lá. Bug reportado
-- pelo usuário ao testar "Criar vaga": erro de coluna 'escala' ausente.
alter table public.rh_vagas
  add column if not exists schedule_blocks jsonb not null default '[]',
  add column if not exists escala text;
