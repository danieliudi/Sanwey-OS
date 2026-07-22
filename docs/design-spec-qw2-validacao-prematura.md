# QW2 — Validação prematura no formulário "Novo card"

## Problema observado

- `src/components/lead/StageFieldInput.jsx:16` — `isMissingRequired = (field.effectiveRequired ?? field.required) && !hasValue` não tem nenhum fator de "o usuário já interagiu com este campo" ou "já tentou enviar o formulário". É `true` no primeiro render sempre que o campo é obrigatório e está vazio.
- `src/components/lead/StageFieldInput.jsx:18-29` — o `<div>` wrapper renderiza incondicionalmente, sempre que `isMissingRequired` é `true`: fundo `#FEF2F2`, borda `1px solid #FECACA` e o texto "Campo obrigatório" em `#B91C1C`. Como isso é avaliado já no primeiro render, todo campo customizado obrigatório da etapa de destino aparece com erro antes de qualquer digitação.
- Esse componente é compartilhado por dois consumidores com semânticas diferentes:
  - `src/components/lead/LeadCreateModal.jsx:625-631` — formulário de **criação**. Aqui o comportamento atual é o bug relatado: card ainda não existe, usuário não teve chance de preencher nada, e já vê erro.
  - `src/components/lead/LeadDetailDrawer.jsx:1041-1047` — edição de um card **já existente**. Aqui mostrar "campo obrigatório pendente" sempre é uma feature intencional (sinaliza incompletude de um card já criado, mesmo sem o usuário ter acabado de mexer nele). **Não alterar esse comportamento.**
- Mesma classe de bug, efeito visual reduzido (só borda, sem texto), em `src/components/lead/LeadCreateModal.jsx:82-98` (`FieldInput` local, tipo `"sector"`) — `src/components/lead/LeadCreateModal.jsx:90`: `borderColor: configEntry.required && !value ? "var(--accent)" : "#D1D5DB"`, avaliado incondicionalmente. O select "Setor" abre com borda de erro antes de qualquer interação.
- Achado adicional (fora do relato original, mas nas mesmas linhas que serão tocadas): a cor usada para sinalizar "obrigatório vazio" hoje é inconsistente com o resto do design system — ver seção de tokens abaixo.

## Especificação visual

### Vocabulário de tokens já em uso (levantado via grep em `var(--` nos 3 arquivos + `src/index.css`)

| Token | Light | Dark | Uso já estabelecido no CRM |
|---|---|---|---|
| `var(--danger)` | `#B91C1C` | `#F87171` | `LeadDetailDrawer.jsx:1129,1143` — borda e texto do erro de e-mail inválido (`contactEmailError`) |
| `var(--danger-bg)` | `#FEF2F2` | `rgba(248,113,113,0.12)` | tom de fundo para estados de erro (definido no design system, ainda não consumido por nenhum destes 3 arquivos) |
| `var(--accent)` | dinâmico — setado em runtime por `TopBar.jsx`/`SettingsView.jsx` a partir de `COMPANIES[companyId].primary` | idem | cor de ação/marca (botões, links, foco). **Não é um token semântico de erro** — varia por frente (`#C7212B` Sanwey, `#1A6E35` Resibag, `#2D3436` Grupo) |
| `var(--border)` | `#E9E8E5` | `#3A3A36` | borda neutra padrão |
| `var(--text-dim)` | `#57534E` | `#B5B3A8` | labels, texto secundário |

### Estado "campo obrigatório vazio" — `StageFieldInput.jsx`

Trocar os 3 literais hardcoded pelos tokens semânticos já existentes (`--danger` / `--danger-bg`), em vez de inventar hex novo:

| Elemento | Antes (hardcoded) | Depois (token) |
|---|---|---|
| `background` do wrapper `<div>` | `#FEF2F2` | `var(--danger-bg)` |
| `border` do wrapper `<div>` | `1px solid #FECACA` | `1px solid var(--danger)` |
| `color` do texto "Campo obrigatório" | `#B91C1C` | `var(--danger)` |

