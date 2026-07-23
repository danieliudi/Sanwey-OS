import React from "react";

/**
 * Container de scroll horizontal onde as colunas do Kanban ficam — sem
 * fundo, sem padding, sem cantos arredondados. Era KanbanBoardCanvas.jsx (um
 * "canvas" com fundo/padding/cantos por trás das colunas) — renomeado, não
 * só reescrito, porque a premissa inteira do canvas foi rejeitada: no
 * Pipefy não existe um painel separado envolvendo a fileira de colunas, é a
 * própria página. Cada coluna agora carrega seu próprio fundo bege/cinza
 * (var(--surface-alt), ver CRMView.jsx/EntregasView.jsx) — este container só
 * cuida do scroll.
 *
 * Quebra o padding da página só na esquerda (-mx-6, sem devolver com px-6)
 * — a primeira coluna encosta mesmo em x=0, alinhada com o fim da sidebar,
 * pedido explícito do usuário. Mantém pr-6 na direita: lado não
 * especificado pela referência.
 *
 * Sem fade/gradiente na borda direita (Redesign v2) — existia um overlay ali
 * sinalizando "tem mais coluna pra rolar", mas o usuário revisou contra os
 * prints do Pipefy e pediu pra tirar, sem substituto.
 *
 * Piloto em 3 boards (Venda/CRMView, Entregas/EntregasView, Pós-venda/
 * PosVendaView) — ver CLAUDE.md antes de aplicar em outro board. Sempre
 * renderizado dentro do `hidden lg:block` já existente (mobile continua no
 * accordion, intocado).
 *
 * Não é dono do scroll/tamanho das colunas — quem chama continua dono do
 * `scrollRef` (passado a `useAvailableHeight`) e do `height` (`boardHeight`,
 * retorno do mesmo hook), passando a fileira de colunas como `children`.
 */
export function KanbanBoardScrollArea({ scrollRef, height, children }) {
  return (
    <div className="-mx-6">
      <div ref={scrollRef} className="overflow-x-auto pb-4 pr-6" style={{ scrollbarWidth: "thin", height }}>
        {children}
      </div>
    </div>
  );
}

export default KanbanBoardScrollArea;
