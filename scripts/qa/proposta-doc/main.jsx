// Renderiza os DOIS documentos da proposta (ficha técnica e pitch) isolados,
// na largura de papel, com conteúdo de verdade — itens, imagens, matriz e
// pendências. Existe por causa da regra 15 do CLAUDE.md: build e ESLint
// provam ausência de erro de execução, não presença do que foi especificado,
// e o defeito anterior desta tela (os dois documentos impressos empilhados)
// passou pelos dois gates sem um ruído.
//
// Uso: npm run qa:proposta
import React from "react";
import { createRoot } from "react-dom/client";
import { DocTecnica, DocPitch } from "../../../src/components/lead/PropostaPanel.jsx";
import { avaliarProposta } from "../../../src/utils/proposta-rfp.js";
import { FATOS_PADRAO } from "../../../src/constants/fatos-canonicos.js";
import "../../../src/index.css";

const lead = {
  company: "Mineradora Vale do Sino S.A.", cnpj: "12.345.678/0001-90",
  decisionMaker: { name: "Renata Prado" }, skuName: "Big Bag Alça Guia",
  quantity: 4000, unitPrice: 48.9,
};

const rascunho = {
  rfp: "RFP-2026-0412", data: "2026-09-15", validade: "30 dias",
  vendedor: "Marcos Aurélio", aplicacao: "escória granulada",
  prazo: "45 dias após a ordem", dimensao: "90 × 90 × 110 cm",
  incoterm: "CIF — conforme raio contratado",
};

const itens = [
  { modelLabel: "Big Bag Alça Guia", quantity: 4000, unitPrice: 48.9, certificationNote: "" },
  { modelLabel: "Type C Condutivo", quantity: 1200, unitPrice: 96.5, certificationNote: "ANP" },
  { modelLabel: "Homologado Perigosos", quantity: 300, unitPrice: 141, certificationNote: "INMETRO (Res. ANTT 420)" },
];

const bloqueados = {
  moq: { valor: "500 un por modelo", quem: "Comercial · Paula Rezende" },
  pgto: { valor: "28/56 ddl", quem: "Financeiro · Ivo Camargo" },
  ncm: { valor: "6305.32.00", quem: "Fiscal · Tânia Melo" },
  swl: { valor: "1.500 kg · FS 5:1", quem: "Engenharia · Léo Sartori" },
};

const requisitos = [
  { exigencia: "Rastreabilidade por lote", resposta: "Etiqueta com lote e data de fabricação em cada peça", norma: "ISO 9001:2015 §8.5.2" },
  { exigencia: "Ensaio de ciclo de carga", resposta: "Relatório de ensaio por lote de produção", norma: "ISO 21898" },
  { exigencia: "Declaração de material reciclado", resposta: "", norma: "" },
];

// FATOS_PADRAO é um mapa por frente — pegar a de industria (Sanwey).
const fatos = FATOS_PADRAO.industria || Object.values(FATOS_PADRAO)[0];
const S = avaliarProposta({ lead, rascunho, bloqueados, requisitos, fatos, itens });
// A terceira folha é a que prova a NÃO-regressão, e é justo a que faltava:
// a spec promete que "sem linha nenhuma, nada muda — as versões já geradas
// continuam abrindo igual". Sem renderizá-la, essa promessa não era
// verificada por nada. Aqui `qtd`/`preco` voltam ao Sumário, a seção de
// itens some e a numeração das seções recua de 4 pra 3.
const S_SEM_ITENS = avaliarProposta({ lead, rascunho, bloqueados, requisitos, fatos, itens: [] });

// A imagem é embutida como SVG data: URI de propósito: a prova aqui é de
// LAYOUT (a figura ocupa a célula, a legenda não descola), e depender de rede
// tornaria a captura não-determinística.
const figura = (rotulo, cor) => "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="300"><rect width="420" height="300" fill="${cor}"/><text x="210" y="158" font-family="Inter,sans-serif" font-size="26" fill="#fff" text-anchor="middle">${rotulo}</text></svg>`);

const imagens = [
  { id: "a", title: "Linha de costura — planta Taboão da Serra", url: figura("Planta", "#3C4A5A") },
  { id: "b", title: "Ensaio de ciclo de carga", url: figura("Ensaio", "#5A4A3C") },
  { id: "c", title: "Big bag em operação — pátio de escória", url: figura("Pátio", "#3C5A46") },
];

const folha = { width: 760, margin: "0 auto 40px", padding: 34, background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,.18)" };

createRoot(document.getElementById("raiz")).render(
  <div style={{ background: "#ECECEC", padding: "34px 0", minHeight: "100vh" }}>
    <div id="folha-1" style={folha}>
      <DocTecnica S={S} fatos={fatos} lead={lead} requisitos={requisitos} bloqueados={bloqueados} />
    </div>
    <div id="folha-2" style={folha}>
      <DocPitch S={S} fatos={fatos} esgKg={412000} imagens={imagens} />
    </div>
    <div id="folha-3" style={folha}>
      <DocTecnica S={S_SEM_ITENS} fatos={fatos} lead={lead} requisitos={requisitos} bloqueados={bloqueados} />
    </div>
    <div id="folha-4" style={folha}>
      <DocPitch S={S_SEM_ITENS} fatos={fatos} esgKg={412000} imagens={[]} />
    </div>
  </div>,
);
