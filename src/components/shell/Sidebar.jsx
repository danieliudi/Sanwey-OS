import React, { useEffect, useState } from "react";
import { LogOut, ChevronDown, ChevronLeft } from "lucide-react";
import { COMPANIES } from "../../constants/companies";

const STORAGE_KEY = "sidebar_collapsed_groups";
const ORDER_KEY = "sidebar_item_order";
const RAIL_KEY = "sidebar_rail_collapsed";

function loadRail() {
  try { return localStorage.getItem(RAIL_KEY) === "1"; }
  catch { return false; }
}
function saveRail(v) {
  try { localStorage.setItem(RAIL_KEY, v ? "1" : "0"); } catch {}
}

function loadCollapsed() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function saveCollapsed(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function loadOrder() {
  try { return JSON.parse(localStorage.getItem(ORDER_KEY) || "{}"); }
  catch { return {}; }
}
function saveOrder(state) {
  try { localStorage.setItem(ORDER_KEY, JSON.stringify(state)); } catch {}
}

// Reordenação por segurar-e-arrastar o ícone (não o item inteiro, pra um
// clique normal em qualquer parte da linha continuar navegando na hora,
// sem gesto/threshold nenhum) — ordem por grupo, persistida no navegador.
function applySavedOrder(items, savedIds) {
  if (!savedIds?.length) return items;
  const byId = new Map(items.map(it => [it.id, it]));
  const ordered = savedIds.map(id => byId.get(id)).filter(Boolean);
  const missing = items.filter(it => !savedIds.includes(it.id));
  return [...ordered, ...missing];
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 1024);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return mobile;
}

const SIDEBAR_W = 288;
const SIDEBAR_W_RAIL = 72;

const T = {
  bg:            "var(--surface-alt)",
  border:        "var(--border)",
  text:          "var(--text-dim)",
  textActive:    "var(--accent)",
  textOnSurface: "var(--text)",
  activeBg:      "var(--surface)",
  hoverBg:       "var(--border)",
  activeStrip:   "var(--accent)",
  groupLabel:    "var(--text-faint)",
};

const ROLE_LABEL = {
  admin:             "Administrador",
  gerente:           "Gerente Comercial",
  vendedor:          "Vendedor",
  consultor:         "Consultor",
  marketing:         "Marketing",
  gerente_marketing: "Gerente de Marketing",
  agencia:           "Agência",
  rh:                "RH",
  gerente_rh:        "Gerente de RH",
};

