import React, { useEffect, useState } from "react";
import { Search, Moon, Sun, LifeBuoy, Bug } from "lucide-react";
import { NotificationCenter } from "./NotificationCenter";

// Achado da 2ª auditoria: o badge do atalho de busca mostrava só um ícone
// de lupa (redundante com o ícone da própria busca), sem indicar o atalho
// de teclado real (Cmd+K/Ctrl+K já tratado em App.jsx).
const isMacPlatform = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent || navigator.platform || "");
const SEARCH_SHORTCUT_LABEL = isMacPlatform ? "⌘K" : "Ctrl K";

// Antes removia --accent/--accent-hover ao entrar no escuro, revertendo pro
// neutro do tema — sem isso, um acento pessoal customizado (Configurações >
// Aparência) sumia à noite. O CSS de [data-theme="dark"] já traz o par
// correto por tema (index.css), então aplicar o mesmo valor customizado nos
// dois temas é a correção: quem nunca customizou nada continua herdando o
// default do CSS (vermelho da marca, também no escuro); quem customizou
// mantém a própria escolha ao alternar o tema.
function applyCustomAccent() {
  const accent = localStorage.getItem("sanwey-accent");
  const hover  = localStorage.getItem("sanwey-accent-hover");
  if (accent) document.documentElement.style.setProperty("--accent", accent);
  else        document.documentElement.style.removeProperty("--accent");
  if (hover)  document.documentElement.style.setProperty("--accent-hover", hover);
  else        document.documentElement.style.removeProperty("--accent-hover");
}

function useTheme() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("ds-theme");
    return saved === "dark";
  });

  const toggle = () => {
    setDark(prev => {
      const next = !prev;
      document.documentElement.dataset.theme = next ? "dark" : "light";
      localStorage.setItem("ds-theme", next ? "dark" : "light");
      applyCustomAccent();
      return next;
    });
  };

  useEffect(() => {
    const saved = localStorage.getItem("ds-theme");
    const isDark = saved === "dark";
    if (isDark) document.documentElement.dataset.theme = "dark";
    applyCustomAccent();
  }, []);

  return { dark, toggle };
}

export function TopBar({
  title,
  onMenuToggle,
  onSearchOpen,
  /* Texto do gatilho de busca. Vem pronto do App.jsx (mesma função que o
     CommandPalette usa por dentro) porque a TopBar não conhece cargo — e o
     texto tem que citar só o que ESTE usuário acha. Antes era fixo, "Buscar
     lead, campanha, funcionário...", e mentia pra maioria: campanhas e
     funcionários são travados por cargo. */
  searchPlaceholder,
  notifications,
  unreadCount,
  onMarkAllRead,
  onMarkRead,
  onClearAll,
  desktopPermission,
  onRequestDesktopPermission,
  onSelectLead,
  onNavigate,
  onHelpClick,
  onReportBug,
}) {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  const { dark, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between"
      style={{
        height: 64,
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        paddingLeft: isDesktop ? 32 : 16,
        paddingRight: isDesktop ? 32 : 16,
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Mobile: brand name */}
      {!isDesktop && (
        <span style={{ fontWeight: 800, fontSize: 18, color: "var(--text)", letterSpacing: "-0.02em" }}>
          Gestão Sanwey
        </span>
      )}

      {/* Desktop: search bar */}
      {isDesktop && (
        <button
          onClick={onSearchOpen}
          data-tour="busca-global"
          className="flex items-center gap-2 border rounded-sm transition-all duration-150"
          style={{
            padding: "8px 14px",
            background: "var(--surface-alt)",
            borderColor: "var(--border)",
            color: "var(--text-faint)",
            fontSize: 14,
            width: 360,
            cursor: "pointer",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = "var(--border-strong)";
            e.currentTarget.style.background = "var(--surface)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.background = "var(--surface-alt)";
          }}
          aria-label="Abrir busca global"
        >
          <Search size={15} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
          {/* nowrap + minWidth 0: o botão tem largura FIXA (360px), então um
              texto mais longo que ela quebrava em duas linhas e esticava a
              barra do topo inteira pra baixo (regressão real da 4.89.0, quando
              o texto passou a listar as categorias do cargo). Truncar é a
              defesa estrutural; o texto também foi encurtado, mas só isso
              deixaria o próximo rótulo comprido reabrir o mesmo buraco. */}
          <span
            style={{
              color: "var(--text-faint)",
              flex: 1,
              minWidth: 0,
              textAlign: "left",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {searchPlaceholder || "Buscar..."}
          </span>
          <span
            className="select-none rounded-sm flex items-center justify-center"
            style={{
              padding: "0 6px",
              height: 20,
              background: "var(--surface-alt)",
              color: "var(--text-faint)",
              border: "1px solid var(--border-strong)",
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0,
            }}
            title="Atalho de busca"
          >
            {SEARCH_SHORTCUT_LABEL}
          </span>
        </button>
      )}

      {/* Right: theme toggle + notifications */}
      <div className="flex items-center gap-1">
        {!isDesktop && (
          <button
            onClick={onSearchOpen}
            style={{ width: 40, height: 40, background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "center" }}
            aria-label="Buscar"
          >
            <Search size={20} strokeWidth={2} />
          </button>
        )}

        {!isDesktop && onHelpClick && (
          <button
            onClick={onHelpClick}
            title="Ajuda e tutoriais"
            style={{ width: 40, height: 40, background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "center" }}
            aria-label="Ajuda"
          >
            <LifeBuoy size={20} strokeWidth={2} />
          </button>
        )}

        {/* Reportar um problema — atalho fixo, decidido com o Daniel 02/09/2026.
            Fica AQUI e não num botão flutuante: o flutuante do canto inferior
            já é o "Novo card" dos 13 quadros (KanbanFab) e os dois brigariam.
            Fica fora do menu de perfil pelo motivo oposto: escondido, ninguém
            usa — e o problema que estamos resolvendo é justamente adesão. */}
        {onReportBug && (
          <button
            onClick={onReportBug}
            title="Reportar um problema nesta tela"
            data-tour="reportar-problema"
            style={{ width: 36, height: 36, background: "transparent", border: "none", color: "var(--text-faint)", cursor: "pointer", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.12s, color 0.12s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--danger)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-faint)"; }}
            aria-label="Reportar um problema"
          >
            <Bug size={16} strokeWidth={2} />
          </button>
        )}

        <button
          onClick={toggleTheme}
          title={dark ? "Modo claro" : "Modo escuro"}
          style={{ width: 36, height: 36, background: "transparent", border: "none", color: "var(--text-faint)", cursor: "pointer", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.12s, color 0.12s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--text)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-faint)"; }}
          aria-label="Alternar tema"
        >
          {dark ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
        </button>

        <NotificationCenter
          notifications={notifications || []}
          unreadCount={unreadCount || 0}
          onMarkAllRead={onMarkAllRead}
          onMarkRead={onMarkRead}
          onClearAll={onClearAll}
          desktopPermission={desktopPermission}
          onRequestDesktopPermission={onRequestDesktopPermission}
          onSelectLead={onSelectLead}
          onNavigate={onNavigate}
        />
      </div>
    </header>
  );
}

export default TopBar;
