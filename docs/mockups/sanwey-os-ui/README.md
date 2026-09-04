# Mockup — sanwey OS UI (estrutura expandida)

HTML clicável para avaliar **visual + estrutura**, sem alterar o app.

## Como abrir

Abra `index.html` no navegador.

## O que tem agora

| Tela | Como chegar | O que muda vs. hoje |
|---|---|---|
| **Visão Geral v2** | Top nav → Visão Geral | KPIs com sparkline/gauge; funil de conversão; donut de origem; barras empilhadas; heatmap |
| **Funil** | Comercial → Funil | Cards com 2 campos de preview; **clique abre drawer** |
| **Entregas** | Marketing → Entregas | Mesma densidade; clique abre drawer |
| **Sinais** | Comercial → Sinais | Coluna de leitura (urgência + tendência) + grade de ação |
| **Configurações** | Top nav → Config | Menu lateral 3 grupos (acaba o grupo→aba→sub-aba) |
| **Drawer** | Clique em qualquer card Kanban | Left = identidade · Center = abas + form · Right = mover + comentários |

## Propostas estruturais (resumo)

1. **Dashboard:** número sem gráfico não decide — cada KPI carrega tendência e o `n` do denominador.
2. **Kanban card:** título + valor não bastam; preview de 2 campos da etapa (fechamento / próximo passo).
3. **Drawer:** abas saem do left (hoje o Funil empilha identidade + 9 abas em 340px); center vira o trabalho.
4. **Sinais:** separar “entender o volume” (esquerda) de “agir no card” (grade).
5. **Config:** um nível de navegação lateral em vez de três níveis de abas.

## Arquivos

- `index.html` — mockup
- `dashboard-spec.json` — tokens originais
- `reference.png` — referência visual da Visão Geral v1
- `../design-spec-sanwey-os-ui-mockup.md` — spec curta

## Status

Só mockup. **Não implementar no `src/` sem aprovação explícita.**
