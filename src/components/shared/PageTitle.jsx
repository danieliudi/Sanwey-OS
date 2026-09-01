import React from "react";

// Título da página do board, com a descrição na MESMA linha em vez de numa
// linha própria embaixo. Rodada de densidade de 01/09/2026, decidida com o
// Daniel a partir dos prints do Pipefy: o header gastava 131px, dos quais uma
// linha inteira era o subtítulo.
//
// Extraído porque o bloco "ícone + h1 de 26px + <p> de subtítulo" estava
// escrito à mão em 14 views de board (e o h1 de 26px em 35 lugares no total).
// Passa do limiar da regra 4 do CLAUDE.md com folga — e é o arquivo único que
// vai receber a descrição editável quando a coluna `module_states.description`
// for aprovada, sem precisar tocar em view nenhuma de novo.
//
// ---------------------------------------------------------------------------
// ATENÇÃO — dois tipos de "subtítulo", não misturar (achado de 01/09/2026)
//
// O que hoje se parece com subtítulo em toda view na verdade é uma de duas
// coisas bem diferentes:
//
//   1. DESCRIÇÃO estática — "Kanban de entregas de campanha". Texto fixo,
//      escrito no código, que não muda com o dado. É este que vem pra cá, na
//      prop `description`, e é este que vira editável no futuro.
//
//   2. RESUMO ao vivo — "12 oportunidades · R$ 340k em aberto · 3 ganhos"
//      (CRMView, PosVendaView). É dado calculado, muda a cada filtro, e é
//      longo. NÃO é descrição e não deve virar uma; a prop `summary` existe
//      pra isso e continua renderizando na linha de baixo, onde cabe.
//
// Uma view pode ter as duas, uma, ou nenhuma.
// ---------------------------------------------------------------------------
export function PageTitle({ icon: Icon, title, description, summary, dataTour }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        {Icon ? <Icon size={18} style={{ color: "var(--text)", flexShrink: 0 }} /> : null}
        <h1
          className="font-bold leading-tight"
          style={{ fontSize: 19, color: "var(--text)", letterSpacing: "-0.02em", flexShrink: 0 }}
        >
          {title}
        </h1>
        {description ? (
          <>
            <span
              aria-hidden="true"
              style={{ width: 1, height: 15, background: "var(--border)", flexShrink: 0 }}
            />
            <span
              data-tour={dataTour}
              title={description}
              className="text-xs truncate"
              style={{ color: "var(--text-dim)", minWidth: 0 }}
            >
              {description}
            </span>
          </>
        ) : null}
      </div>
      {summary ? (
        <p className="text-sm mt-0.5" style={{ color: "var(--text-dim)" }}>{summary}</p>
      ) : null}
    </div>
  );
}

export default PageTitle;
