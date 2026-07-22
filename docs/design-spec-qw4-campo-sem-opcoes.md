# QW4 — Campo "Status da Prospecção" sem nenhum input visível no formulário de novo card

## Problema observado

- `src/components/lead/StageFieldInput.jsx:36-52` — `renderInput()` calcula `const opts = Array.isArray(field.options) ? field.options : []` (linha 52) e nunca verifica se `opts` está vazio antes de despachar para os branches `"radio"`, `"multicheck"` e `"select"`.
- `src/components/lead/StageFieldInput.jsx:108-119` (branch `"radio"`) — renderiza um `<div style={{ display:"flex", flexDirection:"column", gap:6 }}>` cujo único conteúdo é `opts.map(...)` (linha 111). Quando `opts = []`, esse `<div>` fica sem nenhum filho: nem um `<label>`, nem um `<input>` — um espaço vazio abaixo do `<label>` do campo, sem nenhum sinal de que algo deveria estar ali.
- `src/components/lead/StageFieldInput.jsx:121-134` (branch `"multicheck"`) — mesmo padrão, `opts.map(...)` na linha 126 dentro de um `<div>` sem fallback.
- `src/components/lead/StageFieldInput.jsx:95-106` (branch `"select"`) — variante menos severa: o `<select>` em si é renderizado (linhas 96-104), então não fica um vazio total; mas com `opts = []` a única `<option>` é o placeholder (linha 102, `"Selecione"` ou `field.placeholder`) — um dropdown que abre e não mostra nenhuma opção real, sem qualquer texto indicando que o campo está mal configurado. Indistinguível, para quem preenche o formulário, de "ainda não escolhi" quando na verdade é "não há o que escolher".
- Causa raiz confirmada via SQL (já corrigida no banco pelo orquestrador, não repetir): `pipeline_stage_fields` tinha uma linha `company_id="industria"`, `stage_id="prospeccao"`, `field_key="status_prospeccao"`, `label="Status da Prospecção"`, `field_type="radio"`, `options=[]`. O UPDATE que populou `options` já foi aplicado — o que falta é só o código defensivo em `renderInput()`.
- Classe de bug generalizada (o motivo de tratar isso como fix estrutural, não só um patch pontual): qualquer campo `radio`/`select`/`multicheck` configurado em `pipeline_stage_fields` sem `options` — erro de cadastro, migração incompleta, etapa nova sem opções ainda preenchidas — vira um buraco silencioso no formulário. Não há erro no console, não há mensagem, não há diferença visual entre "campo sem opções" e "layout quebrado" — só um espaço em branco onde deveria haver um controle.
- Componente compartilhado por dois consumidores: `src/components/lead/LeadCreateModal.jsx:644-651` (criação) e presumivelmente `LeadDetailDrawer.jsx` (edição, mesmo `StageFieldInput`) — o fix em `renderInput()` cobre os dois automaticamente, sem precisar de mudança nos consumidores.

### Verificação do `FieldInput` local em `LeadCreateModal.jsx` (campos base do lead)

- `src/components/lead/LeadCreateModal.jsx:66-227` — existe um componente `FieldInput` próprio, mas **não tem nenhum branch `radio` ou `multicheck`**.
- Único par de branches `select`: `"sector"` (linhas 82-99) e `"state"` (linhas 101-117). Ambos consomem listas **hardcoded e nunca vazias**: `CANONICAL_SECTORS` (`src/constants/taxonomy.js:5-12`, 6 itens fixos) e `CANONICAL_STATES` (`src/constants/taxonomy.js:14-18`, 27 UFs fixas). Não há caminho de dados (banco, config de etapa) que possa zerar essas listas em runtime.
- O branch `"user"` (linhas 119-135) usa `<AssigneeMultiSelect>`, um componente diferente — não é o padrão `opts.map()` dentro de `<select>`/`<div>` que este fix está endereçando. Fica fora do escopo desta spec (ver nota de decisão subjetiva).
- Conclusão: **`LeadCreateModal.jsx` não precisa de nenhuma alteração.** A condição de saída dada na tarefa ("se os campos base ali só usam select com pelo menos uma option hardcoded, nunca vazia, não precisa mexer") se confirma integralmente.

## Especificação visual

### Vocabulário de tokens já em uso (levantado via grep em `var(--` + `src/index.css`)

