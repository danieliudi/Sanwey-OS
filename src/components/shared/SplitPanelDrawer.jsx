import React, { useMemo, useState } from "react";
import { X, Trash2, ArrowRight, ChevronDown, Archive, ArchiveRestore } from "lucide-react";
import { useBodyScrollLock } from "../../hooks/use-body-scroll-lock";
import { useEscToClose } from "../../hooks/use-esc-to-close";
import { StageNavigator, StageMoveRegistryContext } from "./StageNavigator";

// Chrome estrutural do drawer de detalhe no padrão do CRM (LeadDetailDrawer):
// modal centralizado (não desliza da lateral), 3 colunas — info à esquerda,
// formulário/etapa no centro, movimentação+comentários à direita. Em mobile
// as 3 colunas empilham em sequência com scroll único, com dois ajustes
// aprovados em mockup (decisão 2A, mobile): a coluna de metadados (left)
// colapsa por padrão atrás de "+ detalhes", e uma barra fixa no rodapé dá
// acesso ao "Mover para" via bottom sheet — os destinos/handlers vêm do(s)
// StageNavigator(s) que o chamador já renderiza na coluna direita (via
// StageMoveRegistryContext), então guardrails de transição continuam nos
// chamadores. Desktop (lg+) fica intacto.
//
// Larguras (18/08/2026, pedido do Daniel após reportar scroll excessivo no
// drawer do Funil de Vendas): 300/300/1152 → 340/320/1400, aplicado como
// padrão global — os 24 chamadores deste shell ganham o alívio junto, não só
// Vendas/Pós-venda. Centro cresce mais que as laterais (552px → 740px, +34%
// vs. +13%/+7%) de propósito: era a coluna mais espremida em conteúdo real
// (formulário da etapa) e continua sendo a área principal.
//
// leftFixo (opcional): parte da coluna esquerda que NÃO colapsa no celular.
// Nasceu do Checklist de Visita (15/09/2026): as abas do drawer de negócio
// moram em `left`, e no celular o bloco inteiro fecha por padrão atrás de
// "+ detalhes" — ou seja, a tela desenhada pra ser usada de pé na frente do
// cliente estava a três toques de distância justamente no celular. O que
// colapsa é metadado ("+ detalhes"); o que é ferramenta fica sempre à vista.
// No celular o bloco fixo sobe pro topo da coluna (order-first); no desktop
// a ordem é a de sempre — metadado primeiro, abas depois —, então os 24
// chamadores que não passam `leftFixo` não mudam em nada.
//
// onDelete (opcional): botão de excluir no header, com confirmação inline —
// mesmo padrão do LeadDetailDrawer (Trash2 → "Confirmar exclusão"/"Cancelar"),
// pra dar paridade de exclusão aos kanbans de RH que usam este shell.
// onArchive (opcional): botão de arquivar/desarquivar ao lado do de excluir.
// É o único caminho de arquivamento a partir da Tabela e do Calendário, onde
// o clique na linha abre o drawer e o menu do card não existe. Hover em
// --surface-alt de propósito, diferente do hover do excluir (--danger-bg):
// não é a mesma família de ação, e a cor é o que diz isso antes do clique.
export function SplitPanelDrawer({ onClose, header, left, leftFixo, center, right, onDelete, deleteLabel = "Excluir card", onArchive, archived = false, archiveLabel }) {
  // Componente só existe montado quando o drawer está aberto (o pai
  // renderiza condicionalmente) — trava o scroll do body enquanto estiver
  // montado, destrava no unmount. Achado da auditoria de fricção de 18/07.
  useBodyScrollLock(true);
  useEscToClose(onClose);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErro, setDeleteErro] = useState(null);
  const [leftOpen, setLeftOpen] = useState(false);
  const [moveSheetOpen, setMoveSheetOpen] = useState(false);
  const [moveSources, setMoveSources] = useState([]);

  const moveRegistry = useMemo(() => ({
    register(id, propsRef) {
      setMoveSources(prev => [...prev.filter(s => s.id !== id), { id, propsRef }]);
      return () => setMoveSources(prev => prev.filter(s => s.id !== id));
    },
  }), []);

  // `onDelete` pode devolver `{ ok: false, motivo }` quando a exclusão não
  // aconteceu — tipicamente RLS barrando, que volta sem erro e com zero linha
  // (ver use-leads.js). Nesse caso o drawer NÃO fecha e mostra o motivo:
  // fechar dava a impressão de que apagou. Chamador que não devolve nada
  // segue fechando como antes — os outros 12 usos deste shell não mudam.
  const handleDeleteConfirmed = async () => {
    if (!onDelete) return;
    setDeleting(true);
    setDeleteErro(null);
    try {
      const r = await onDelete();
      if (r && r.ok === false) {
        setDeleteErro(r.motivo || "Não foi possível excluir.");
        return;
      }
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex lg:items-center lg:justify-center lg:p-6"
      style={{ background: "var(--overlay-scrim)", backdropFilter: "blur(3px)" }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full flex-1 flex flex-col lg:flex-none lg:max-w-[1400px] lg:rounded-2xl lg:max-h-[92vh]"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-pop)", overflow: "hidden", height: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sticky top-0 z-10 px-5 py-3.5 border-b flex items-start justify-between gap-3 shrink-0"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex-1 min-w-0">{header}</div>
          <div className="flex items-center gap-1 shrink-0">
            {onArchive && (
              <button
                onClick={onArchive}
                className="min-w-10 min-h-10 flex items-center justify-center rounded-lg transition-colors duration-150 cursor-pointer"
                style={{ color: "var(--text-dim)", background: "transparent", border: "none" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--text)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
                aria-label={archiveLabel || (archived ? "Desarquivar" : "Arquivar")}
                title={archiveLabel || (archived ? "Desarquivar" : "Arquivar")}
              >
                {archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
              </button>
            )}
            {onDelete && !confirmDelete && (
              <button
                onClick={() => setConfirmDelete(true)}
                className="min-w-10 min-h-10 flex items-center justify-center rounded-lg transition-colors duration-150 cursor-pointer"
                style={{ color: "var(--text-dim)", background: "transparent", border: "none" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--danger-bg)"; e.currentTarget.style.color = "var(--danger)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
                aria-label={deleteLabel}
                title={deleteLabel}
              >
                <Trash2 size={16} />
              </button>
            )}
            {onDelete && confirmDelete && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleDeleteConfirmed}
                  disabled={deleting}
                  className="px-3 min-h-10 flex items-center justify-center rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  style={{ background: "var(--danger)", color: "var(--on-danger)", border: "none", opacity: deleting ? 0.6 : 1 }}
                >
                  {deleting ? "Excluindo…" : "Confirmar exclusão"}
                </button>
                <button
                  onClick={() => { setConfirmDelete(false); setDeleteErro(null); }}
                  className="px-3 min-h-10 flex items-center justify-center rounded-lg text-xs cursor-pointer transition-colors"
                  style={{ color: "var(--text-dim)", background: "transparent", border: "none" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  Cancelar
                </button>
                {deleteErro && (
                  <span
                    role="alert"
                    style={{ fontSize: 11, fontWeight: 600, color: "var(--danger)", background: "var(--danger-bg)", borderRadius: 8, padding: "4px 8px", maxWidth: 260 }}
                  >
                    {deleteErro}
                  </span>
                )}
              </div>
            )}
            <button
              onClick={onClose}
              className="min-w-10 min-h-10 flex items-center justify-center rounded-lg transition-colors duration-150 cursor-pointer shrink-0"
              style={{ color: "var(--text-dim)", background: "transparent", border: "none" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <StageMoveRegistryContext.Provider value={moveRegistry}>
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
            <aside
              className="w-full lg:w-[340px] lg:flex-none lg:shrink-0 lg:overflow-y-auto border-b lg:border-b-0 lg:border-r flex flex-col"
              style={{ borderColor: "var(--border)" }}
            >
              {left && (
                <button
                  onClick={() => setLeftOpen(v => !v)}
                  className="lg:hidden w-full flex items-center justify-between px-5 py-3 text-xs font-semibold cursor-pointer shrink-0"
                  style={{ color: "var(--text-dim)", background: "transparent", border: "none" }}
                  aria-expanded={leftOpen}
                >
                  {leftOpen ? "− detalhes" : `+ detalhes${leftFixo ? " do card" : ""}`}
                  <ChevronDown
                    size={14}
                    style={{ transition: "transform 0.2s", transform: leftOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                  />
                </button>
              )}
              <div className={`p-5 space-y-4 ${leftOpen ? "block" : "hidden"} lg:block`}>
                {left}
              </div>
              {leftFixo && (
                // order-first só no celular: lá a ferramenta vem antes do
                // metadado. No desktop volta pra ordem do DOM, que é a de
                // sempre.
                <div className="p-5 pt-0 lg:pt-0 space-y-4 order-first lg:order-none">
                  {leftFixo}
                </div>
              )}
            </aside>
            <main className="flex-1 min-w-0 lg:overflow-y-auto p-5 space-y-4">
              {center}
            </main>
            <aside
              className="w-full lg:w-[320px] lg:flex-none lg:shrink-0 lg:overflow-y-auto border-t lg:border-t-0 lg:border-l p-5 space-y-4"
              style={{ borderColor: "var(--border)" }}
            >
              {right}
            </aside>
          </div>
        </StageMoveRegistryContext.Provider>

        {moveSources.length > 0 && (
          <div className="lg:hidden shrink-0 px-4 py-3 border-t" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <button
              onClick={() => setMoveSheetOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold cursor-pointer"
              style={{ background: "var(--accent)", color: "var(--on-accent)", border: "none" }}
            >
              Mover para
              <ArrowRight size={15} />
            </button>
          </div>
        )}

        {moveSheetOpen && (
          <>
            <div
              className="lg:hidden"
              style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 60 }}
              onClick={() => setMoveSheetOpen(false)}
            />
            <div
              className="lg:hidden"
              style={{
                position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 61,
                background: "var(--surface)",
                borderRadius: "16px 16px 0 0",
                boxShadow: "var(--shadow-pop)",
                maxHeight: "70vh",
                overflowY: "auto",
                padding: "0 20px 20px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 2px" }}>
                <div style={{ width: 36, height: 4, background: "var(--border-strong)", borderRadius: 2 }} />
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wide mt-2 mb-2" style={{ color: "var(--text-dim)" }}>
                Mover para
              </div>
              {/* Fora do Provider de registro (é irmão das colunas), então os
                  navigators do sheet não se auto-registram. */}
              {moveSources.map(({ id, propsRef }) => {
                const p = propsRef.current || {};
                return (
                  <StageNavigator
                    key={id}
                    targets={p.targets}
                    onMove={async (stageKey) => { setMoveSheetOpen(false); await p.onMove?.(stageKey); }}
                    getKey={p.getKey}
                    disabled={p.disabled}
                    currentStageKey={p.currentStageKey}
                    allStages={p.allStages}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
