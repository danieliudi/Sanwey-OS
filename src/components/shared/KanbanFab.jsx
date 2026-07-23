import React from "react";
import { Plus } from "lucide-react";

// Botão flutuante fixo (canto inferior esquerdo da ÁREA DE CONTEÚDO) pra criar
// um card direto na primeira etapa de qualquer Kanban da plataforma — pedido
// do usuário, inspirado no botão equivalente do Pipefy. Fica do lado oposto ao
// botão "Perguntar à IA" (canto inferior direito, ver CRMView.jsx) pra não
// colidir. Só desktop (`lg:flex`) — no mobile o board vira acordeão, que já
// tem seu próprio "+" por etapa (ver RHMobileKanbanAccordion `addLabel`).
// `position:fixed` é relativo à viewport, não à área de conteúdo — como o
// shell (App.jsx) tem uma sidebar fixa de 288px a partir do breakpoint `lg`
// (onde este FAB também passa a aparecer), um offset fixo tipo `left-6`
// sempre caía por cima da sidebar. Default `leftOffset=312` = 288px da
// sidebar + 24px de padding do conteúdo, alinhando com a borda esquerda real
// da área de conteúdo (achado ao vivo: o FAB aparecia em cima do menu
// lateral). Boards com a coluna encostando em x=0 (Pipeline/Entregas, ver
// KanbanBoardScrollArea.jsx) passam `leftOffset={288}` pra acompanhar.
export function KanbanFab({ label, onClick, leftOffset = 312 }) {
  if (!onClick) return null;
  return (
    <button
      onClick={onClick}
      className="hidden lg:flex fixed bottom-6 z-50 items-center gap-2 px-4 py-3 rounded-full font-semibold text-sm transition-all active:scale-95"
      style={{ left: leftOffset, background: "var(--accent)", color: "#FFFFFF", boxShadow: "var(--shadow-pop)", border: "none", cursor: "pointer" }}
      onMouseEnter={e => { e.currentTarget.style.filter = "brightness(0.9)"; }}
      onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
    >
      <Plus size={16} />
      {label}
    </button>
  );
}

export default KanbanFab;
