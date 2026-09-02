// Um Supabase de mentira, no nível da rede do navegador.
//
// Por que assim, e não uma branch de banco de verdade: a branch (regra 13 do
// CLAUDE.md) é a ferramenta certa pra quem consegue FALAR com o Supabase.
// Este contêiner não consegue — a política de saída de rede bloqueia
// `*.supabase.co`, produção inclusive. Conferido em 02/09/2026: branch criada,
// inalcançável, apagada. Interceptar no Playwright resolve o mesmo problema
// aqui, sem custo por hora e sem depender de rede nenhuma.
//
// O que é fiel: o formato do que o PostgREST devolve (que é o que os hooks de
// produção realmente parseiam) e os filtros de igualdade — `eq`, `in`, `is`.
// Filtro NÃO é luxo aqui: `.single()` no supabase-js confere no cliente que
// veio exatamente uma linha, então uma consulta `profiles?id=eq.X` que devolva
// a tabela inteira faz a plataforma cair na tela de login com
// "multiple (or no) rows returned" — e a varredura inteira vira falso
// negativo. Aconteceu na primeira execução, em 02/09/2026.
//
// O que NÃO é fiel: ordenação, paginação, `like`/`gt`/`lt`, junção embutida
// (`select=*,outra(...)`) e agregação. Consulta com esses operadores devolve
// as linhas sem eles aplicados. Pra varredura de montagem serve; bug de
// filtro complexo continua sendo trabalho de teste com banco de verdade.

const HOST_FALSO = "banco-falso.qa.invalid";
export const URL_FALSA = `https://${HOST_FALSO}`;
// Chave que não abre nada: o host não existe, e o token abaixo é montado aqui
// mesmo. Não há segredo neste arquivo.
export const CHAVE_FALSA = "chave-de-varredura-sem-valor";

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// JWT de fachada: o supabase-js decodifica o payload pra saber validade e
// `sub`, mas nunca verifica a assinatura no cliente (quem verifica é o
// servidor, que aqui não existe). Expira em 2099 pra a sessão não vencer no
// meio da varredura.
function tokenFalso(userId) {
  const cabecalho = b64url({ alg: "HS256", typ: "JWT" });
  const corpo = b64url({
    sub: userId, aud: "authenticated", role: "authenticated",
    email: "qa.cobertura@local.invalid",
    exp: 4102444800, iat: 1756000000,
    app_metadata: { provider: "email" }, user_metadata: { name: "QA Cobertura" },
  });
  return `${cabecalho}.${corpo}.assinatura-de-mentira`;
}

export function usuarioFalso(userId) {
  return {
    id: userId, aud: "authenticated", role: "authenticated",
    email: "qa.cobertura@local.invalid", email_confirmed_at: "2026-01-01T00:00:00Z",
    phone: "", confirmed_at: "2026-01-01T00:00:00Z",
    last_sign_in_at: "2026-09-01T00:00:00Z",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { name: "QA Cobertura" },
    identities: [], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
    is_anonymous: false,
  };
}

export function sessaoFalsa(userId) {
  return {
    access_token: tokenFalso(userId), token_type: "bearer",
    expires_in: 2147483647, expires_at: 4102444800,
    refresh_token: "refresh-de-mentira", user: usuarioFalso(userId),
  };
}

// Chave que o supabase-js usa no localStorage: `sb-<1º rótulo do host>-auth-token`.
export const CHAVE_SESSAO = `sb-${HOST_FALSO.split(".")[0]}-auth-token`;

const JSON_HEADERS = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "content-range": "0-0/*",
};


// Parâmetros que o PostgREST usa pra outra coisa que não filtrar.
const NAO_E_FILTRO = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

