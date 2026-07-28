import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, ArrowRight, ArrowLeft, Trash2, Copy } from "lucide-react";

function MoveTargetItem({ stage, onMove, setMenuOpen, icon: Icon, faded = false }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onMove(stage.key); setMenuOpen(false); }}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
        background: "transparent", border: "none", cursor: "pointer", fontSize: 13,
        color: "var(--text)", textAlign: "left", transition: "background 0.1s",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--accent)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text)"; }}
    >
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color, flexShrink: 0 }} />
      {stage.name}
      <Icon size={11} style={{ marginLeft: "auto", opacity: faded ? 0.4 : 0.6 }} />
    </button>
  );
}

// Botão "…" + dropdown "Mover para" compartilhado por todos os Kanbans
// (Entregas, Campanhas, Leads, RH). O dropdown é renderizado via portal em
// document.body e posicionado com coordenadas de viewport (position: fixed)
// — toda coluna de Kanban aqui tem a lista de cards num container com
// overflow-y: auto separado do cabeçalho; um menu posicionado como filho
// normal (position: absolute) que abre pra cima perto do topo da lista era
// cortado por esse overflow e "sumia" atrás do cabeçalho da coluna (bug
// real, reportado no RH e reproduzível em qualquer Kanban). Fora da coluna,
// via portal, o overflow dela deixa de valer pro menu.
//
// onDelete (opcional): acrescenta "Excluir card" ao fim do dropdown — mesma
// ação disponível nos 3 pontinhos de qualquer card da plataforma, sem
// precisar abrir o detalhe primeiro. Confirmação inline (2 cliques) em vez
// de window.confirm, que trava sessões automatizadas/headless sem handler
// de diálogo.
//
// Sem `targets` (nenhuma opção de "mover para"): o board desktop já cobre
// mover via drag-and-drop, então o menu com "..." + dropdown de uma linha só
// (achado do usuário, 22/07) é um passo a mais sem necessidade — o gatilho
// vira direto o ícone de lixeira, e o clique já entra no passo de
// confirmação, sem dropdown intermediário. Quem NÃO tem drag-and-drop (o
// acordeão mobile, que reusa este mesmo componente) continua passando
// `targets`/`onMove` e mantém o menu completo — ver LeadKanbanCard/RHKanbanCard.
export function MoveStageMenu({
  targets = [], onMove, onOpenChange, onDelete, deleteLabel = "Excluir card",
  onDuplicate, duplicateLabel = "Duplicar card",
  // Mensagem do passo de confirmação (2º clique) — sobrescrevível por chamador
  // que precisa deixar claro que "Excluir" aqui não é uma exclusão física
  // (ex.: Onboarding de RH, ver RHOnboardingView). Default cobre o caso comum
  // (hard delete em Leads/Campanhas/Entregas/demais Kanbans de RH).
  confirmMessage = "Excluir este card? Não pode ser desfeito.",
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [pos, setPos] = useState(null); // { top | bottom, left } em coordenadas de viewport
  const wrapRef = useRef(null);
  const dropdownRef = useRef(null);

  // Avisa o card pai quando o menu abre/fecha — o card usa isso pra não
  // disparar o onClick de "abrir detalhe" no clique que só fechou o menu.
  useEffect(() => { onOpenChange?.(menuOpen); }, [menuOpen, onOpenChange]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e) => {
      if (wrapRef.current?.contains(e.target) || dropdownRef.current?.contains(e.target)) return;
      setMenuOpen(false);
    };
    // Fecha ao rolar qualquer ancestral com scroll — o menu é fixed e não
    // acompanharia o botão, ficando "flutuando" solto na tela.
    const close = () => setMenuOpen(false);
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menuOpen]);

  useEffect(() => { if (!menuOpen) setPos(null); }, [menuOpen]);
  useEffect(() => { if (!menuOpen) setConfirmingDelete(false); }, [menuOpen]);

  useLayoutEffect(() => {
    if (!menuOpen || !wrapRef.current || !dropdownRef.current) return;
    const btnRect = wrapRef.current.getBoundingClientRect();
    const menuRect = dropdownRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - btnRect.bottom;
    const openUpward = spaceBelow < menuRect.height + 12;
    const left = Math.max(8, Math.min(btnRect.right - menuRect.width, window.innerWidth - menuRect.width - 8));
    setPos(openUpward
      ? { bottom: window.innerHeight - btnRect.top + 4, left }
      : { top: btnRect.bottom + 4, left });
  }, [menuOpen, targets.length, confirmingDelete]);

  const hasMoveTargets = Boolean(targets?.length && onMove);
  const hasDuplicate = Boolean(onDuplicate);
  if (!hasMoveTargets && !onDelete && !hasDuplicate) return null;

  // Sem opções de "mover para" e sem duplicar (board desktop, drag-and-drop já
  // cobre mover): o gatilho vira direto a lixeira, e o clique já abre no
  // passo de confirmação — sem dropdown de uma linha só no meio do caminho.
  // Some com esse atalho assim que houver 2+ ações no menu.
  const deleteOnly = !hasMoveTargets && !hasDuplicate && Boolean(onDelete);

  const handleDuplicate = async (e) => {
    e.stopPropagation();
    if (duplicating) return;
    setDuplicating(true);
    try {
      await onDuplicate();
      setMenuOpen(false);
    } finally {
      setDuplicating(false);
    }
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        title={deleteOnly ? "Excluir card" : "Mover para outra etapa"}
        onClick={e => {
          e.stopPropagation();
          if (deleteOnly) {
            setMenuOpen(v => { const next = !v; if (next) setConfirmingDelete(true); return next; });
          } else {
            setMenuOpen(v => !v);
          }
        }}
        style={{
          background: "transparent", border: "none", color: "var(--text-dim)",
          cursor: "pointer", padding: 2, borderRadius: 4, display: "flex",
          alignItems: "center", lineHeight: 1,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = deleteOnly ? "#FEE2E2" : "var(--surface-alt)"; e.currentTarget.style.color = deleteOnly ? "#B91C1C" : "var(--accent)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-dim)"; }}
      >
        {deleteOnly ? <Trash2 size={14} /> : <MoreVertical size={14} />}
      </button>
      {menuOpen && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: pos?.top,
            bottom: pos?.bottom,
            left: pos?.left ?? -9999,
            visibility: pos ? "visible" : "hidden",
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
            boxShadow: "var(--shadow-pop)", zIndex: 2000, minWidth: 180, maxWidth: 260, overflow: "hidden",
          }}
          onClick={e => e.stopPropagation()}
        >
          {confirmingDelete ? (
            <div style={{ padding: "10px 12px" }}>
              <div style={{ fontSize: 12, color: "var(--text)", marginBottom: 8, lineHeight: 1.4 }}>
                {confirmMessage}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={e => { e.stopPropagation(); onDelete(); setMenuOpen(false); }}
                  style={{ flex: 1, background: "#B91C1C", color: "#FFFFFF", border: "none", borderRadius: 6, padding: "6px 8px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  Excluir
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setConfirmingDelete(false); }}
                  style={{ flex: 1, background: "var(--surface-alt)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 8px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              {hasMoveTargets && (
                <>
                  <div style={{ padding: "6px 12px 4px", fontSize: 10, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Mover para
                  </div>
                  {/* Agrupa por direção (etapa anterior/próxima no pipeline) —
                      antes tudo vinha numa lista só com a mesma seta decorativa
                      pra qualquer destino, sem indicar se era avançar ou
                      retroceder. `direction` é opcional: sem ele (chamador que
                      não anotou), cai no fallback flat de sempre. */}
                  {targets.some(s => s.direction) ? (
                    <>
                      {targets.filter(s => s.direction === "before").length > 0 && (
                        <div style={{ padding: "4px 12px 2px", fontSize: 9.5, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 4 }}>
                          <ArrowLeft size={9} />
                          Etapas anteriores
                        </div>
                      )}
                      {targets.filter(s => s.direction === "before").map(s => (
                        <MoveTargetItem key={s.key} stage={s} onMove={onMove} setMenuOpen={setMenuOpen} icon={ArrowLeft} />
                      ))}
                      {targets.filter(s => s.direction === "after").length > 0 && (
                        <div style={{ padding: "8px 12px 2px", fontSize: 9.5, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 4 }}>
                          <ArrowRight size={9} />
                          Próximas etapas
                        </div>
                      )}
                      {targets.filter(s => s.direction === "after").map(s => (
                        <MoveTargetItem key={s.key} stage={s} onMove={onMove} setMenuOpen={setMenuOpen} icon={ArrowRight} />
                      ))}
                    </>
                  ) : (
                    targets.map(s => (
                      <MoveTargetItem key={s.key} stage={s} onMove={onMove} setMenuOpen={setMenuOpen} icon={ArrowRight} faded />
                    ))
                  )}
                </>
              )}
              {hasDuplicate && (
                <>
                  {hasMoveTargets && <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />}
                  <button
                    onClick={handleDuplicate}
                    disabled={duplicating}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                      background: "transparent", border: "none", cursor: duplicating ? "default" : "pointer",
                      fontSize: 13, color: "var(--text)", textAlign: "left", opacity: duplicating ? 0.6 : 1,
                    }}
                    onMouseEnter={e => { if (!duplicating) e.currentTarget.style.background = "var(--surface-alt)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <Copy size={13} style={{ flexShrink: 0 }} />
                    {duplicating ? "Duplicando…" : duplicateLabel}
                  </button>
                </>
              )}
              {onDelete && (
                <>
                  {(hasMoveTargets || hasDuplicate) && <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />}
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmingDelete(true); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                      background: "transparent", border: "none", cursor: "pointer", fontSize: 13,
                      color: "#B91C1C", textAlign: "left", transition: "background 0.1s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <Trash2 size={13} style={{ flexShrink: 0 }} />
                    {deleteLabel}
                  </button>
                </>
              )}
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
