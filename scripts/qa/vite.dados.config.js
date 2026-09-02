// Igual ao vite.smoke.config.js, mas com um par VITE_SUPABASE_* de fachada em
// vez de nenhum: aqui a varredura quer o App no caminho AUTENTICADO (com
// hooks buscando dado de verdade), não no caminho de usuário mock. Quem
// responde às chamadas é o interceptador do Playwright.
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import base from "../../vite.config.js";

const aqui = dirname(fileURLToPath(import.meta.url));

export default {
  ...base,
  root: resolve(aqui, "../.."),
  envDir: resolve(aqui, "env-falso"),
  server: { ...(base.server || {}), open: false },
};
