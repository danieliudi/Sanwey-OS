-- Checklist de visita: as três colunas que o jsonb não resolve
--
-- Mockup aprovado com o Daniel em 14/09/2026 ("O checklist não é onde se
-- digita"), a partir da folha impressa "Checklist Comercial de Vendas —
-- Sanwey" que o vendedor leva na visita.
--
-- ── POR QUE SÓ TRÊS COLUNAS ───────────────────────────────────────────────
-- As ~60 lacunas do papel vão quase todas para `leads.custom_fields`, que já
-- existe — é o caminho configurável da regra 5, sem tabela nova. Três fogem
-- disso, e não por gosto: `custom_fields` é jsonb, e jsonb não se ordena, não
-- se filtra por faixa nem se soma por período com índice. É exatamente isso
-- que um score de propensão e um gatilho de recompra fazem.
--
-- Guardar volume só em jsonb resolveria a COLETA e deixaria as duas coisas
-- que dependem dela paradas do mesmo jeito que estão hoje — foi conferido em
-- 14/09/2026: `orders` = 0, `proposals` = 0, e zero colunas de volume, lote
-- ou consumo em todo o schema.
--
-- ── POR QUE NÃO REAPROVEITAR `fit_score` ──────────────────────────────────
-- `leads.fit_score` já existe e mede outra coisa: potencial de perfil do
-- lead. Este mede completude e qualidade da qualificação feita em visita.
-- São dois números com significados diferentes, e juntá-los numa coluna só
-- deixa os dois sem significado nenhum. A plataforma já pagou por essa
-- confusão noutro lugar: o anel de progresso do Onboarding exibia o tooltip
-- de "Fit score — potencial do lead" em cima do progresso de checklist de uma
-- PESSOA (achado e corrigido em 14/09/2026).

alter table public.leads
  add column if not exists volume_mensal_bags integer,
  add column if not exists volume_anual_bags  integer,
  add column if not exists score_comercial    integer;

comment on column public.leads.volume_mensal_bags is
  'Volume mensal em bags, informado pelo cliente na visita (seção 4 do Checklist Comercial de Vendas). Coluna e não custom_fields porque é o insumo de score de propensão e de gatilho de recompra — precisa ordenar, filtrar por faixa e somar por período.';
comment on column public.leads.volume_anual_bags is
  'Volume anual em bags, informado pelo cliente na visita (seção 4). Mesmo racional da coluna mensal. Não é derivado do mensal × 12: o papel pergunta os dois separados, porque sazonalidade quebra a multiplicação.';
comment on column public.leads.score_comercial is
  'Qualificação comercial 0-100 da seção 8 do checklist: soma dos pesos da folha impressa (20/15/10/10/10/10/10/10/5), CALCULADA a partir do que foi coletado, nunca marcada à mão. Distinta de fit_score, que mede potencial de perfil. Ver src/utils/checklist-visita.js.';

-- Guarda-corpo de faixa, não de negócio: o score da folha é 0-100 por
-- construção, então valor fora disso é erro de cálculo chegando no banco, não
-- um caso de borda legítimo.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.leads'::regclass
      and conname = 'leads_score_comercial_check'
  ) then
    alter table public.leads
      add constraint leads_score_comercial_check
      check (score_comercial is null or score_comercial between 0 and 100);
  end if;
end $$;

-- Volume não negativo, pela mesma razão.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.leads'::regclass
      and conname = 'leads_volume_bags_check'
  ) then
    alter table public.leads
      add constraint leads_volume_bags_check
      check (
        (volume_mensal_bags is null or volume_mensal_bags >= 0) and
        (volume_anual_bags  is null or volume_anual_bags  >= 0)
      );
  end if;
end $$;

-- Índice parcial: as três consultas que essas colunas existem para servir
-- ("quem tem volume alto", "quem está na faixa A", "quem qualificou e sumiu")
-- varrem só a minoria de linhas que tem o dado. Parcial em vez de completo
-- porque hoje são 29 leads e nenhum preenchido — e vai seguir esparso por um
-- bom tempo.
create index if not exists leads_volume_mensal_idx
  on public.leads (volume_mensal_bags desc) where volume_mensal_bags is not null;
create index if not exists leads_score_comercial_idx
  on public.leads (score_comercial desc) where score_comercial is not null;

-- RLS: nenhuma policy nova. `leads` já tem RLS ligada e as policies existentes
-- são de TABELA, não de coluna — valem para coluna nova sem alteração. Não há
-- GRANT por coluna em `leads` (conferido antes de escrever esta migration),
-- então não existe caminho em que a coluna nasça mais aberta que a linha.
