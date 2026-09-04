# Design spec — Polish / “feeling” em toda a plataforma

**Data:** 2026-09-04  
**Status:** plano para aprovação visual — **não implementar em `src/` sem ok explícito**  
**Mockups:** `docs/mockups/sanwey-os-ui/polish-visao.html` · `polish-padroes.html`  
**Referência externa:** Worktail (vídeo Dribbble) — só motion/elevação, **não** a marca/creme/laranja  

---

## 0. Decisão pedida

Manter o **shell atual** (sidebar). Aplicar polish **incremental** em todas as páginas — das densas (Kanban, Painel) às simples (Config, Tutoriais) — para ficar minimalista, mas com animações sutis e mais “feeling” ao usar.

Isto **não** é a troca de shell (top nav / lateral nova). Aquilo continua em B/C nos mockups, decisão separada.

---

## 1. Princípios (não negociáveis)

1. **Minimalista primeiro** — motion e sombra servem à hierarquia, não à decoração.
2. **Uma linguagem só** — mesmos tokens de elevação/duração em Kanban, tabela, grade e Config.
3. **Respeitar densidade** — boards e tabelas não ganham padding “lifestyle”; o feeling vem de transição e feedback, não de espaço vazio.
4. **Prefers-reduced-motion** — se o SO pede menos animação, zera stagger/grow; mantém estados (hover/focus) sem deslocamento.
5. **Som** — fora do escopo desta rodada. Se entrar depois: só clique de ação primária, **opcional** em Aparência, nunca em hover.
6. **Não copiar** fundo creme, paleta laranja Worktail, tipografia gigante de KPI, hachura sem significado de negócio.

---

## 2. Conflito com decisão já aprovada (precisa ok)

Em `src/index.css` (03/08, Focus Flutter UI Kit):

```css
--shadow-card: none;   /* card em repouso só com borda 1px */
--shadow-pop:  …;      /* única elevação real: hover/popover/modal */
```

O polish propõe **sombras muito sutis em repouso** (não o `--shadow-pop` atual). Isso **altera** a decisão de 03/08.

| Opção | Efeito |
|---|---|
| **A — Soft card curto (preferência Daniel 04/09 no mockup A+)** | Sombra **curta** e baixa (1–2px offset, blur ~6–10px); card perto do fundo |
| **B — Manter flat** | Continua sem sombra em repouso; feeling só com motion |
| **C — Híbrido** | Soft curto só em dashboard; flat em kanban/tabela |

**Status:** mockup A+ validado com ajuste de sombra curta + bolinhas do gráfico redondas (não SVG stretch). Opção **A curta** é a hipótese atual até ok formal em §9.

---

## 3. Tokens novos (proposta)

Só entram em `index.css` depois do ok + mockup aprovado.

| Token | Valor proposto | Uso |
|---|---|---|
| `--shadow-card` | `0 1px 2px rgba(55,53,47,.04), 0 2px 6px rgba(55,53,47,.05)` | card em repouso — **curta** (feedback Daniel 04/09: evita “flutuar longe”) |
| `--shadow-card-hover` | `0 2px 4px …, 0 4px 10px …` | hover |
| `--shadow-drag` | `0 4px 14px rgba(55,53,47,.12)` | Kanban dragging |
| `--motion-fast` | `150ms` | tooltip, chip, focus |
| `--motion-base` | `220ms` | hover elevate, dropdown open |
| `--motion-enter` | `420ms` | stagger de entrada de página |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | padrão de saída suave |
| `--radius-card` | manter `12px` boards / `14–16px` painéis (não 24px Worktail) | |

---

## 4. Catálogo de padrões → o que muda no feeling

Base: `docs/design-spec-padroes-de-pagina.md` (Tabela / Kanban / Grade).

### 4.1 Shell (sidebar + topbar) — mínimo

| Elemento | Feeling |
|---|---|
| Item de nav | hover background suave `150ms`; active mantém barra accent (já existe) |
| Sidebar collapse | já anima `margin-left`; não reinventar |
| Toast / changelog | entrada com fade+slide 8px (`--motion-base`) |

### 4.2 Padrão A — Tabela + filtros

| Elemento | Feeling |
|---|---|
| Linha | hover fundo `--surface-alt` suave; focus-visible anel accent |
| Clique na linha | feedback press leve (`scale` 0.998 ou opacity) antes do drawer |
| Skeleton | shimmer suave (já previsto na spec de padrões) |
| FilterBar / busca | chips ativos com “pop” de 150ms; limpar filtros anima saída |
| Dropdown filtro | painel abre com fade+4px down; item highlighted |
| Botão + Novo | hover elevate leve; active press |
| Paginação / sort | ícone de sort gira 180° em `--motion-fast` |

### 4.3 Padrão B — Kanban (Funil, Entregas, RH, etc.)

| Elemento | Feeling |
|---|---|
| Card em repouso | soft shadow **ou** flat (conforme §2); hover `translateY(-1px)` + `--shadow-card-hover` |
| Drag | lift imediato (`--shadow-drag` + scale 1.02); coluna destino com ring accent 2px |
| Drop | settle 200ms (scale volta a 1) |
| Coluna | header sticky sem flicker; empty column pulse muito sutil no drag-over |
| KanbanFab / filtros de board | mesmos tokens de botão/dropdown da §4.2 |
| MoveStageMenu | open/close com `--motion-base` |

