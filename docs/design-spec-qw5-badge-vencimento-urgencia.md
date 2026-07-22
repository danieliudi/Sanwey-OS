# QW5 — Badge de vencimento com cor por urgência (verde/amarelo/vermelho), não apenas texto neutro

## Problema observado

- `src/components/lead/LeadKanbanCard.jsx:152-154` — o rodapé do card (`Value + probability + close date`) renderiza `{probDisplay}% · {formatDateBR(lead.closeDate)}` inteiro dentro de um único `<span style={{ color: "var(--text-dim)" }}>`. `lead.closeDate` sai sempre no mesmo cinza neutro, esteja vencido há 60 dias ou daqui a 6 meses — nenhum sinal visual de urgência.
- `src/components/lead/LeadDetailDrawer.jsx:700-705` — o stat tile "Fechamento" (terceira coluna do grid `Unidades / Prob. / Fechamento`, linha 687) usa `background: "var(--surface)"`, `border: "1px solid var(--border)"` e `color: "var(--text)"` incondicionalmente. Mesmo problema: nenhuma diferenciação por urgência. (A tarefa citou `~696-701`; a leitura direta confirma que o bloco do tile "Fechamento" propriamente dito é `700-705` — a Prob. tile, que já usa cor de `company.primary`, ocupa `694-699`.)
- Já existe, no mesmo `LeadKanbanCard.jsx:21-29`, `agingStyle(days, slaDays)` — resolve exatamente este tipo de problema para outro badge (tempo na etapa), com 3 níveis e retorno `{bg, text, border}`. Porém essa função usa **hex literais fixos** (`#FEE2E2`/`#DC2626`/`#FECACA` para vermelho, `#FEF3C7`/`#D97706`/`#FDE68A` para âmbar) que não têm variante dark mode — funcionam hoje porque coincidem aproximadamente com os tokens semânticos do projeto, mas não trocam de valor no tema escuro. Esta spec **não** reaproveita esses hex literais; reaproveita o *vocabulário/padrão* (3 níveis, retorno `{bg,text,border}`) trocando por tokens CSS custom já existentes e theme-aware (ver abaixo). Ver nota de decisão subjetiva sobre isso.
- `isTerminal` já existe em `LeadKanbanCard.jsx:56` (`const isTerminal = Boolean(currentStage?.terminal);`), calculado a partir de `currentStage = stages?.find(s => s.id === lead.stage)` (linha 43). Cards terminais já ficam com `opacity: isTerminal ? 0.6 : 1` (linha 74).
- **Confirmado em `LeadDetailDrawer.jsx`**: a informação de etapa/terminal está disponível, só não é lida ainda. `companyStages` já existe na linha 123 (`const companyStages = (lead?.companyId && pipelines?.[lead.companyId]) || DEFAULT_PIPELINE_STAGES;`) e cada objeto de etapa carrega `.terminal` (confirmado em `src/constants/pipelines.js:14-15`: as etapas `ganho` e `perdido` têm `terminal: true`). Dá para replicar a mesma lógica de exclusão do Kanban com `companyStages.find(s => s.id === lead.stage)?.terminal`.

## Vocabulário de tokens já em uso (grep `var(--` + `src/index.css`)

| Token | Light | Dark | Uso já estabelecido |
|---|---|---|---|
| `var(--danger)` / `var(--danger-bg)` | `#B91C1C` / `#FEF2F2` | `#F87171` / `rgba(248,113,113,0.12)` | `StageFieldInput.jsx:24` (campo obrigatório vazio), `RHFuncionariosView.jsx:138` |
| `var(--amber)` / `var(--amber-bg)` | `#E8920A` / `#FEF3C7` | `#FBBF24` / `rgba(251,191,36,0.12)` | `NotificationCenter.jsx:183`, `RHOverviewView.jsx:573-574`. `#E8920A` (valor bruto de `--amber`) já aparece hardcoded no próprio `LeadDetailDrawer.jsx:764` para `capture_priority === "Média"` — ou seja, este arquivo já trata essa cor como "atenção/médio", só não via token. |
| `color-mix(in srgb, var(--amber) 20%, transparent)` | — | — | padrão já usado para borda suavizada em `RHOverviewView.jsx:574`; reaproveitado aqui em vez de inventar uma borda hex nova |
| `var(--text-dim)` / `var(--text)` | `#57534E` / `#37352F` | `#B5B3A8` / `#EBEBDF` | texto neutro padrão — o que hoje é usado sempre, sem diferenciação |
| `var(--surface)` / `var(--border)` | `#FFFFFF` / `#E9E8E5` | `#242422` / `#3A3A36` | fundo/borda neutros do tile "Fechamento" hoje |

