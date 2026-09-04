# Design spec — Mockup sanwey OS UI (shell + 4 telas)

**Data:** 2026-09-04  
**Status:** mockup HTML para aprovação visual — **não implementar no `src/` sem ok explícito**  
**Pasta:** `docs/mockups/sanwey-os-ui/`

## Decisão

Aplicar o design system do `dashboard-spec.json` (creme `#F9F5F1`, accent `#B62D2C`, cards 24px, nav pill) à casca da plataforma e a 3 padrões de tela já existentes hoje: dashboard, Kanban e tabela.

## Escopo do mockup

| Tela | Padrão | Como chegar |
|---|---|---|
| Visão Geral v2 | Dashboard com gráficos | Top nav → Visão Geral |
| Funil de Vendas | Kanban + drawer | Comercial → Funil → clique no card |
| Entregas | Kanban + drawer | Marketing → Entregas → clique no card |
| Sinais | Grade + coluna analítica | Comercial → Sinais |
| Funcionários | Tabela com filtro | RH / Pessoas → Funcionários |
| Configurações | Rail lateral + painel | Top nav → Configurações |

## Mudança estrutural proposta (só no mockup)

- Sidebar lateral → **top nav** com 5 áreas + **subnav** por área
- **KPIs com tendência** (sparkline/gauge) e denominador (`n=`) visível
- **Cards Kanban** com 2 campos de preview (não só título/valor)
- **Drawer:** left = identidade · center = abas + form da etapa · right = mover + comentários  
  (hoje no Funil o left empilha identidade + até 9 abas em 340px)
- **Sinais:** coluna de leitura (urgência + volume) separada da grade de ação
- **Config:** menu lateral de 3 grupos no lugar de grupo → aba → sub-aba

## Fora de escopo

Mobile dedicado, dark mode, dados reais do banco, implementação em `src/`.

## Aprovação

Montagem autorizada pelo Daniel em 04/09/2026 (opção B + HTML clicável).  
Expansão (drawer / Sinais / Config / gráficos) pedida no mesmo dia.  
Próximo passo depois de aprovar o visual: plano de implementação (não começa sozinho).
