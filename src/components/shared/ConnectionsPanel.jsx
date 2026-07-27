import React, { useState } from "react";
import { ChevronRight } from "lucide-react";

// Aba/painel "Conexões" — estilo Pipefy: registros de outras telas
// vinculados a esta entidade (Colaborador, Cliente...), agrupados por
// origem, com preview de card clicável. Genérico: não sabe nada sobre RH
// ou Comercial — cada grupo já vem com os itens e uma função `renderItem`
// que os transforma no formato de exibição (o domínio é responsabilidade
// de quem monta `groups`, não deste componente).
//
// groups: Array<{
//   key: string,
//   label: string,
//   color: string,                  // cor do "dot" do grupo
//   items: any[],                   // itens crus (já filtrados pra esta entidade)
//   renderItem: (item) => { title, badgeLabel?, badgeBg?, badgeColor?, meta? },
//   onOpenItem: (item) => void,      // navega/abre o registro na tela de origem
//   emptyLabel?: string,             // default "Nenhum registro encontrado."
// }>
export function ConnectionsPanel({ groups = [], loading, introText }) {
  const [openKeys, setOpenKeys] = useState(() => new Set(groups.filter(g => g.items?.length > 0).map(g => g.key)));

  const toggle = (key) => {
    setOpenKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  if (loading) {
    return <div className="text-xs text-center py-8" style={{ color: "var(--text-dim)" }}>Carregando conexões…</div>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {introText && <div className="text-xs mb-1" style={{ color: "var(--text-dim)", lineHeight: 1.5 }}>{introText}</div>}
      {groups.map(g => {
        const open = openKeys.has(g.key);
        const count = g.items?.length || 0;
        return (
          <div key={g.key} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={() => toggle(g.key)}
              className="w-full flex items-center gap-2.5 px-3.5 py-3"
              style={{ background: "var(--surface-alt)", border: "none", cursor: "pointer", textAlign: "left" }}
            >
              <ChevronRight size={12} style={{ color: "var(--text-faint)", flexShrink: 0, transition: "transform .15s", transform: open ? "rotate(90deg)" : "none" }} />
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: g.color, flexShrink: 0 }} />
              <span className="flex-1 text-[13px] font-bold" style={{ color: "var(--text)" }}>{g.label}</span>
              <span className="text-[11px] font-bold" style={{ color: "var(--text-dim)" }}>{count}</span>
            </button>
            {open && (
              <div className="flex flex-col gap-2 px-3.5 py-3">
                {count === 0 ? (
                  <div className="text-[11.5px]" style={{ color: "var(--text-faint)" }}>{g.emptyLabel || "Nenhum registro encontrado."}</div>
                ) : (
                  g.items.map((item, i) => {
                    const view = g.renderItem(item);
                    return (
                      <button
                        key={item.id ?? i}
                        type="button"
                        onClick={() => g.onOpenItem(item)}
                        className="text-left rounded-lg flex flex-col gap-1"
                        style={{ border: "1px solid var(--border)", background: "var(--surface)", padding: "10px 12px", cursor: "pointer" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-strong, var(--text-faint))"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12.5px] font-semibold truncate" style={{ color: "var(--text)" }}>{view.title}</span>
                          {view.badgeLabel && (
                            <span
                              className="text-[10px] font-bold rounded-full flex-shrink-0"
                              style={{ padding: "2px 8px", background: view.badgeBg || "var(--surface-alt)", color: view.badgeColor || "var(--text-dim)" }}
                            >
                              {view.badgeLabel}
                            </span>
                          )}
                        </div>
                        {view.meta && <div className="text-[11px]" style={{ color: "var(--text-dim)" }}>{view.meta}</div>}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ConnectionsPanel;