`var(--danger)`/`var(--amber)` cobrem os dois estados ativos pedidos (vermelho/âmbar). Não existe, e não é preciso criar, um token "verde" — ver nota de decisão subjetiva sobre o título da tarefa mencionar "verde/amarelo/vermelho".

## Especificação visual

### Helper novo: `closeDateUrgencyStyle(closeDate)`

Local recomendado: `src/utils/date.js` (mesmo arquivo de onde `formatDateBR` e `daysSince` já são importados nos dois arquivos-alvo) — evita duplicar a mesma lógica/limiar em dois componentes e o risco de os dois divergirem com o tempo. Ver nota de decisão subjetiva para a alternativa (duplicar local, no padrão do `agingStyle`).

```js
// src/utils/date.js — usa o daysSince(input) que já existe no mesmo arquivo
export function closeDateUrgencyStyle(closeDate) {
  if (!closeDate) return null;
  const days = daysSince(closeDate); // > 0 = já passou; <= 0 = hoje ou futuro
  if (days > 0) {
    return {
      bg: "var(--danger-bg)",
      text: "var(--danger)",
      border: "color-mix(in srgb, var(--danger) 20%, transparent)",
    };
  }
  if (days >= -7) {
    return {
      bg: "var(--amber-bg)",
      text: "var(--amber)",
      border: "color-mix(in srgb, var(--amber) 20%, transparent)",
    };
  }
  return null; // neutro — nenhuma mudança visual, mantém o render atual
}
```

Contrato: retorna `null` para "sem urgência" (closeDate ausente, ou a mais de 7 dias no futuro) — o chamador simplesmente não aplica nenhum estilo extra nesse caso, preservando o visual neutro atual. Retorna `{bg, text, border}` (mesma forma de `agingStyle`) só para os dois estados ativos.

**Limiares** (dias corridos, comparando `closeDate` com o momento atual — mesma semântica de `daysSince`, que já resolve o parsing de "AAAA-MM-DD" como meia-noite local, evitando o bug de fuso horário documentado no próprio arquivo):

| Estado | Condição | Cor |
|---|---|---|
| Vencida | `closeDate` no passado (`days > 0`) | vermelho — `var(--danger-bg)` / `var(--danger)` / borda `color-mix(..., var(--danger) 20%, ...)` |
| Próxima | `closeDate` é hoje ou daqui até 7 dias, inclusive (`-7 <= days <= 0`) | âmbar — `var(--amber-bg)` / `var(--amber)` / borda `color-mix(..., var(--amber) 20%, ...)` |
| Sem destaque | `closeDate` a mais de 7 dias no futuro, ou ausente | neutro — sem badge, visual atual inalterado |

**Exclusão em etapa terminal**: a função em si não sabe de `isTerminal` (não é responsabilidade dela) — a checagem é feita no chamador, no mesmo padrão que `LeadKanbanCard.jsx` já usa para `ageStyle` (`daysInStage !== null ? agingStyle(...) : null`, linha 45): só chamar `closeDateUrgencyStyle` quando `!isTerminal`.

### `LeadKanbanCard.jsx`

1. Import: adicionar `closeDateUrgencyStyle` ao import já existente de `"../../utils/date"` (linha 9).
2. Logo após `const isTerminal = ...` (linha 56), adicionar:
   ```js
   const closeStyle = !isTerminal ? closeDateUrgencyStyle(lead.closeDate) : null;
   ```
