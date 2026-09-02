// Gate de erro em tempo de build — irmão do scripts/check-consistencia.mjs.
//
// Por que existe (28/08 → 02/09/2026): o Vite usa esbuild, que NÃO faz
// análise de escopo. Um `setWinnerSupplierId("")` que ninguém declarou, ou um
// `const` usado no array de dependência de um useMemo declarado acima dele,
// compilam sem um ruído sequer — e a tela morre em produção. Aconteceu 4x em
// três semanas nesta plataforma:
//
//   - Recrutamento (TDZ, 32108f7)
//   - App.jsx inteiro (TDZ — tela branca na plataforma toda)
//   - Gestão de Viagens & Despesas (TDZ, morta desde 10/08, ~3 semanas)
//   - Compras (PurchaseRequestDetailDrawer, ReferenceError no useEffect de
//     abertura, quebrado desde 18/08 — pego por este arquivo, não pelo build)
//
// Regra de ouro deste arquivo: SÓ entra regra que pegue bug real de runtime.
// Nada de estilo, formatação ou preferência. Se uma regra aqui apitar, é
// porque alguma tela quebra — não porque o código "podia ficar mais bonito".
// Ruído (variável não usada, dependência faltando) fica em `npm run lint:full`,
// que NÃO quebra o build: são 250 + 49 ocorrências hoje, dívida conhecida, e
// transformar isso em erro só faria o gate ser ignorado.
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
  plugins: ["react", "react-hooks"],
  settings: { react: { version: "detect" } },
  // Injetado pelo Vite (vite.config.js → define) — não existe como global do
  // browser, então precisa ser declarado aqui pro no-undef não falsear.
  globals: { __APP_VERSION__: "readonly" },
  ignorePatterns: ["dist/", "node_modules/", "supabase/functions/"],
  rules: {
    // Escopo — a família que pega TDZ e nome trocado em refactor.
    "no-undef": "error",
    "react/jsx-no-undef": "error",
    "no-const-assign": "error",
    "no-func-assign": "error",
    "no-import-assign": "error",

    // Hooks — chamada condicional quebra a ordem e derruba o componente.
    "react-hooks/rules-of-hooks": "error",

    // Duplicação silenciosa: a última chave/prop vence, sem aviso nenhum.
    "no-dupe-keys": "error",
    "no-dupe-args": "error",
    "no-dupe-class-members": "error",
    "no-dupe-else-if": "error",
    "no-duplicate-case": "error",
    "react/jsx-no-duplicate-props": "error",

    // Condição/comparação que nunca faz o que parece fazer.
    "no-constant-condition": "error",
    "no-constant-binary-expression": "error",
    "no-self-compare": "error",
    "no-self-assign": "error",
    "no-compare-neg-zero": "error",
    "no-unsafe-negation": "error",
    "no-unsafe-optional-chaining": "error",
    "use-isnan": "error",
    "valid-typeof": "error",

    // Estrutura morta ou malformada.
    "no-unreachable": "error",
    "no-sparse-arrays": "error",
    "no-cond-assign": "error",
    "no-empty-pattern": "error",
    "no-fallthrough": "error",
    "no-case-declarations": "error",
    "getter-return": "error",
    "no-setter-return": "error",
    "no-obj-calls": "error",
    "no-invalid-regexp": "error",
    "no-misleading-character-class": "error",
    "no-async-promise-executor": "error",
    "react/no-children-prop": "error",
    "react/no-direct-mutation-state": "error",
    "react/jsx-key": "error",

    // Deliberadamente FORA (não é bug nesta base):
    // - require-atomic-updates: aponta todo `ref.current = x` depois de await.
    //   Ref É a válvula de escape pra isso; 6 dos 7 achados eram refs de
    //   controle (gravador de áudio, fila offline, rascunho de formulário).
    // - no-prototype-builtins / no-useless-escape: ruído puro.
    "require-atomic-updates": "off",
    "no-prototype-builtins": "off",
    "no-useless-escape": "off",
    "no-unused-vars": "off",
  },
};
