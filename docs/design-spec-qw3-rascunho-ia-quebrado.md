# QW3 — Rascunho de IA (aba IA do card) gera frase quebrada e saudação sem fallback de nome

## Problema observado

Ambos os bugs vivem no mesmo `useMemo` `emailDraft`, `src/components/lead/LeadDetailDrawer.jsx:382-387`, consumido pelo bloco "Rascunho de abordagem" da aba IA (`LeadDetailDrawer.jsx:914-937`).

- **Bug A — saudação sem fallback de nome** (`LeadDetailDrawer.jsx:375`):
  ```js
  const decisionMakerName = lead?.decisionMaker?.name || "—";   // linha 369
  ...
  const firstName = decisionMakerName?.split(" ")[0] || "time"; // linha 375
  ```
  Quando o card não tem decisor cadastrado, `decisionMakerName` vale o placeholder literal `"—"` (travessão). `"—".split(" ")` retorna `["—"]`, então `firstName` vira `"—"` — uma string não vazia, portanto truthy — e o `|| "time"` nunca dispara. Resultado renderizado em `LeadDetailDrawer.jsx:935`: **"Olá —,"** em vez de **"Olá time,"**.
  - Note que o `useMemo` vizinho `decisionMakerInitials` (`LeadDetailDrawer.jsx:371-374`) já resolve esse mesmo problema corretamente, com guarda explícita: `if (!decisionMakerName || decisionMakerName === "—") return "—";`. `firstName` (linha 375) é a única derivação de `decisionMakerName` no arquivo que não tem essa guarda.

- **Bug B — frase de abertura com buraco gramatical** (`LeadDetailDrawer.jsx:386`):
  ```js
  return `Olá ${firstName},\n\nIdentifiquei que a ${lead.company} teve ${(lead.evidence || "").toLowerCase()}.\n\n...`;
  ```
  Quando `lead.evidence` é vazio/nulo — caso real: leads criados via `CnpjLookupCard.jsx`, `FairImportView.jsx` ou entrada manual sem preenchimento de gatilho — a frase renderizada fica **"Identifiquei que a {empresa} teve ."** (nada entre "teve" e o ponto, ponto solto). Texto gramaticalmente quebrado, enviado como está para o campo de e-mail em `handleStartOutreach` (`LeadDetailDrawer.jsx:441-446`) se o usuário clicar em "Iniciar abordagem" sem revisar.

## Especificação visual

Bug puramente textual/lógico — não introduz nem altera nenhum estado visual, cor, borda ou token. O container "Rascunho de abordagem" (`LeadDetailDrawer.jsx:915`, fundo `company.dark`, texto branco/`rgba(255,255,255,0.92)`) permanece exatamente como está; só o conteúdo da string muda. Não há necessidade de novos tokens `var(--...)` nem de hex novo — nenhuma cor por frente comercial entra em jogo aqui (o texto do rascunho não é tingido por `COMPANIES[companyId].primary`, é sempre a cor de texto fixa já usada dentro do card escuro).

### Bug A — derivação de `firstName`

Espelhar a mesma guarda que `decisionMakerInitials` já usa para o placeholder `"—"`, em vez de confiar em `|| "time"` sozinho:

| Antes | Depois |
|---|---|
| `const firstName = decisionMakerName?.split(" ")[0] \|\| "time";` | `const firstName = (decisionMakerName && decisionMakerName !== "—") ? decisionMakerName.split(" ")[0] : "time";` |

Isso cobre os três casos que hoje colapsam incorretamente no mesmo `"—"`: `decisionMaker` ausente, `decisionMaker.name` `null`/`undefined`, e `decisionMaker.name` string vazia (todos caem em `decisionMakerName === "—"` por causa do `|| "—"` da linha 369) — em todos, `firstName` deve resolver para `"time"`.

### Bug B — frase de abertura condicional a `evidence`

Extrair a frase de abertura do template literal único para uma variável `openingLine`, calculada antes do `return`, com dois ramos — um dependente de `evidence`, outro que não depende (nem de `evidence`, nem de `triggerLabel`, que também pode ser `null` no banco — ver `use-leads.js:80`, `trigger_label ?? null`):

```js
const hasEvidence = Boolean(lead.evidence && lead.evidence.trim());
const openingLine = hasEvidence
  ? `Identifiquei que a ${lead.company} teve ${lead.evidence.toLowerCase()}.`
  : `Estou acompanhando o momento da ${lead.company} e acredito que possamos ajudar em algo relevante agora.`;
```

E o `return` do `useMemo` passa a interpolar `openingLine` no lugar do trecho fixo:

```js
return `Olá ${firstName},\n\n${openingLine}\n\nSou da ${company.name} e gostaria de entender melhor como podemos apoiar nesse momento.\n\nPodemos agendar 20 minutos esta semana?\n\nAbraço,\n${senderName}${senderEmail}\n${company.name}`;
```

