# Design spec — Mockup sanwey OS UI (shell + 4 telas)

**Data:** 2026-09-04  
**Status:** mockup HTML para aprovação visual — **não implementar no `src/` sem ok explícito**  
**Pasta:** `docs/mockups/sanwey-os-ui/`

## Decisão

Aplicar o design system do `dashboard-spec.json` (creme `#F9F5F1`, accent `#B62D2C`, cards 24px, nav pill) à casca da plataforma e a 3 padrões de tela já existentes hoje: dashboard, Kanban e tabela.

## Escopo do mockup

| Tela | Padrão | Como chegar |
|---|---|---|
| Visão Geral | Dashboard (spec fiel) | Top nav → Visão Geral |
| Funil de Vendas | Kanban | Comercial → Funil |
| Entregas | Kanban | Marketing → Entregas |
| Funcionários | Tabela com filtro | RH / Pessoas → Funcionários |

## Mudança estrutural proposta (só no mockup)

- Sidebar lateral → **top nav** com 5 áreas (Visão Geral, Comercial, Marketing, RH, Configurações)
- **Subnav** por área quando Comercial / Marketing / RH está ativo
- Tokens tipográficos Inter (conforme spec)

## Fora de escopo

Drawer aberto, mobile dedicado, dark mode, conteúdo real de Configurações, dados reais do banco.

## Aprovação

Montagem autorizada pelo Daniel em 04/09/2026 (opção B + HTML clicável).  
Próximo passo depois de aprovar o visual: plano de implementação (não começa sozinho).
