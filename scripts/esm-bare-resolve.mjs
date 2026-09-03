// Loader só pro smoke Node: o front (Vite) resolve import sem extensão;
// o Node ESM não. Não entra no bundle da plataforma.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.(js|mjs|cjs|json)$/.test(specifier)) {
    const parent = context.parentURL;
    if (parent) {
      const candidate = new URL(specifier + ".js", parent);
      if (existsSync(fileURLToPath(candidate))) {
        return { url: candidate.href, shortCircuit: true };
      }
    }
  }
  return nextResolve(specifier, context);
}