### 4.4 Padrão C — Grade de cards (Sinais, Tutoriais, Fornecedores…)

| Elemento | Feeling |
|---|---|
| Entrada da grade | stagger 40–60ms entre cards (cap: 8 primeiros; resto instantâneo) |
| Card | hover elevate; clique → drawer/modal |
| Chips de urgência | active state com spring curto |

### 4.5 Dashboard / Painel Executivo

Já mockado em `polish-visao.html`:

- Stagger dos KPIs  
- Mini-visual (spark/gauge/barra)  
- Gráfico: grow/draw na entrada  
- Tooltip escuro no hover  

### 4.6 Drawer / modal (todas as famílias)

| Elemento | Feeling |
|---|---|
| Overlay | fade scrim `--motion-base` |
| Painel | slide da direita (drawer) / scale+fade (modal) |
| Abas internas | underline/pill com transição de cor, sem bounce |
| Botões Mover etapa | já coloridos; hover brightness + press |

**Estrutura do drawer comercial não muda** (só pele) — decisão de 04/09.

### 4.7 Configurações e páginas “simples”

| Elemento | Feeling |
|---|---|
| Lista de seções / tabs | mesmo Tabs segmentado com transição |
| Toggle | thumb anima 150ms |
| Campos | focus ring suave; erro shake **opcional** e mínimo (2px, 1 ciclo) |
| Save | botão → estado “Salvo” com check fade (sem confetti) |
| Empty / Ajuda | `EmptyState` com ícone fade-in único |

### 4.8 Chat, Cmd-K, notificações

| Elemento | Feeling |
|---|---|
| CommandPalette | já existe; alinhar duração ao `--motion-base` |
| Lista de mensagens | sem stagger em massa (performance); só nova mensagem anima |
| Bell badge | pop 1× quando count sobe |

---

## 5. Mapa por tipo de tela (47 telas → padrão)

Não listar 47 nomes aqui — agrupar. Toda tela cai em um bucket; o polish do bucket se aplica.

| Bucket | Exemplos | Feeling dominante |
|---|---|---|
| Dashboard | Executivo, Marketing dashboard, RH overview | stagger + charts + soft cards |
| Kanban | Funil, Pós-venda, Entregas, Compras, RH recrutamento… | drag lift + drop settle |
| Tabela | Funcionários, Clientes, Pedidos, Usuários… | row hover + filter chips |
| Grade | Sinais, Tutoriais, Catálogo, ABM… | stagger curto + card hover |
| Formulário / Config | Settings, Perfil, Captura pública | focus + toggle + save feedback |
| Documento / leitura | Insights, Fair report, ESG | tipografia + cards de seção |
| Comunicação | Chat, Notificações | minimal; só feedback de ação |

Telas “mais simples” (ex.: placeholder de área, Tutoriais sem vídeo): **mesmo tokens**, menos motion — um fade de página basta.

---

## 6. Rollout (fases)

Ordem pensada para **sentir o feeling cedo** sem redesenhar 47 telas de uma vez.

| Fase | Escopo | Critério de pronto |
|---|---|---|
| **0** | Aprovar §2 (sombra A/B/C) + mockups A+ e padrões | ok do Daniel |
| **1** | Tokens em `index.css` + `prefers-reduced-motion` | build + visual ok no Painel |
| **2** | Painel Executivo (charts + KPI) | mockup A+ → `src` |
| **3** | Kanban compartilhado (card + drag lift) — uma família (CRM) depois RH/Marketing | drag em Funil |
| **4** | FilterBar / Tabs / Button / Select (ui/) | 2 telas tabela + 1 grade |
| **5** | Drawer shell (scrim + enter) sem mudar layout | Funil drawer |
| **6** | Restante por bucket quando a tela for tocada ( opportunista ) | sem big-bang |

**Não** abrir PR “polish em 47 telas”. Cada fase = spec curta + mock se for visual novo + gates.

---

## 7. Fora de escopo desta iniciativa

- Troca de shell (top nav / lateral nova)  
- Dark mode redesign  
- Som de UI  
- Nova densidade de board (já tem rollout próprio)  
- Reescrever Marketing cards inline → card compartilhado (backlog da spec de padrões; polish não depende disso)

---

## 8. Mockups deste plano

| Arquivo | Serve para |
|---|---|
| `polish-visao.html` | Painel com feeling (já na main) |
| `polish-padroes.html` | Kanban + filtros + dropdown + botões com motion |
| `atual.html` | baseline |

---

## 9. Aprovação

- [ ] Escolha §2: sombra **A / B / C**  
- [ ] Ok aos princípios §1 (minimal + reduced-motion; sem som agora)  
- [ ] Ok ao rollout §6 (fase 1–2 primeiro)  
- [ ] Ok para montar `polish-padroes.html` e só então planejar implementação Fase 1  

Depois do ok: plano de implementação por fase (não começa sozinho em `src/`).