| Token | Light | Dark | Uso já estabelecido no CRM |
|---|---|---|---|
| `var(--warning)` | `#B45309` | `#FBBF24` | dezenas de usos para "precisa de atenção/configuração" — ex. `src/components/views/RHFuncionariosView.jsx:326-327`, `src/components/shared/DocumentCaptureModal.jsx:131` (com ícone `AlertTriangle`), `src/components/views/SettingsView.jsx:1445` |
| `var(--warning-bg)` | `#FEF3C7` | `rgba(251,191,36,0.12)` | fundo companion de `--warning` nos mesmos locais acima |
| `#FDE68A` | fixo (não tem token dedicado) | — | borda companion de `var(--warning-bg)`, usado lado a lado em pelo menos 8 arquivos (`RHFuncionariosView.jsx:326`, `:1138`; `RHFeriasView.jsx:283,491`; `RHRecrutamentoView.jsx:256,260,3273`; `NovoColaboradorModal.jsx:484`) — literal já estabelecido como par de `--warning-bg`, não é hex novo inventado para este fix |
| `var(--danger)` / `var(--danger-bg)` | `#B91C1C` / `#FEF2F2` | `#F87171` / `rgba(248,113,113,0.12)` | já em uso no wrapper de "Campo obrigatório" (`StageFieldInput.jsx:23,30`) — ver por que **não** reaproveitar aqui, abaixo |
| `var(--text-dim)` | `#57534E` | `#B5B3A8` | texto secundário padrão |

Por que `--warning`, não `--danger`: o wrapper de "Campo obrigatório" (`StageFieldInput.jsx:23`) já usa `--danger`/`--danger-bg` para dizer "isto é responsabilidade de quem preenche o formulário, preencha". A falta de opções é uma categoria diferente — quem preenche o card não tem nada que possa fazer para resolver (não existe opção para marcar); é um problema de configuração de etapa, resolvido por outra pessoa em outro lugar. O design system já usa exatamente essa distinção semântica em todo o resto do CRM (`--warning` = "precisa de atenção/config", `--danger` = "erro/bloqueio de input do usuário"). Reaproveitar `--danger` aqui apagaria essa distinção.

### Novo estado: "campo sem opções configuradas" — `StageFieldInput.jsx`, `renderInput()`

Guarda única, avaliada logo após `opts` ser calculado (linha 52), antes de qualquer um dos branches `"select"` / `"radio"` / `"multicheck"`:

```
if ((t === "radio" || t === "multicheck" || t === "select") && opts.length === 0) {
  // → renderizar o box de aviso abaixo, em vez de continuar para o branch do tipo
}
```

O box **substitui inteiramente** o controle (não é um aviso adicional ao lado de um `<select>`/`<div>` vazio funcional):

| Propriedade | Valor |
|---|---|
| `width` | `"100%"` (ocupa a mesma largura que o controle real ocuparia — sem colapsar pro tamanho do conteúdo) |
| `boxSizing` | `"border-box"` |
| `display` | `"flex"` |
| `alignItems` | `"flex-start"` |
| `gap` | `6` |
| `background` | `var(--warning-bg)` |
| `border` | `"1px solid #FDE68A"` |
| `borderRadius` | `8` (mesmo valor já usado pelo wrapper de "Campo obrigatório" no mesmo arquivo, `StageFieldInput.jsx:23`) |
| `padding` | `"8px 12px"` (mesmo padding de `baseStyle`, linha 42) |
| `fontSize` | `12` |
| `color` | `var(--warning)` |
| Ícone (opcional, recomendado) | `AlertTriangle` de `lucide-react`, `size={14}`, `style={{ color: "var(--warning)", flexShrink: 0, marginTop: 1 }}` — mesmo padrão de `DocumentCaptureModal.jsx:131`. Requer novo import em `StageFieldInput.jsx` (arquivo hoje não importa `lucide-react`); não é dependência nova no projeto, só nesse arquivo específico. |

Texto da mensagem (mesmo texto para os 3 tipos — a ação corretiva é idêntica):

> "Nenhuma opção configurada para este campo — configure em Editar fase."

## Comportamento (quando cada estado aparece)

