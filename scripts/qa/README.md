# Varredura de QA em navegador real

Duas varreduras que abrem a plataforma num Chromium de verdade — desktop
(1440×900) e celular (390×844) — e reportam exceção não tratada, erro de
console, tela em branco e rolagem horizontal.

```bash
npm i --no-save playwright && npx playwright install chromium   # uma vez
npm run qa:smoke        # 52 rotas × 2 viewports, tela vazia
npm run qa:interacao    # com dados: abre card, navega abas, testa o acordeão
```

Cada comando sobe o dev server, roda e derruba o servidor sozinho.

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