export function Sidebar({ navGroups, section, onSectionChange, currentUser, onLogout, mobileOpen, onMobileClose, onNewLead }) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const [order, setOrder] = useState(loadOrder);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [railCollapsed, setRailCollapsed] = useState(loadRail);
  // Modo "trilho" (só ícones) — só existe em desktop; no mobile o menu é um
  // overlay off-canvas que não reserva espaço de layout, então recolher não
  // faz sentido lá (ver useIsMobile acima e sidebarStyle abaixo).
  const rail = !isMobile && railCollapsed;

  // Outros componentes (App.jsx, KanbanFab) leem a largura real da sidebar
  // via essa custom property em vez de assumir 288px fixo — assim eles
  // acompanham o recolher/expandir sem precisar de prop drilling.
  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", `${railCollapsed ? SIDEBAR_W_RAIL : SIDEBAR_W}px`);
  }, [railCollapsed]);

  const toggleRail = () => {
    setRailCollapsed(prev => {
      const next = !prev;
      saveRail(next);
      return next;
    });
  };

  const handleNavClick = (itemId) => {
    onSectionChange(itemId);
    if (isMobile) onMobileClose?.();
  };

  const toggleGroup = (label) => {
    setCollapsed(prev => {
      const next = { ...prev, [label]: !prev[label] };
      saveCollapsed(next);
      return next;
    });
  };

  const orderedItems = (group) => applySavedOrder(group.items, order[group.label || "__default"]);

  const handleItemDrop = (group, targetId) => {
    setDragOverId(null);
    const sourceId = draggedId;
    setDraggedId(null);
    if (!sourceId || sourceId === targetId) return;
    const groupKey = group.label || "__default";
    const currentIds = orderedItems(group).map(it => it.id);
    const from = currentIds.indexOf(sourceId);
    const to = currentIds.indexOf(targetId);
    if (from === -1 || to === -1) return;
    const nextIds = [...currentIds];
    nextIds.splice(from, 1);
    nextIds.splice(to, 0, sourceId);
    setOrder(prev => {
      const next = { ...prev, [groupKey]: nextIds };
      saveOrder(next);
      return next;
    });
  };

  const sidebarStyle = {
    position: "fixed",
    top: 0, left: 0,
    height: "100vh",
    width: isMobile ? SIDEBAR_W : (rail ? SIDEBAR_W_RAIL : SIDEBAR_W),
    background: T.bg,
    borderRight: `1px solid ${T.border}`,
    display: "flex",
    flexDirection: "column",
    // Sem overflow:hidden aqui — o botão de recolher (right:-11, encostado
    // na borda) precisa sair da caixa da sidebar; `nav` logo abaixo já cuida
    // do próprio scroll interno (overflowY auto / overflowX hidden). O
    // tooltip do item em modo trilho é position:fixed (ver NavItem) — não
    // depende de nenhum overflow daqui.
    zIndex: isMobile ? 50 : 40,
    ...(isMobile
      ? {
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s cubic-bezier(.4,0,.2,1)",
        }
      : { transition: "width 0.2s cubic-bezier(.4,0,.2,1)" }),
  };

  return (
    <>
      {isMobile && mobileOpen && (
        <div
          onClick={onMobileClose}
          style={{ position: "fixed", inset: 0, background: "var(--overlay-scrim)", zIndex: 49 }}
        />
      )}
      <aside style={sidebarStyle}>
        {/* ── Brand ── */}
        <button
          onClick={() => handleNavClick("dashboard")}
          title="Ir para o início"
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            padding: rail ? "0 0 0 18px" : "0 20px",
            gap: 12,
            flexShrink: 0,
            background: "none",
            border: "none",
            borderBottom: `1px solid ${T.border}`,
            cursor: "pointer",
            width: "100%",
            textAlign: "left",
            fontFamily: "inherit",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: COMPANIES.industria.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <img
              src="/sanwey-simbolo.png"
              alt="Sanwey"
              style={{ width: 20, height: 20, objectFit: "contain", filter: "brightness(0) invert(1)" }}
            />
          </div>
          {!rail && (
            <div style={{ lineHeight: 1.3, overflow: "hidden", whiteSpace: "nowrap" }}>
              <div style={{ color: "var(--text)", fontWeight: 700, fontSize: 14 }}>Gestão Sanwey</div>
              <div style={{ color: "var(--text-faint)", fontSize: 11 }}>Plataforma integrada</div>
            </div>
          )}
        </button>

        {/* Botão de recolher/expandir — só existe em desktop (mobile é
            overlay off-canvas, não tem "trilho"). Flutua encostado na borda
            direita da sidebar, sempre no mesmo lugar. */}
        {!isMobile && (
          <button
            onClick={toggleRail}
            title={rail ? "Expandir menu" : "Recolher menu"}
            style={{
              position: "absolute",
              top: 78, right: -11,
              width: 22, height: 22,
              borderRadius: "50%",
              background: "var(--surface)",
              border: "1px solid var(--border-strong)",
              boxShadow: "var(--shadow-card)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              color: "var(--text-dim)",
              zIndex: 5,
              padding: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--accent)"; e.currentTarget.style.color = "#FFFFFF"; e.currentTarget.style.borderColor = "var(--accent)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }}
          >
            <ChevronLeft size={13} strokeWidth={2.5} style={{ transform: rail ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
          </button>
        )}

        {/* ── Nav ── */}
        <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "4px 0 8px", scrollbarWidth: "none" }}>
          {navGroups.map((group, gi) => {
            const isCollapsed = group.label ? !!collapsed[group.label] : false;
            return (
              <div key={gi} style={{ marginTop: gi === 0 ? 0 : 8 }}>
                {gi > 0 && group.label && (
                  <div style={{ height: 1, background: "var(--border)", margin: "0 16px 8px" }} />
                )}
                {group.label && !rail && (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 16px 5px 18px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <span style={{
                      color: "var(--text-faint)",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                    }}>
                      {group.label}
                    </span>
                    <ChevronDown
                      size={13}
                      strokeWidth={2.5}
                      style={{
                        flexShrink: 0,
                        color: "var(--text-faint)",
                        transition: "transform 0.2s",
                        transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                      }}
                    />
                  </button>
                )}
                {/* No modo trilho ignora o collapse por grupo — não há rótulo
                    pra reabrir um grupo fechado, então todo item fica sempre
                    visível quando só ícones. */}
                {(!isCollapsed || rail) && orderedItems(group).map((item) => (
                  <NavItem
                    key={item.id}
                    id={item.id}
                    icon={item.icon}
                    label={item.label}
                    badge={item.badge}
                    active={section === item.id}
                    onClick={() => handleNavClick(item.id)}
                    rail={rail}
                    isDragOver={dragOverId === item.id}
                    onIconDragStart={() => setDraggedId(item.id)}
                    onIconDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
                    onRowDragOver={(e) => { if (draggedId) { e.preventDefault(); setDragOverId(item.id); } }}
                    onRowDrop={(e) => { e.preventDefault(); handleItemDrop(group, item.id); }}
                  />
                ))}
              </div>
            );
          })}
        </nav>

        {/* ── User footer ── */}
        <div
          style={{
            borderTop: `1px solid ${T.border}`,
            padding: "8px 8px",
            display: "flex",
            alignItems: "center",
            justifyContent: rail ? "center" : undefined,
            gap: 4,
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => handleNavClick("settings")}
            title={rail ? `Configurações · ${currentUser?.name || "Convidado"}` : "Configurações"}
            style={{
              flex: rail ? "0 0 auto" : 1,
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 8px",
              background: section === "settings" ? "var(--surface)" : "transparent",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              transition: "background 0.12s",
              textAlign: "left",
              boxShadow: section === "settings" ? "var(--shadow-card)" : "none",
            }}
            onMouseEnter={e => { if (section !== "settings") e.currentTarget.style.background = "var(--border)"; }}
            onMouseLeave={e => { if (section !== "settings") e.currentTarget.style.background = "transparent"; }}
          >
            <div
              style={{
                width: 36, height: 36,
                borderRadius: "50%",
                background: currentUser?.avatarUrl ? "transparent" : (currentUser?.avatarBg || "var(--surface)"),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                color: "var(--text-dim)",
                fontSize: 12,
                flexShrink: 0,
                overflow: "hidden",
                border: `2px solid ${section === "settings" ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              {currentUser?.avatarUrl
                ? <img src={currentUser.avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : (currentUser?.initials || "?")}
            </div>
            {!rail && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: section === "settings" ? "var(--accent)" : "var(--text)", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {currentUser?.name || "Convidado"}
                </div>
                <div style={{ color: "var(--text-faint)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ROLE_LABEL[currentUser?.role] || "—"}
                </div>
              </div>
            )}
          </button>
          {!rail && (
            <button
              onClick={onLogout}
              title="Sair"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-faint)",
                cursor: "pointer",
                padding: 8,
                borderRadius: "var(--radius-sm)",
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
                transition: "background 0.12s, color 0.12s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--border)"; e.currentTarget.style.color = "var(--danger)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-faint)"; }}
            >
              <LogOut size={15} strokeWidth={2} />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

// Segurar o ícone e arrastar reordena o item dentro do grupo — só o ícone
// é `draggable`, então um clique normal em qualquer outro ponto da linha
// (inclusive no próprio ícone sem mover) continua navegando na hora, sem
// nenhum gesto/atraso extra atrapalhando.
function NavItem({ id, icon: Icon, label, badge, active, onClick, rail, isDragOver, onIconDragStart, onIconDragEnd, onRowDragOver, onRowDrop }) {
  const [hovered, setHovered] = useState(false);
  // Âncora do tooltip em coordenadas de viewport. O balão era absolute
  // (left:100%) dentro do <nav>, mas o nav tem overflowX:hidden pro scroll
  // interno — o balão saía da caixa e era recortado na borda da sidebar
  // (bug reportado com print: tooltip escondido atrás do conteúdo).
  // position:fixed escapa de qualquer overflow de ancestral.
  const [tip, setTip] = useState(null);
  return (
    <button
      data-nav-id={id}
      onClick={onClick}
      onMouseEnter={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setTip({ x: r.right + 10, y: r.top + r.height / 2 });
        setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}
      onDragOver={onRowDragOver}
      onDrop={onRowDrop}
      style={{
        width: rail ? "auto" : "calc(100% - 16px)",
        margin: rail ? "1px 12px" : "0 8px",
        display: "flex",
        alignItems: "center",
        justifyContent: rail ? "center" : "flex-start",
        gap: 9,
        padding: rail ? "9px" : "7px 10px",
        position: "relative",
        fontSize: 13,
        fontFamily: "inherit",
        fontWeight: active ? 600 : 500,
        color: active ? "var(--text)" : hovered ? "var(--text)" : "var(--text-dim)",
        background: rail
          ? (active ? "var(--accent-tint)" : hovered ? "var(--border)" : "transparent")
          : (active ? "var(--surface)" : hovered ? "var(--border)" : "transparent"),
        border: "none",
        boxShadow: isDragOver ? "inset 0 2px 0 0 var(--accent)" : (!rail && active) ? "var(--shadow-card)" : "none",
        cursor: "pointer",
        textAlign: "left",
        whiteSpace: "nowrap",
        transition: "background 0.12s, color 0.12s, box-shadow 0.12s",
        borderRadius: "var(--radius-sm)",
      }}
    >
      {Icon && (
        <span
          draggable
          onDragStart={(e) => { e.stopPropagation(); onIconDragStart?.(); }}
          onDragEnd={(e) => { e.stopPropagation(); onIconDragEnd?.(); }}
          onMouseDown={(e) => e.stopPropagation()}
          title={rail ? undefined : "Arraste para reordenar"}
          style={{ position: "relative", display: "flex", flexShrink: 0, cursor: "grab" }}
        >
          <Icon size={15} strokeWidth={2} style={{ opacity: 0.85, color: rail && active ? "var(--accent)" : undefined }} />
          {/* Modo trilho esconde o label — o pill numérico não cabe, vira só
              um ponto no canto do ícone (mesma linguagem de "precisa de
              atenção", ver comment-badge.js). */}
          {rail && badge != null && (
            <span
              style={{
                position: "absolute", top: -3, right: -3,
                width: 7, height: 7, borderRadius: "50%",
                background: "var(--warning)", border: "1.5px solid var(--surface-alt)",
              }}
            />
          )}
        </span>
      )}
      {!rail && <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>}
      {!rail && badge != null && (
        <span
          style={{
            flexShrink: 0,
            minWidth: 16, height: 16, padding: "0 5px",
            borderRadius: 999,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, lineHeight: 1,
            background: "var(--warning-bg)", color: "var(--warning)",
          }}
        >
          {badge}
        </span>
      )}
      {rail && hovered && tip && (
        <span
          style={{
            position: "fixed", left: tip.x, top: tip.y, transform: "translateY(-50%)",
            background: "var(--text)", color: "var(--bg)", fontSize: 12, fontWeight: 600,
            padding: "5px 10px", borderRadius: 6, whiteSpace: "nowrap", boxShadow: "var(--shadow-pop)", zIndex: 60,
            pointerEvents: "none",
          }}
        >
          {label}
        </span>
      )}
    </button>
  );
}

export default Sidebar;