1. **Sempre que `field.fieldType` for `"radio"`, `"multicheck"` ou `"select"` e `opts.length === 0`** — o box de aviso aparece no lugar do controle, incondicionalmente. Diferente do estado "Campo obrigatório" (QW2), este **não depende de `touched`/blur/tentativa de submit** — é uma condição de dado (config de etapa), não de interação do usuário; deve aparecer desde o primeiro render, sempre.
2. **Aparece nos dois consumidores do componente compartilhado** — `LeadCreateModal.jsx` (criação) e o drawer de edição de card existente — automaticamente, sem mudança nesses arquivos, porque o fix é só dentro de `renderInput()`.
3. **Interação com o wrapper de "Campo obrigatório" (`StageFieldInput.jsx:18-33`)** — se o campo também for obrigatório (`field.effectiveRequired ?? field.required`) e `touched` for `true`, o `hasValue` desse campo será **sempre `false`** (não existe opção para marcar, logo nunca há valor). Isso significa que o wrapper externo `var(--danger-bg)`/`var(--danger)` + texto "Campo obrigatório" continua aparecendo **ao redor** do novo box de aviso — os dois coexistem, aninhados. Isso é intencional, não um efeito colateral a esconder: comunica duas coisas verdadeiras ao mesmo tempo — (a) este campo obrigatório está vazio (ainda bloqueia avanço de etapa/submit, corretamente) e (b) a razão não é o usuário ter esquecido de preencher, é a etapa estar mal configurada. Não suprimir um em favor do outro.
4. **Campo não obrigatório com opções vazias** — o box de aviso aparece sozinho, sem o wrapper de "Campo obrigatório" ao redor (já que `isMissingRequired` depende de `field.required`).
5. **Assim que `options` for corrigido em `pipeline_stage_fields`** (via "Editar fase") — na próxima leitura/render do formulário, `opts.length > 0` e o branch original (`radio`/`multicheck`/`select` funcional) volta a renderizar normalmente; o box de aviso desaparece. Nenhum estado adicional para limpar.

## Notas de decisão subjetiva

- **Substituir o controle inteiro vs. manter um `<select>`/`<div>` funcional ao lado do aviso**: optei por substituir (guarda única antes dos 3 branches) em vez de, por exemplo, manter um `<select disabled>` com uma mensagem embaixo. Razão: simplicidade (uma única condição cobre os 3 tipos de forma idêntica) e evita um dropdown com seta/aparência clicável sentado ao lado de um aviso dizendo "não há nada aqui" — visualmente redundante e potencialmente confuso (por que o controle ainda parece interativo?). Se o time preferir preservar a "silhueta" de cada tipo de campo (ex.: sempre mostrar um `<select>`, mesmo que desabilitado, por consistência de layout), essa é uma alternativa razoável — mas exigiria tratamento por tipo em vez de uma guarda única, mais código para o mesmo resultado funcional.
- **Texto menciona "Editar fase", mas esse botão é restrito a gerentes**: confirmei em `src/components/views/CRMView.jsx:974-976` que o ícone que abre `StageFieldEditorModal` ("Editar fase: {stage.name}", `StageFieldEditorModal.jsx:687,690`) só aparece para `isManager`. Um vendedor/consultor preenchendo o formulário de criação vai ver a mensagem mas não necessariamente vai ter como agir sozinho — só sabe que precisa avisar alguém. Isso é uma limitação de fluxo/permissão, não do texto em si; mantive o texto genérico e factual ("configure em Editar fase") em vez de tentar prescrever um fluxo de escalonamento (ex.: "peça a um gerente para..."), porque prescrever um processo de quem-avisa-quem é decisão de produto fora do escopo deste bug de visibilidade. Sinalizando aqui para não ser tratado como implícito/óbvio.
- **Ícone `AlertTriangle` é opcional**: marquei como "recomendado", não obrigatório. Vários avisos `--warning`/`--warning-bg` já existentes no CRM são só texto, sem ícone (ex. `RHFuncionariosView.jsx:1138`, `RHRecrutamentoView.jsx:2344`) — texto sozinho já é consistente com o design system. O ícone ajuda a escanear o formulário rapidamente (esse campo era literalmente invisível antes; um ícone chama mais atenção que só cor de fundo), mas se o time quiser o caminho de menor esforço (zero import novo em `StageFieldInput.jsx`), a versão só-texto é igualmente válida e seguiria o mesmo padrão de tokens.
- **`console.warn` adicional (fora de escopo, mas barato)**: não é pedido pela tarefa (que pediu especificamente um sinal visível, não instrumentação), mas como nota à parte: um `console.warn` de desenvolvimento quando `opts.length === 0` custaria pouco e ajudaria a pegar esse tipo de config quebrada antes de chegar em produção. Não incluí como parte obrigatória da spec porque foge do que foi pedido (mudança de UI, não de logging) — mencionando só como sugestão opcional para o frontend-agent avaliar.
