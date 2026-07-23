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
 * especificado pela referência, e sem esse respiro a última coluna fica
 * colada na borda real da janela e o gradiente de "tem mais coluna" cobre
 * conteúdo de card.
 *
 * Piloto em só 2 boards (Pipeline/CRMView, Entregas/EntregasView) — ver
 * CLAUDE.md antes de aplicar em outro board. Sempre renderizado dentro do
 * `hidden lg:block` já existente (mobile continua no accordion, intocado).
 *
 * Não é dono do scroll/tamanho das colunas — quem chama continua dono do
 * `scrollRef` (passado a `useAvailableHeight`) e do `height` (`boardHeight`,
 * retorno do mesmo hook), passando a fileira de colunas como `children`.
 */
export function KanbanBoardScrollArea({ scrollRef, height, children }) {
  return (
    <div className="relative -mx-6">
      <div
        className="absolute right-0 top-0 bottom-9 w-16 pointer-events-none z-10"
        style={{ background: "linear-gradient(to left, var(--bg) 0%, transparent 100%)" }}
      />
      <div ref={scrollRef} className="overflow-x-auto pb-4 pr-6" style={{ scrollbarWidth: "thin", height }}>
        {children}
      </div>
    </div>
  );
}

export default KanbanBoardScrollArea;
