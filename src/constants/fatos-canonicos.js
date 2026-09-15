// Fatos canônicos por frente — a Classe 1 da proposta
//
// São os dados que NÃO se digitam numa proposta: razão social, CNPJ,
// contatos, homologação, tagline. Transcritos das bases canônicas de marca
// (`resibag-canonical-facts` e `sanwey-canonical-facts`) em 15/09/2026.
//
// ── POR QUE ISTO EXISTE ───────────────────────────────────────────────────
// No gerador em HTML que originou esta tela, esses fatos estavam escritos
// DENTRO de cada versão do arquivo — v1, v2, v5. O resultado é o previsível:
// a v5 traz a tagline "Gestão inteligente de resíduos industriais.", que foi
// descontinuada em 09/09/2026 (a canônica é sem "industriais"). Ninguém
// errou; a cópia só envelheceu junto com o arquivo.
//
// ── ESTES SÃO O PADRÃO, NÃO A VERDADE FINAL ───────────────────────────────
// O Daniel escolheu em 15/09/2026 que os fatos são editáveis em Configurações
// (coluna `fatos_canonicos` em `crm_config_comercial`). O que está aqui é o
// que vale enquanto ninguém editou — e é também a referência contra a qual a
// tela mostra "isto foi alterado".
//
// Mudou a base de marca? Muda aqui E na configuração, ou a plataforma passa a
// afirmar uma coisa que a marca não afirma mais.

export const CAMPOS_FATOS = [
  { chave: "razao_social",  rotulo: "Razão social" },
  { chave: "cnpj",          rotulo: "CNPJ" },
  { chave: "sede",          rotulo: "Sede" },
  { chave: "email",         rotulo: "E-mail comercial" },
  { chave: "telefone",      rotulo: "Telefone / WhatsApp" },
  { chave: "site",          rotulo: "Site" },
  { chave: "homologacao",   rotulo: "Homologação de produto" },
  { chave: "codigo_onu",    rotulo: "Código ONU" },
  { chave: "sgq",           rotulo: "Sistema de gestão" },
  { chave: "tagline",       rotulo: "Assinatura" },
  { chave: "endosso",       rotulo: "Endosso institucional" },
];

export const FATOS_PADRAO = {
  // ── Resibag ────────────────────────────────────────────────────────────
  // Fonte: resibag-canonical-facts §01, §02, §03, §05.
  resibag: {
    razao_social: "Resibag Comercial Ltda.",
    cnpj:         "46.278.653/0001-38",
    sede:         "Taboão da Serra · SP",
    email:        "vendas@resibag.com.br",
    telefone:     "(11) 99465-9377",
    site:         "resibag.com.br",
    // §05: UMA homologação de produto, em dois registros por capacidade.
    // "Dupla homologação" é frase proibida — a contagem é um.
    homologacao:  "INMETRO · IBC-0136/22 (700 kg) e IBC-0143/25 (1000 kg), Portaria 320/2021",
    codigo_onu:   "13H3/Z (SAN T025) · 13H1 ou 13H3/Y (SAN T015)",
    // §05: ISO 9001 é do GRUPO e é de sistema, não de produto. E o organismo
    // certificador está em CONFLITO ABERTO entre as duas bases (SGS × DNV) —
    // por isso não aparece aqui. Não citar organismo em material externo até
    // haver certificado conferido.
    sgq:          "Fabricação sob sistema de gestão da qualidade certificado ISO 9001:2015 do Grupo Sanwey",
    // §02: a versão com "industriais" foi descontinuada em 09/09/2026.
    tagline:      "Gestão inteligente de resíduos.",
    endosso:      "Resibag — Uma marca Sanwey",
  },

  // ── Sanwey / Sanbag ────────────────────────────────────────────────────
  // Fonte: sanwey-canonical-facts §01, §03, §04, §07.
  // `industria` é o id da frente Sanwey e é CONTRATO, não nome — o
  // trackforge-os lê `market_signals` mapeando sanwey → "industria".
  // Ver regra 18 do CLAUDE.md antes de renomear.
  industria: {
    razao_social: "Sanwey Indústria de Containers Ltda.",
    cnpj:         "",   // [FALTA DADO] não consta na base canônica
    sede:         "Rua Raphael de Marco, 201/227 · Taboão da Serra, SP · CEP 06765-350",
    email:        "vendas@sanwey.com.br",
    telefone:     "+55 (11) 4788-1755",
    site:         "www.sanwey.com.br",
    homologacao:  "INMETRO · Res. ANTT 420, para contentores flexíveis de cargas perigosas (desde 2008)",
    codigo_onu:   "",   // varia por modelo homologado
    sgq:          "ISO 9001:2015 (DNV), ininterrupta desde 1999 · ABNT NBR 16029",
    // §04: C1 é a assinatura, e vive em rodapé — nunca em capa. Quem abre a
    // peça é a C2, "A carga define o projeto.".
    tagline:      "A marca que valoriza o seu produto.",
    endosso:      "",
  },
};

/** Os fatos de uma frente: o que está configurado, com o padrão por baixo. */
export function fatosDaFrente(companyId, configurados) {
  const padrao = FATOS_PADRAO[companyId] || {};
  if (!configurados || typeof configurados !== "object") return { ...padrao };
  return { ...padrao, ...configurados };
}

/** Quais fatos foram editados e estão diferentes do padrão do repositório. */
export function fatosDivergentes(companyId, configurados) {
  const padrao = FATOS_PADRAO[companyId] || {};
  if (!configurados || typeof configurados !== "object") return [];
  return CAMPOS_FATOS
    .filter((c) => configurados[c.chave] !== undefined && configurados[c.chave] !== padrao[c.chave])
    .map((c) => c.chave);
}

export default FATOS_PADRAO;