3. Substituir o bloco `{probDisplay}% · {formatDateBR(lead.closeDate)}` (linhas 152-154) para colorir **só a data**, mantendo a probabilidade neutra como já é hoje:
   ```jsx
   <span style={{ color: "var(--text-dim)" }}>
     {probDisplay}%{" "}·{" "}
     {closeStyle ? (
       <span
         className="px-1 py-0.5 rounded font-bold"
         style={{
           background: closeStyle.bg,
           color: closeStyle.text,
           border: `1px solid ${closeStyle.border}`,
         }}
       >
         {formatDateBR(lead.closeDate)}
       </span>
     ) : (
       formatDateBR(lead.closeDate)
     )}
   </span>
   ```
   Sem ícone — o badge de aging (SLA) já usa `Clock` no topo do card; colocar outro ícone no rodapé polui visualmente um card já denso. Cor + fundo + borda já é suficiente sinal.

### `LeadDetailDrawer.jsx`

1. Import: adicionar `closeDateUrgencyStyle` ao import já existente de `"../../utils/date"` (linha 19).
2. Logo após `if (!lead || !company) return null;` (linha 410) — ponto onde `lead`/`company` já estão garantidos não-nulos, mesmo padrão de outras consts simples do corpo do componente (ex. `canDelete`, linha 498) — adicionar:
   ```js
   const currentStageInfo = companyStages.find(s => s.id === lead.stage);
   const isTerminalStage = Boolean(currentStageInfo?.terminal);
   const closeStyle = (lead.closeDate && !isTerminalStage) ? closeDateUrgencyStyle(lead.closeDate) : null;
   ```
3. Tile "Fechamento" (linhas 700-705) — em vez de um badge inline dentro do tile, aplicar a cor de urgência ao **tile inteiro** (bg/border/texto), no mesmo padrão visual que o tile "Prob." ao lado já usa para tingir fundo/borda com `company.primary` (linhas 694-699). Mantém os três tiles com a mesma linguagem visual (fundo tingido + borda tingida + valor colorido; label pequena sempre neutra):
   ```jsx
   <div
     className="rounded-lg p-2"
     style={{
       background: closeStyle ? closeStyle.bg : "var(--surface)",
       border: `1px solid ${closeStyle ? closeStyle.border : "var(--border)"}`,
     }}
   >
     <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--text-dim)", letterSpacing: "0.08em" }}>Fechamento</div>
     <div className="text-xs font-bold mt-0.5 truncate" style={{ color: closeStyle ? closeStyle.text : "var(--text)" }}>
       {lead.closeDate ? formatDateBR(lead.closeDate).replace(/(\d{2}\/\d{2}\/)\d{2}(\d{2})$/, "$1$2") : "—"}
     </div>
   </div>
   ```
   A label "Fechamento" continua sempre `var(--text-dim)` (mesmo padrão do tile "Prob.", cuja label também nunca muda de cor) — só o fundo/borda/valor reagem à urgência.

## Comportamento (quando cada estado aparece)

1. **Vencida (vermelho)** — `lead.closeDate` é anterior à data/hora atual. Aparece nos dois lugares (badge no rodapé do card Kanban; tile inteiro tingido no drawer), exceto quando o lead está em etapa terminal (ver item 4).
2. **Próxima (âmbar)** — `lead.closeDate` cai entre hoje e os próximos 7 dias, incluindo hoje e o 7º dia. Mesma exceção de etapa terminal.
3. **Sem destaque (neutro)** — `lead.closeDate` mais de 7 dias no futuro, ou o campo está vazio (`null`/`undefined`, exibido como "—" no drawer). Visual idêntico ao que existe hoje, nenhuma mudança.
4. **Etapa terminal (ganho/perdido)** — mesmo que `closeDate` esteja no passado, nenhuma cor de urgência é aplicada, em nenhum dos dois arquivos. No Kanban, o card já fica com `opacity: 0.6` (isso não muda); a data de fechamento simplesmente permanece no cinza neutro de sempre, tanto no card quanto no tile do drawer.
5. **Atualização em tempo real**: como o cálculo depende só de `Date.now()` no momento do render (via `daysSince`), o estado do badge muda naturalmente entre sessões/reloads à medida que os dias passam — não precisa de nenhum polling ou timer novo; mesmo comportamento que `agingStyle` já tem hoje para o badge de SLA.

