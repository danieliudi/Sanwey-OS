# Mockup — sanwey OS UI

Pacote de mockup HTML clicável para avaliar o redesign visual da plataforma
(top nav + design tokens do `dashboard-spec.json`), **sem alterar o app**.

## Como abrir

Abra `index.html` no navegador (duplo clique ou servidor estático local).

Telas no mesmo shell:

1. **Visão Geral** — fiel ao spec + referência visual
2. **Funil de Vendas** — Kanban comercial (via Comercial → Funil)
3. **Entregas** — Kanban de marketing (via Marketing → Entregas)
4. **Funcionários** — tabela RH (via RH / Pessoas → Funcionários)

## Arquivos

| Arquivo | O quê |
|---|---|
| `index.html` | Mockup clicável |
| `dashboard-spec.json` | Spec de tokens / layout / dados da Visão Geral |
| `reference.png` | Referência visual aprovada como direção |

## Fora de escopo deste pacote

Drawer aberto, mobile dedicado, dark mode, conteúdo real de Configurações.

## Status

Mockup para aprovação visual. **Não implementar no `src/` sem aprovação explícita do Daniel.**
