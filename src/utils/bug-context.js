import { ultimosErros } from "./error-log";

// Contexto técnico que viaja junto de um report de bug.
//
// Isto é o que substitui o print (mockup aprovado 02/09/2026). As pessoas de
// Marketing não tiram print por gosto — tiram porque sentem que precisam
// provar o que viram. Se a plataforma anexa sozinha o que ela já sabe, o
// print deixa de ser obrigação.
//
// O que NÃO entra aqui, deliberadamente: nada do CONTEÚDO da tela. Nem
// screenshot, nem os dados do registro aberto. Telas de RH mostram salário e
// CPF, o Funil mostra dado de cliente — capturar isso automaticamente seria
// um vazamento silencioso pra dentro do próprio banco, que ninguém pediu.
// Quem quiser mandar imagem manda por anexo, decidindo o que aparece.

const MODULO_POR_ROTA = {
  crm: "Funil de Vendas",
  "commercial-overview": "Funil de Vendas",
  "funnel-history": "Funil de Vendas",
  explorer: "Explorador",
  signals: "Sinais",
  pedidos: "Pedidos",
  catalogo: "Catálogo",
  posvenda: "Pós-venda",
  "crm-viagens": "Viagens & Despesas",
  comex: "Comex",
  marketing: "Marketing",
  "marketing-tarefas": "Marketing",
  "marketing-despesas": "Marketing",
  entregas: "Marketing",
  "marketing-compras": "Compras",
  "personal-tasks": "Lista Pessoal",
  chat: "Chat",
};

// Cargo/rota de RH cobrem muitas telas com o mesmo rótulo — prefixo em vez de
// uma entrada por tela, senão a tabela acima vira manutenção eterna.
export function moduloDaRota(rota) {
  if (!rota) return "Outro";
  if (MODULO_POR_ROTA[rota]) return MODULO_POR_ROTA[rota];
  if (rota.startsWith("rh")) return "RH";
  return "Outro";
}

function navegador() {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  // Só o suficiente pra reproduzir: motor + versão maior + sistema. UA
  // completo é ruído numa tela de triagem lida por gente.
  const m = ua.match(/(Chrome|Firefox|Safari|Edg|OPR)\/(\d+)/);
  const so = /Windows/.test(ua) ? "Windows"
    : /Android/.test(ua) ? "Android"
    : /iPhone|iPad|iPod/.test(ua) ? "iOS"
    : /Mac OS X/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux" : "?";
  const nome = m ? `${m[1] === "Edg" ? "Edge" : m[1] === "OPR" ? "Opera" : m[1]} ${m[2]}` : "navegador desconhecido";
  return `${nome} · ${so}`;
}

/**
 * @param {object} p
 * @param {string} p.rota      section atual (mesmo id usado em App.jsx)
 * @param {string} [p.acao]    o que a pessoa fazia — só quando a tela sabe
 * @param {string} [p.empresa] frente comercial ativa
 * @param {Error|string} [p.erro] erro que originou o report (camada 1)
 */
export function montarContexto({ rota, acao, empresa, erro } = {}) {
  const ctx = {
    rota: rota || null,
    acao: acao || null,
    empresa: empresa || null,
    versao_app: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : null,
    navegador: navegador(),
    tela: typeof window !== "undefined" ? `${window.innerWidth}×${window.innerHeight}` : null,
    url: typeof window !== "undefined" ? window.location?.pathname : null,
    em: new Date().toISOString(),
    ultimos_erros: ultimosErros(),
  };
  if (erro) {
    ctx.erro = {
      mensagem: erro?.message || String(erro),
      // A pilha é o que faz o report valer pra quem vai corrigir, mas inteira
      // ela tem centenas de linhas de bundle minificado — as primeiras já
      // apontam o arquivo.
      pilha: erro?.stack ? String(erro.stack).split("\n").slice(0, 12).join("\n") : null,
    };
  }
  return ctx;
}

// Título do card na Central de Bugs. `title` é NOT NULL no schema, e o
// formulário novo pede uma frase só — então o título nasce dela em vez de ser
// mais um campo pra pessoa preencher.
export function tituloAutomatico({ relato, erro, rota }) {
  if (erro) {
    const msg = erro?.message || String(erro);
    return `Erro em ${moduloDaRota(rota)}: ${msg}`.slice(0, 120);
  }
  const primeira = String(relato || "").trim().split("\n")[0];
  return (primeira || `Problema em ${moduloDaRota(rota)}`).slice(0, 120);
}