## Notas de decisão subjetiva

- **Título da tarefa menciona "verde/amarelo/vermelho" (3 cores), mas o corpo da tarefa define só 2 estados ativos + neutro** ("vencida = vermelho; próxima = âmbar; do contrário = neutro/sem destaque"). Segui a definição literal e mais específica do corpo, não o título — que lI como metáfora de semáforo, não como um terceiro estado "verde" a implementar de fato. Adicionar um "verde" exigiria inventar um limiar extra (o que conta como "longe o suficiente para ser tranquilizador"?) que a tarefa não especifica, e "sem destaque" no texto já sugere explicitamente nenhum badge nesse caso — não uma badge verde. Se o time realmente quiser um terceiro estado verde visível (ex. "dentro do trimestre" ou similar), é uma decisão de produto nova, não coberta aqui.
- **Badge com fundo+borda (pill) em vez de só colorir o texto**: a tarefa pediu explicitamente o padrão de retorno `{bg, text, border}` — isso só faz sentido se os 3 campos forem de fato usados visualmente (fundo + borda + texto), não só o `text`. Optei por isso em vez de simplesmente trocar a cor do texto sem fundo, o que seria uma mudança mais sutil e mais fácil de não notar num board com muitos cards.
- **Limiar de 7 dias para "próxima"**: a tarefa pediu explicitamente que esse número fosse decidido por este agente ("ex. 7 dias — o design-agent decide o número exato"). Escolhi manter exatamente os 7 dias sugeridos como exemplo — é uma janela de "1 semana de antecedência", compatível com o ritmo de vendas B2B do CRM (ciclos medidos em semanas/meses, não em dias) e não exige nenhuma constante nova além da que já foi cogitada na própria tarefa. Se o time achar 7 dias curto ou longo demais na prática, é um número fácil de ajustar depois (uma única constante no helper).
- **Local do helper novo (`src/utils/date.js`, compartilhado) vs. duplicar em cada arquivo (padrão atual do `agingStyle`, que só existe localmente em `LeadKanbanCard.jsx`)**: optei pelo compartilhado porque a mesma lógica/limiar é necessária nos dois arquivos-alvo desta tarefa — duplicar aumentaria o risco de os dois badges divergirem silenciosamente se alguém ajustar o limiar em só um lugar no futuro. A alternativa (função local idêntica em cada arquivo, replicando o padrão existente do `agingStyle`) também é válida e mais "auto-contida" por arquivo — se o time preferir esse estilo por consistência com o código já existente, é só copiar o corpo da função para dentro de cada componente em vez de importar de `utils/date.js`.
- **Bordas com `color-mix()` em vez de um hex fixo novo**: segui o padrão já usado em `RHOverviewView.jsx:574` (`color-mix(in srgb, var(--amber) 20%, transparent)`) em vez de inventar um hex de borda tipo `#FDE68A`/`#FECACA` (que é o que `agingStyle` usa hoje). Isso deriva a borda diretamente do token semântico e já se ajusta sozinho ao dark mode, sem exigir um segundo token dedicado.
- **Achado colateral, fora de escopo**: `agingStyle` (`LeadKanbanCard.jsx:21-29`) usa hex fixos que não trocam no dark mode — provavelmente um gap pré-existente, não introduzido por esta tarefa. Não alterei essa função (só a citei como referência de vocabulário/padrão a não copiar), mas fica registrado caso o time queira migrá-la para os mesmos tokens desta spec numa spec separada.