// Filtro de igualdade só — `eq`, `in`, `is`. O suficiente pra `.single()` não
// receber a tabela inteira, que é o que quebrava tudo.
function filtrar(linhas, params) {
  let saida = linhas;
  for (const [campo, bruto] of params.entries()) {
    if (NAO_E_FILTRO.has(campo) || campo.startsWith("or")) continue;
    const [op, ...resto] = bruto.split(".");
    const valor = resto.join(".");
    if (op === "eq") {
      saida = saida.filter((r) => String(r[campo]) === valor);
    } else if (op === "in") {
      const lista = valor.replace(/^\(|\)$/g, "").split(",").map((v) => v.replace(/^"|"$/g, ""));
      saida = saida.filter((r) => lista.includes(String(r[campo])));
    } else if (op === "is") {
      const nulo = valor === "null";
      saida = saida.filter((r) => (r[campo] == null) === nulo);
    }
    // Qualquer outro operador passa reto de propósito: filtrar errado
    // esconderia linha e faria a tela parecer vazia sem motivo.
  }
  return saida;
}

export async function instalarSupabaseFalso(ctx, dados, userId) {
  const naoConhecidas = new Set();

  // Regex e não glob: `**://host/**` NÃO casa em Playwright (o glob dele não
  // entende o esquema assim), e o efeito é silencioso — a requisição escapa
  // pra rede de verdade, morre em ERR_CONNECTION_RESET, e a plataforma cai na
  // tela de login sem dizer por quê. Custou uma rodada inteira em 02/09/2026.
  await ctx.route(/banco-falso\.qa\.invalid/, async (rota) => {
    const req = rota.request();
    const url = new URL(req.url());
    const caminho = url.pathname;

    if (req.method() === "OPTIONS") {
      return rota.fulfill({ status: 204, headers: JSON_HEADERS, body: "" });
    }

    // ---- Auth ----
    if (caminho.startsWith("/auth/v1/")) {
      if (caminho.includes("/token")) {
        return rota.fulfill({ status: 200, headers: JSON_HEADERS, body: JSON.stringify(sessaoFalsa(userId)) });
      }
      if (caminho.includes("/user")) {
        return rota.fulfill({ status: 200, headers: JSON_HEADERS, body: JSON.stringify(usuarioFalso(userId)) });
      }
      if (caminho.includes("/logout")) {
        return rota.fulfill({ status: 204, headers: JSON_HEADERS, body: "" });
      }
      return rota.fulfill({ status: 200, headers: JSON_HEADERS, body: "{}" });
    }

    // ---- PostgREST ----
    if (caminho.startsWith("/rest/v1/")) {
      const alvo = caminho.replace("/rest/v1/", "");

      // Escrita: devolve o que foi mandado, pra o caminho otimista da tela
      // seguir e o `.select()` depois do insert/update não vir vazio (que é
      // exatamente como a plataforma detecta "RLS barrou").
      if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method())) {
        let corpo = [];
        try { corpo = JSON.parse(req.postData() || "[]"); } catch { /* corpo vazio */ }
        const linhas = Array.isArray(corpo) ? corpo : [corpo];
        return rota.fulfill({ status: 200, headers: JSON_HEADERS, body: JSON.stringify(linhas) });
      }

      if (alvo.startsWith("rpc/")) {
        return rota.fulfill({ status: 200, headers: JSON_HEADERS, body: "[]" });
      }

      const tabela = alvo.split("?")[0];
      const linhas = dados[tabela];
      if (linhas === undefined) naoConhecidas.add(tabela);

      const resultado = filtrar(linhas ?? [], url.searchParams);

      // `.single()` com Accept de objeto (PostgREST antigo) ainda existe;
      // o supabase-js atual manda `*/*` e confere a contagem no cliente.
      // Atender os dois é uma linha.
      const aceita = req.headers()["accept"] || "";
      const objeto = aceita.includes("pgrst.object");
      return rota.fulfill({
        status: 200, headers: JSON_HEADERS,
        body: JSON.stringify(objeto ? (resultado[0] ?? null) : resultado),
      });
    }

    // Storage, functions e o resto: resposta vazia bem-formada.
    return rota.fulfill({ status: 200, headers: JSON_HEADERS, body: "{}" });
  });

  return { naoConhecidas };
}
