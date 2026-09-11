import * as XLSX from "xlsx";
import { semAcento } from "./text-search";

// Base comum das importações por planilha.
//
// Extraída em 11/09/2026, com a importação de colaboradores. A plataforma já
// tinha TRÊS leitores de planilha escritos separadamente — Leads
// (`lead/ImportModal.jsx`), Clientes (`client/ClientImportModal.jsx`) e Feiras
// (`views/FairImportView.jsx`) — cada um com a própria cópia de "abrir o
// arquivo, achar a coluna, montar as linhas". A de colaboradores seria a
// quarta, e a regra 4 do CLAUDE.md manda extrair na terceira. Chegou atrasada,
// mas chegou.
//
// O que mora aqui é só o mecânico: abrir arquivo, reconhecer cabeçalho, virar
// linhas. Regra de negócio — o que fazer com cada linha, o que é duplicado,
// o que sobrescreve o quê — fica com quem chama, porque é diferente em cada
// domínio. As três antigas não foram migradas de uma vez: cada uma passa a
// usar isto quando for mexida por outro motivo.

// Mesmo teto dos buckets de anexo da plataforma. Conferir aqui evita o usuário
// esperar a leitura inteira de um arquivo que nunca ia caber.
export const MAX_PLANILHA_BYTES = 5 * 1024 * 1024;

export const EXTENSOES_ACEITAS = ".xlsx,.xls,.csv";

/**
 * Acha a coluna pelo nome do cabeçalho, tolerando acento, caixa e texto em
 * volta. "E-mail", "e-mail", "E-Mail do colaborador" e "Email" casam com o
 * mesmo candidato "e-mail" — e também com "email", porque o hífen é ignorado.
 *
 * Devolve o índice da coluna, ou -1.
 */
export function detectarColuna(cabecalhos, candidatos) {
  const limpa = (v) => semAcento(String(v || "")).replace(/[^a-z0-9]/g, "");
  const norm = (cabecalhos || []).map(limpa);
  for (const c of candidatos) {
    const alvo = limpa(c);
    if (!alvo) continue;
    const exato = norm.findIndex((h) => h === alvo);
    if (exato !== -1) return exato;
    const contem = norm.findIndex((h) => h.includes(alvo));
    if (contem !== -1) return contem;
  }
  return -1;
}

/**
 * `esquema` é { chave: [candidatos...] }. Devolve { chave: índice } só das
 * que foram encontradas — quem chama decide quais são obrigatórias, porque
 * isso é regra de domínio.
 */
export function mapearColunas(cabecalhos, esquema) {
  const mapa = {};
  for (const [chave, candidatos] of Object.entries(esquema)) {
    const idx = detectarColuna(cabecalhos, candidatos);
    if (idx !== -1) mapa[chave] = idx;
  }
  return mapa;
}

/**
 * Abre o arquivo e devolve { cabecalhos, linhas }, onde cada linha é
 * { numero, celulas }. `numero` é o número da linha NA PLANILHA (com o
 * cabeçalho sendo 1) — é o que a pessoa procura pra corrigir, e por isso
 * acompanha a linha até o relatório final em vez de ser recalculado depois.
 *
 * Linha totalmente vazia é descartada aqui mesmo: planilha exportada costuma
 * vir com centenas delas no fim, e elas virariam "linha ignorada" na tela,
 * enterrando os erros de verdade.
 */
export async function lerPlanilha(file) {
  if (!file) return { erro: "Nenhum arquivo escolhido." };
  if (file.size > MAX_PLANILHA_BYTES) {
    return { erro: `O arquivo tem ${(file.size / 1048576).toFixed(1)} MB — o limite é 5 MB.` };
  }
  let wb;
  try {
    const buf = await file.arrayBuffer();
    wb = XLSX.read(buf, { type: "array" });
  } catch {
    return { erro: "Não foi possível abrir o arquivo. Ele precisa ser .xlsx, .xls ou .csv." };
  }
  const primeira = wb.SheetNames?.[0];
  if (!primeira) return { erro: "A planilha não tem nenhuma aba." };

  const bruto = XLSX.utils.sheet_to_json(wb.Sheets[primeira], { header: 1, defval: null, blankrows: false });
  if (!bruto.length) return { erro: "A planilha está vazia." };

  const cabecalhos = (bruto[0] || []).map((h) => String(h ?? "").trim());
  const linhas = [];
  for (let i = 1; i < bruto.length; i++) {
    const celulas = bruto[i] || [];
    const temAlgo = celulas.some((c) => String(c ?? "").trim() !== "");
    if (!temAlgo) continue;
    linhas.push({ numero: i + 1, celulas });
  }
  return { cabecalhos, linhas, aba: primeira };
}

// Lê uma célula pelo índice do mapa, já aparada. Índice ausente devolve "".
export function celula(linha, idx) {
  if (idx === undefined || idx < 0) return "";
  return String(linha.celulas?.[idx] ?? "").trim();
}
