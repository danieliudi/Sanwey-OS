alter table rh_pipeline_stages
  add column if not exists card_preview_fields text[] default null;

comment on column rh_pipeline_stages.card_preview_fields is
  'Domain=comercial: campos escolhidos pelo dono da fase pra aparecer no preview do card do Kanban (até 3). NULL = usa o padrão (valor/probabilidade/fechamento).';
