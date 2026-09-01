import React from "react";
import { Plus } from "lucide-react";

// Botão flutuante fixo (canto inferior esquerdo da ÁREA DE CONTEÚDO) pra criar
// um card direto na primeira etapa de qualquer Kanban da plataforma — pedido
// do usuário, inspirado no botão equivalente do Pipefy. Fica do lado oposto ao
// botão "Perguntar à IA" (canto inferior direito, ver CRMView.jsx) pra não
// colidir. Só desktop (`lg:flex`) — no mobile o board vira acordeão, que já
// tem seu próprio "+" por etapa (ver RHMobileKanbanAccordion `addLabel`).
// `position:fixed` é relativo à viewport, não à área de conteúdo — como o
// shell (App.jsx) tem uma sidebar fixa a partir do breakpoint `lg` (onde este
// FAB também passa a aparecer), um offset fixo tipo `left-6` sempre caía por
// cima da sidebar. Usa `var(--sidebar-width)` (Sidebar.jsx atualiza em tempo
// real ao recolher/expandir o menu) + 24px de padding do conteúdo, pra
// acompanhar o menu em vez de assumir 288px fixo (achado ao vivo: o FAB
// aparecia em cima do menu lateral). Boards com a coluna encostando em x=0
// (Pipeline/Entregas, ver KanbanBoardScrollArea.jsx) passam `flush` pra tirar
// esse respiro de 24px — mas nunca zero: com offset 0 o botão encostava na
// borda do menu (reportado pelo Daniel 01/09/2026), então `flush` virou 16px
// em vez de 0.
//
// Tamanho reduzido ~25% na mesma rodada (px-4/py-3/text-sm/ícone 16 ->
// px-3.5/py-2/text-xs/ícone 14) e sombra trocada de --shadow-pop pra
// --shadow-card: é um atalho, não o assunto da tela. A cor de destaque fica
// — é a ação principal do board; se ainda estiver alto demais, o próximo
// passo é virar contorno em vez de preenchido.
export function KanbanFab({ label, onClick, flush = false, dataTour }) {
  if (!onClick) return null;
  return (
    <button
      onClick={onClick}
      data-tour={dataTour}
      className="hidden lg:flex fixed bottom-6 z-50 items-center gap-1.5 px-3.5 py-2 rounded-full font-semibold text-xs transition-all active:scale-95"
      style={{ left: `calc(var(--sidebar-width) + ${flush ? 16 : 24}px)`, background: "var(--accent)", color: "var(--on-accent)", boxShadow: "var(--shadow-card)", border: "none", cursor: "pointer" }}
      onMouseEnter={e => { e.currentTarget.style.filter = "brightness(0.9)"; }}
      onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
    >
      <Plus size={14} />
      {label}
    </button>
  );
}

export default KanbanFab;
