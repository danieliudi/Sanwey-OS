# Spec — Reviver `fit_score` no Pipeline

Status: investigação/spec, **nada implementado**. Sem schema novo (coluna já
existe).

## Estado atual

`leads.fit_score` existe na tabela, mas é hardcoded em `0` na criação
(`LeadCreateModal.jsx:407`) e não tem UI nenhuma. A infra de scoring por IA
já roda pra dois outros domínios (Prospecção — `use-prospect-suggestions.js`;
Recrutamento — `RHRecrutamentoView.jsx`).

## Decisão de design a registrar

NÃO reaproveitar o scoring via IA desses dois domínios pro Pipeline — lá o
score serve pra TRIAGEM de um volume grande de registros frios (prospects,
currículos) que ninguém olhou ainda; no Pipeline o vendedor já está
ativamente trabalhando o negócio, o ganho de rodar IA por lead é menor e o
custo (latência + tokens) é maior. Proposta: fórmula determinística (sem
chamada de IA), calculada a partir de sinais que já existem no registro:

- **Fit de segmento**: `lead.sector` bate com um dos segmentos-núcleo da
  Sanwey (química/O&G, mineração, alimentício, armazenagem, agro) → pontos.
  Lista de segmentos-alvo como constante, não schema novo.
- **Urgência regulatória**: SE existir um campo de "prazo de
  adequação"/certificação com data (a confirmar se algum
  `pipeline_stage_fields` já cobre isso hoje, ou se é campo a criar via
  mecanismo de campo customizado por etapa — que já é dado configurável,
  regra 5 do CLAUDE.md, não schema) → quanto mais perto do prazo, mais
  pontos.
- **Valor do negócio** (`lead.value`) e **tempo parado** (`daysIdle`, já
  existe em `pipeline-metrics.js`) como sinais adicionais.

Computado no cliente (função pura, tipo `computeFitScore(lead)`) a cada
render da lista/kanban — sem necessidade de persistir se só for pra
exibir/ordenar. Persistir em `fit_score` (coluna já existe) só se quisermos
permitir ORDENAR/FILTRAR no backend ou guardar histórico — decisão a
confirmar com o Daniel, mas tecnicamente nenhuma migration nova é
necessária de qualquer forma.

## UI

Badge numérico ou faixa (Alto/Médio/Baixo, cores `--accent`/`--text-dim`) no
card do Kanban + opção de ordenar por fit score reaproveitando o padrão já
usado (`KanbanColumnSortMenu` da Lista Pessoal).

Mockup: ver artifact "Novas Features do Funil", item 6.

## Schema/RLS/Storage

Nenhuma mudança obrigatória (coluna já existe); Storage não é tocado.
