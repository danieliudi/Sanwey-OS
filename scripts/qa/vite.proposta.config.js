// Vite só pra renderizar os dois documentos da proposta isolados (regra 15).
// envDir apontado pra pasta vazia pelo mesmo motivo do vite.smoke.config.js:
// o Vite carrega .env.local em QUALQUER modo, e a página não deve tocar em
// banco nenhum.
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import base from "../../vite.config.js";

const aqui = dirname(fileURLToPath(import.meta.url));

export default {
  ...base,
  root: resolve(aqui, "proposta-doc"),
  envDir: resolve(aqui, "env-vazio"),
  server: { ...(base.server || {}), open: false },
};
