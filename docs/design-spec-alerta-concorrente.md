# Spec — Alerta de menção a concorrente

Status: investigação/spec, **nada implementado**. Sem schema/RLS novos.

## Estado atual

`AtaVozPanel.jsx` já pede pra IA extrair "concorrente citado" como campo
estruturado por visita (schema da Ata, ver `crm-ata-voz` `SCHEMA_HINT` →
campo `concorrente`), gravado em `activity.meta.concorrente`, e aparece na
timeline do `LeadDetailDrawer` (~linha 1549). O dado já existe — só não é
destacado como alerta, fica enterrado na timeline.

## Fase 1 (zero custo, zero schema novo)

Badge/alerta no `LeadKanbanCard` e no topo do `LeadDetailDrawer` quando a
atividade mais recente (ou dentro de uma janela, ex. 60 dias) tem
`meta.concorrente` preenchido — reaproveita o padrão já usado pro badge de
comentário não lido (`comment-badge.js`, CLAUDE.md regra 1) e o token
`--amber` (urgência intermediária, não erro). Computado client-side a partir
do array de activities já carregado — sem tabela nova, sem RLS nova.

## Fase 2 (scan de texto livre)

Hoje só pega concorrente quando o vendedor passa pela Ata de voz. Uma nota
manual digitada direto ("cliente falou que tá cotando com a Bag&Cia") não é
capturada. Fase 2 = lista estática de concorrentes conhecidos
(`src/data/known-competitors.js`, mesmo espírito do `changelog.js` — array
simples, editável por código, não precisa virar tela de admin na v1) +
função de scan (case-insensitive, sem lib de NLP) aplicada a
`notes`/`content` de activities ao renderizar a timeline. Mesmo resultado
visual da Fase 1, só que a fonte do sinal é mais ampla.

## Schema/RLS/Storage

Nenhuma mudança em nenhuma fase.

Mockup: ver artifact "Novas Features do Funil", item 5.