`lead.company` é seguro de usar sem guarda em ambos os ramos — já é interpolado sem fallback em outros pontos do mesmo componente sem checagem (ex.: header mobile, `LeadDetailDrawer.jsx:539`; assunto do `mailto:`, `LeadDetailDrawer.jsx:442`), então tratá-lo como sempre presente aqui é consistente com o resto do arquivo, não uma checagem nova a inventar.

## Comportamento (quando cada estado aparece)

1. **Card tem decisor com nome preenchido** (`lead.decisionMaker.name` = ex. "Marcos Ribeiro") — `firstName` = `"Marcos"` (primeiro token do nome). Comportamento inalterado — este caso já funcionava.
2. **Card sem decisor cadastrado, ou `decisionMaker.name` vazio/nulo** — `decisionMakerName` resolve a `"—"` (linha 369) → com o fix, `firstName` = `"time"` → saudação renderizada: **"Olá time,"**. Este é o caso que hoje quebra (renderiza **"Olá —,"**).
3. **`lead.evidence` preenchido** (ex.: `"Auto de infração IBAMA 9.872.143/2026 — acondicionamento irregular Classe I"`) — `hasEvidence` é `true` → frase renderizada: **"Identifiquei que a {empresa} teve auto de infração ibama 9.872.143/2026 — acondicionamento irregular classe i."**. Comportamento inalterado — este caso já funcionava.
4. **`lead.evidence` vazio, `null`, ou só espaços em branco** (leads sem gatilho específico registrado) — `hasEvidence` é `false` → frase renderizada: **"Estou acompanhando o momento da {empresa} e acredito que possamos ajudar em algo relevante agora."** — nunca mais o "teve ." quebrado. Este é o caso que hoje quebra.
5. Os dois bugs são independentes entre si e podem ocorrer isolados ou simultaneamente no mesmo rascunho (ex.: card sem decisor **e** sem evidence cadastrados) — o fix cobre a combinação das 4 variações (2 casos de `firstName` × 2 casos de `openingLine`) sem interação entre elas.
6. Nenhuma mudança de comportamento fora do `useMemo emailDraft`: `decisionMakerInitials` (avatar do decisor em outro ponto da UI), `decisionMakerName`/`decisionMakerRole` (exibidos em texto em outras partes do drawer) e o botão "Iniciar abordagem" (`handleStartOutreach`) continuam consumindo os mesmos valores de sempre — só o conteúdo de `emailDraft` muda.

## Notas de decisão subjetiva

- **Redação exata de `openingLine` no caso sem evidence**: a tarefa deixou a frase a critério do design-agent, só exigindo que não dependa de `evidence`. Optei por **não** usar `lead.triggerLabel` como substituto dentro da mesma estrutura de frase ("teve {triggerLabel}") porque `triggerLabel` (rótulo curto, 2-4 palavras, ex. "Auto IBAMA", "Contrato multi-anual") não é gramaticalmente meia-frase como `evidence` é (`evidence` é escrito como complemento verbal completo, ex. "auto de infração..."; `triggerLabel` é um rótulo nominal curto) — encaixar `triggerLabel` no molde "teve {triggerLabel}" arriscaria o mesmo tipo de estranhamento gramatical noutros casos (ex. "teve contrato multi-anual" é aceitável, mas "teve re-certificação inmetro" soa estranho). Preferi uma frase genérica auto-suficiente que nunca depende de nenhum campo potencialmente ausente do lead além de `lead.company` (que já é tratado como sempre presente no resto do componente). Se o time preferir aproveitar `triggerLabel` como uma abertura alternativa mais específica que a genérica proposta, isso é uma iteração de copy possível, mas exigiria uma frase com estrutura própria (não reaproveitando o molde "teve X") — fora do escopo mínimo deste fix.
- **Checagem `lead.evidence.trim()` além de truthy**: a tarefa fala em "vazio/nulo"; adicionei `.trim()` para também cobrir o caso de `evidence` só com espaços em branco (ex. `"   "`), que passaria no teste `Boolean(lead.evidence)` mas ainda produziria a mesma frase quebrada (só com espaço em vez de nada antes do ponto). É uma extensão pequena e direta do mesmo requisito, não uma mudança de escopo.
- **Guarda de `firstName` comparando com o literal `"—"` em vez de criar um sentinel/constante compartilhada**: segui o padrão já existente em `decisionMakerInitials` (linha 372), que faz a mesma comparação com o mesmo literal. Introduzir uma constante `const NO_DECISION_MAKER = "—"` para os dois usos seria mais limpo, mas é uma refatoração que vai além do fix pontual pedido — sinalizo a possibilidade, não a incluí no fix mínimo.
