// Config exclusiva da varredura de QA. Reaproveita a config real e só troca
// o diretório de variáveis de ambiente por uma pasta vazia — assim o dev
// server sobe SEM VITE_SUPABASE_*, e o App cai no caminho de usuário mock
// que já existe (App.jsx: `const currentUser = supabaseEnabled ? supaUser :
// mockUser`). Cada tela monta de verdade, os hooks devolvem estado vazio, e
// NADA toca o banco de produção.
//
// Por que uma config em vez de `vite --mode test`: o Vite carrega .env.local
// em QUALQUER modo (o "ignora quando mode === test" é regra do Vitest, não
// do Vite). Sem isto a varredura roda contra o Supabase real e todas as
// rotas renderizam a tela de LOGIN — 104 rotas "limpas" que na verdade são
// 104 telas de login. Aconteceu de verdade em 02/09/2026; só apareceu
// porque a sessão foi conferir o texto renderizado.
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import base from "../../vite.config.js";

const aqui = dirname(fileURLToPath(import.meta.url));

export default {
  ...base,
  root: resolve(aqui, "../.."),
  envDir: resolve(aqui, "env-vazio"),
  // `open: false` — a config de desenvolvimento abre o navegador sozinha, e
  // num ambiente sem interface isso vira um `spawn xdg-open ENOENT` no meio
  // da saída da varredura. Aqui quem abre navegador é o Playwright.
  server: { ...(base.server || {}), open: false },
};
