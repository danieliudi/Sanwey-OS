import React from "react";
import { AlertCircle, RotateCw } from "lucide-react";

// "Nenhum registro" quando na verdade deu erro.
//
// Achado do Daniel em 15/09/2026, depois de aparecer em três telas ao mesmo
// tempo — Funil de Vendas, RH · Funcionários e Sinais. É a mesma armadilha do
// Postgres nas três: quando a RLS recusa a LEITURA, a resposta volta com
// `error: null` e `data: []`. Sem nada que distinga, a tela acredita e
// escreve "nenhum registro encontrado". Quem está olhando conclui que perdeu
// a carteira.
//
// A diferença entre as duas frases é a informação inteira, e por isso esta é
// a 3ª ocorrência que manda extrair (CLAUDE.md regra 4) em vez de repetir o
// markup em cada view.
//
// TOKEN: `--danger`, e não `--warning`. A escolha não é estética — pela
// convenção da plataforma `--warning` é "precisa de configuração, não é
// responsabilidade de quem está lendo resolver", e `--danger` é bloqueio
// real. Falha de leitura bloqueia: não há o que fazer na tela até recarregar.
export function ErroDeLeitura({ oQue = "os dados", onTentarDeNovo, detalhe }) {
  return (
    <div
      role="alert"
      style={{
        background: "var(--danger-bg)",
        border: "1px solid var(--danger)",
        borderRadius: 12,
        padding: "13px 15px",
        display: "flex",
        gap: 11,
        alignItems: "flex-start",
      }}
    >
      <AlertCircle size={16} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 2 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <b style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--danger)", marginBottom: 3 }}>
          Não consegui carregar {oQue}
        </b>
        <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--danger)" }}>
          Isto não quer dizer que a lista está vazia — quer dizer que a leitura
          falhou. Pode ser conexão, ou permissão de acesso.
        </span>
        {detalhe && (
          <span style={{ display: "block", fontSize: 11, marginTop: 5, color: "var(--danger)", opacity: 0.8, wordBreak: "break-word" }}>
            {detalhe}
          </span>
        )}
        {onTentarDeNovo && (
          <button
            type="button"
            onClick={onTentarDeNovo}
            style={{
              marginTop: 9, display: "inline-flex", alignItems: "center", gap: 6,
              background: "var(--surface)", color: "var(--danger)",
              border: "1px solid var(--danger)", borderRadius: 8,
              padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            <RotateCw size={12} /> Tentar de novo
          </button>
        )}
      </div>
    </div>
  );
}

export default ErroDeLeitura;
