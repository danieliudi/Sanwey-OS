import React from "react";
import { AlertCircle, RotateCw } from "lucide-react";

// "Nenhum registro" quando na verdade deu erro.
//
// Achado do Daniel em 15/09/2026, em três telas ao mesmo tempo — Funil de
// Vendas, RH · Funcionários e Sinais. Nas três, uma falha de leitura chegava
// na tela como lista vazia: `use-market-signals` tinha um
// `catch { setSignals([]) }` que transformava QUALQUER falha em zero sinais,
// `use-rh-colaboradores` descartava o `error` inteiro, e o App nunca lia o
// `error` que `useLeads` já expunha. Rede caída, sessão expirada,
// `permission denied for table` — tudo virava "nenhum registro encontrado", e
// quem estava olhando concluía que tinha perdido a carteira.
//
// ── O QUE ESTE COMPONENTE NÃO COBRE, e é importante não prometer ─────────
// Recusa de RLS na LEITURA (policy de SELECT que não casa) NÃO chega aqui:
// o Postgres devolve `error: null` com `data: []`, sem nada que a distinga de
// uma tabela legitimamente vazia. Pegar esse caso exigiria um sinal a mais do
// banco, que hoje não existe. O caso de ESCRITA é diferente e já está coberto
// noutro lugar, pelo `.select()` + checagem de zero linha (use-leads.js).
// Comentário que descreve um modo de falha que o código não trata é
// exatamente a armadilha que o CLAUDE.md já registrou duas vezes.
//
// Três telas com o mesmo defeito é a 3ª ocorrência que manda extrair
// (CLAUDE.md regra 4) em vez de repetir o markup em cada view.
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
          falhou. Pode ser conexão, sessão expirada ou permissão de acesso.
        </span>
        {detalhe && (
          <span style={{ display: "block", fontSize: 11, marginTop: 5, color: "var(--danger)", opacity: 0.8, wordBreak: "break-word" }}>
            {detalhe}
          </span>
        )}
        {onTentarDeNovo && (
          <button
            type="button"
            // Chamada SEM argumento, de propósito: `onClick={onTentarDeNovo}`
            // entregaria o SyntheticEvent do React como 1º parâmetro, e os
            // refetch desta plataforma têm a assinatura
            // `async (isActive = () => true)`. Default de parâmetro só vale
            // para `undefined` — o evento não é undefined, virava `isActive`,
            // e `isActive()` estourava TypeError. O botão não recarregava
            // nada e ainda deixava o loading preso. (QA 15/09/2026.)
            onClick={() => onTentarDeNovo()}
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