Observação: `#FEF2F2` e `#B91C1C` já são, byte a byte, o valor light-mode atual de `--danger-bg` e `--danger` — a troca não altera nada visualmente no tema claro, mas corrige o tema escuro (hoje o box de erro fica com as cores fixas do modo claro dentro de uma UI escura, sem contraste adequado). A única mudança perceptível é a borda: `#FECACA` (rosa claro) não tem token equivalente exato; a proposta usa `var(--danger)` sólido, espelhando o padrão já usado em `LeadDetailDrawer.jsx:1129` para o erro de e-mail (borda sólida `var(--danger)`, sem tom suavizado). Ver nota de decisão subjetiva sobre isso.

Não há transição/animação nova a adicionar: o restante do componente já troca cor de borda de forma instantânea no focus/blur (`handleFocus`/`handleBlur`, linhas 45-46), sem `transition` em CSS. Manter o aparecimento do box de erro também instantâneo, por consistência.

Continua fora de escopo (não mexer): o asterisco `*` vermelho que marca campo obrigatório no `<label>` (`LeadCreateModal.jsx:524,622`, `LeadDetailDrawer.jsx:1035`) usa `var(--accent)` — isso é só um marcador estático de "este campo é obrigatório", correto e sempre visível independente de `touched`; não é o sinalizador de erro.

### Estado "campo obrigatório vazio" — `FieldInput` local, campo "sector" (`LeadCreateModal.jsx:90`)

| Elemento | Antes | Depois |
|---|---|---|
| `borderColor` quando obrigatório+vazio | `var(--accent)` | `var(--danger)` |
| `borderColor` default (não-erro) | `#D1D5DB` | `#D1D5DB` (sem mudança — é o literal neutro já usado em todo `baseStyle` deste arquivo, fora de escopo normalizar para `var(--border)` aqui) |

### Prop nova: `touched` em `StageFieldInput`

```
StageFieldInput({ field, value, onChange, users, companyId, touched = true })
```

- `isMissingRequired = touched && (field.effectiveRequired ?? field.required) && !hasValue`
- Default `true` preserva 100% do comportamento atual em `LeadDetailDrawer.jsx:1041` (não passa a prop → `touched` sempre `true` → sinalização imediata de campo pendente continua igual).
- Em `LeadCreateModal.jsx`, todo `<StageFieldInput>` renderizado passa `touched={submitAttempted || touchedKeys.has(field.fieldKey)}`.

### Estado equivalente no `FieldInput` local (campo "sector")

- Mesma fonte de verdade: `touched = submitAttempted || touchedKeys.has("sector")`.
- `borderColor: touched && configEntry.required && !value ? "var(--danger)" : "#D1D5DB"`.

## Comportamento (quando cada estado aparece)

1. **Abertura do modal "Novo card"** — nenhum campo foi tocado, `submitAttempted = false`, `touchedKeys` vazio → `touched = false` em todos os campos → nenhum campo mostra fundo/borda/texto de erro, mesmo que vários campos obrigatórios estejam vazios (é exatamente isto que fecha o bug relatado).
2. **Usuário foca um campo e sai (blur) sem preencher** — o `fieldKey` (ou `"sector"`) entra em `touchedKeys` → daquele ponto em diante, só **aquele campo** passa a avaliar `isMissingRequired` de verdade; se continuar vazio, mostra o erro (escopo por campo, não o formulário inteiro).
3. **Usuário clica em "Criar" com 1+ campo obrigatório vazio** — a validação já existente (`LeadCreateModal.jsx:318-332`) barra o submit e chama `setError(...)` (mensagem no topo do formulário, comportamento já correto, **sem alteração**). Nesse mesmo momento, `submitAttempted` vira `true`. A partir daqui `touched` é `true` para **todos** os campos (`submitAttempted || touchedKeys.has(...)` sempre resolve `true`) — todo campo obrigatório ainda vazio acende o erro de uma vez, dando ao usuário o quadro completo do que falta, independente de já ter passado por aquele campo.
4. **`submitAttempted` é um latch por sessão do modal aberto** — uma vez `true`, não volta a `false` enquanto o modal continuar aberto (mesmo que o usuário tente enviar de novo e falhe por outro motivo, ex.: CNPJ inválido). Reseta junto com `values`/`customValues`/`error` no `useEffect` que já roda quando `open` vira `true` (`LeadCreateModal.jsx:278-287`) — `touchedKeys` e `submitAttempted` devem ser resetados ali também, para o próximo card criado começar limpo.
5. **Erro de formato inline** (`StageFieldInput.jsx:12,23-25`, ex.: telefone/e-mail com máscara inválida) — **não precisa de gating por `touched`**: por construção só aparece quando `hasValue` é `true` (a validação de formato roda sobre o valor digitado), então nunca é prematuro. Nenhuma mudança necessária nesse trecho.
6. **`LeadDetailDrawer.jsx:1041`** — não passa `touched`, portanto default `true` mantém o comportamento atual sem qualquer alteração: card já existente continua sinalizando campo obrigatório pendente imediatamente ao abrir o drawer, sem depender de blur ou tentativa de submit.

