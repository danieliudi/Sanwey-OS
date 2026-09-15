# Varredura de QA em navegador real

Varreduras que abrem a plataforma num Chromium de verdade — desktop
(1440×900) e celular (390×844) — e reportam exceção não tratada, erro de
console, tela em branco e rolagem horizontal.

```bash
npm i --no-save playwright && npx playwright install chromium   # uma vez
npm run qa:smoke        # 52 rotas × 2 viewports, tela vazia
npm run qa:interacao    # com dados: abre card, navega abas, testa o acordeão
npm run qa:dados        # com dados: as rotas com todo board populado
npm run qa:proposta     # bancada: os documentos da proposta, em papel
```

As três primeiras sobem o dev server, rodam e derrubam o servidor sozinhas.

## `qa:proposta` — a bancada dos documentos impressos

Diferente das outras: **não varre nem aprova nada sozinha**. Sobe um Vite só
com os dois documentos da proposta (`DocTecnica` e `DocPitch`) renderizados
isolados, em largura de papel, com conteúdo de verdade — itens, imagens,
matriz de conformidade e pendências — pra você OLHAR, em
<http://localhost:5233>. Fica aberta até você parar (Ctrl-C).

São quatro folhas, e as duas últimas são o ponto:

| Folha | O que prova |
|---|---|
| `#folha-1` / `#folha-2` | ficha técnica e pitch **com** itens |
| `#folha-3` / `#folha-4` | os mesmos **sem** item nenhum — o caminho de não-regressão |

Existe por causa da regra 15 do `CLAUDE.md`: os dois gates do `prebuild`
provam ausência de erro de execução, não presença do que foi especificado, e
**nenhum deles exercita `@media print`**. Esta tela já teve dois defeitos que
passaram por build e ESLint limpos e só apareceram no papel: os dois
documentos saindo empilhados na mesma impressão, e preço unitário
arredondado pro real inteiro (R$ 48,90 imprimindo "R$ 49" na mesma folha em
que o subtotal dizia R$ 195.600).

O conteúdo é fixo em `proposta-doc/main.jsx` e as imagens são SVG embutido de
propósito: a prova é de LAYOUT, e depender de rede tornaria a captura
não-determinística.

## Por que isso existe

`npm run build` usa esbuild, que **não faz análise de escopo**. Quatro telas
morreram em três semanas sem que o build reclamasse uma única vez:
Recrutamento, o App inteiro (tela branca), Gestão de Viagens & Despesas
(morta 3 semanas) e o painel de Compras (morto 15 dias). O `.eslintrc.cjs`
pega a causa estática (`no-undef`, TDZ, hooks); esta varredura pega o que só
aparece montando: efeito que estoura no mount, HTML inválido, layout que
vaza da viewport.

## Como roda sem banco e sem senha

`vite.smoke.config.js` aponta o `envDir` pra uma pasta vazia, então o dev
server sobe **sem** `VITE_SUPABASE_*`. Aí `isSupabaseConfigured` é false e o
App usa o caminho de usuário mock que já existe em produção (`App.jsx`:
`const currentUser = supabaseEnabled ? supaUser : mockUser`). A varredura
grava esse usuário no `localStorage` antes de cada página abrir. Nenhuma
credencial, nenhum acesso ao banco real.

**Cuidado que já custou uma rodada inteira**: o Vite carrega `.env.local` em
qualquer modo — o "ignora quando `mode === test`" é regra do Vitest, não do
Vite. Rodar com `vite --mode test` dá 104 rotas "limpas" que na verdade são
104 telas de login. É por isso que existe a config separada, e é por isso
que `qa:interacao` confere que os cards realmente apareceram antes de
declarar sucesso.

## O que a rodada de interação cobre

Semeia leads com o gerador da própria plataforma (`src/data/generate-leads.js`)
no fallback de `localStorage` que `use-leads.js` já usa offline. Depois:
abre um card do funil, percorre as abas do drawer, fecha com Esc, e no
celular toca no cabeçalho da etapa, aperta Enter nele (teclado) e toca no
menu de ordenação que fica dentro dele — conferindo que o menu abre **sem**
abrir/fechar a etapa junto.

Só `leads` e `users` têm fallback offline; RH, Marketing e Compras abrem
vazios. Ampliar a cobertura de dados é o próximo passo natural daqui.
