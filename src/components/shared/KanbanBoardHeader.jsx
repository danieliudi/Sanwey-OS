import React from "react";

/**
 * Barra de topo do Kanban, chapada e de ponta a ponta — substitui o card
 * arredondado com sombra do piloto anterior (rejeitado: não batia com a
 * referência do Pipefy, que mostra uma barra plana ocupando toda a largura
 * da janela, sem cantos arredondados, sem sombra).
 *
 * Só a partir de `lg` (1024px) é que existe algo pra "encostar" — abaixo
 * disso a sidebar vira overlay e não ocupa espaço de layout (Sidebar.jsx),
 * então o breakout não faz sentido e a barra fica no fluxo normal da página.
 * A partir de `lg`: cancela o padding da página (`px-4 sm:px-6` de App.jsx)
 * com margem negativa e devolve o mesmo padding só pro conteúdo — o texto/
 * botões mantêm o recuo de sempre, só o fundo/borda é que vai até a borda
 * real da sidebar e da janela.
 *
 * Só a casca. Conteúdo (título, toggle de visão, filtros, botões) continua
 * exatamente como cada tela já escreve — passado como `children`.
 */
export function KanbanBoardHeader({ children, className = "" }) {
  return (
    <div
      className={`flex flex-col gap-3 py-4 lg:-mx-6 lg:-mt-6 lg:px-6 ${className}`}
      style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
    >
      {children}
    </div>
  );
}

export default KanbanBoardHeader;