## Notas de decisão subjetiva

- **Troca de `var(--accent)` por `var(--danger)` para o estado de erro**: isso vai além do pedido literal (que era só sobre o gating por `touched`), mas foi encontrado nas mesmas linhas que já seriam tocadas e é uma inconsistência semântica real: `--accent` é setado em runtime por frente comercial (`TopBar.jsx` a partir de `COMPANIES[companyId].primary`) — em contexto Resibag ele é verde (`#1A6E35`). Usar `--accent` para indicar "campo obrigatório vazio" faz o indicador de erro sair **verde** quando a frente ativa é Resibag, o que é semanticamente invertido (verde tende a significar "ok", não "erro"). `--danger` é o token de status que já cobre esse caso (mesmo valor em todos os temas/frentes) e já tem precedente direto no mesmo componente vizinho (`LeadDetailDrawer.jsx:1129,1143`, erro de e-mail). Recomendo incluir a troca junto com o fix de `touched`, mas sinalizo que é uma correção adicional, não estritamente pedida — se o time preferir escopo mínimo (só o gating por `touched`, mantendo `var(--accent)`), o bug relatado (validação prematura) ainda fica resolvido, só que o card em Resibag continuaria acendendo verde para "obrigatório vazio".
- **Borda `var(--danger)` sólida vs. tom suavizado**: o `#FECACA` original é uma borda rosa-clara (mais suave que o preenchimento de texto). Trocar para `var(--danger)` sólido deixa a borda visualmente mais forte que hoje. Escolhi espelhar o precedente já existente em `LeadDetailDrawer.jsx:1129` (borda sólida `var(--danger)`, sem variante suavizada) por consistência dentro do próprio design system, em vez de introduzir uma expressão nova tipo `color-mix(in srgb, var(--danger) 35%, transparent)` (que existe como padrão só para `--accent-tint`, não para `--danger`). Se o peso visual mais forte não for desejado, a alternativa é manter esse `color-mix` com `--danger` — mas isso seria um token derivado novo, não um token já em uso.
- **Escopo do "generalizar pros campos base"**: no `FieldInput` local, só o campo `"sector"` tem hoje alguma borda condicional a `required && !value` (linha 90). Nenhum outro campo base (texto, e-mail, telefone, data, moeda, usuário) tem esse tratamento — o único sinal de obrigatoriedade deles é o asterisco no label e a mensagem de `setError` no submit. Interpretei "generalizar" como "usar a mesma fonte de `touched` para o único campo que já tem essa borda", não como "adicionar highlight de erro a campos que nunca tiveram" — isso seria escopo novo, não parte do fix de QW2.
- **Cautela de implementação (não é decisão de design, é aviso)**: se `touchedKeys` for um único `Set` compartilhado entre `fieldKey`s de campos customizados da etapa e `id`s de campos base (ex.: `"sector"`), confirmar que não há colisão de string entre os dois namespaces antes de inserir ambos no mesmo `Set`.
