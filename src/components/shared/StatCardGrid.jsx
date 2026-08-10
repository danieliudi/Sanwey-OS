import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

// Faixa de indicadores no topo de dashboard — mockup revalidado com o Daniel
// 10/08/2026, medido em cima de uma tela de 360×667 (iPhone SE/13 mini, o pior
// caso real entre os vendedores).
//
// Dois problemas que este componente resolve de uma vez:
//   1. Cards dimensionados pro desktop empurravam o conteúdo pra fora da tela
//      (Pendências gastava 408px só de card e nenhuma pendência aparecia sem
//      rolar). Abaixo de lg cada card entra em modo `dense` (ver StatCard).
//   2. Onde a saída anterior era um carrossel horizontal (Marketing, RH,
//      Painel), metade dos indicadores ficava escondida fora da tela sem
//      sinal claro. Aqui tudo fica em grade de 2 colunas — e quando passa de
//      `maxMobile`, o excedente vai pra trás de um "+N indicadores" em vez de
//      virar 4 linhas de scroll (que só trocaria um problema pelo outro).
//
// Acima de lg o layout é o de hoje: quem chama passa as colunas de desktop em
// `desktopClassName` e o card volta ao tamanho cheio sozinho, por CSS.
export function StatCardGrid({
  children,
  desktopClassName = "lg:grid-cols-4",
  maxMobile = 4,
  className = "",
}) {
  const [expanded, setExpanded] = useState(false);
  // toArray já descarta null/false — as views montam os cards atrás de
  // `widgetVisible(...)`, então a contagem tem que ser a dos visíveis.
  const items = React.Children.toArray(children);
  const overflow = Math.max(0, items.length - maxMobile);

  return (
    <div className={className}>
      <div className={`grid grid-cols-2 gap-2 lg:gap-3 ${desktopClassName}`}>
        {items.map((child, i) => (
          <div
            key={child.key ?? i}
            className={!expanded && i >= maxMobile ? "hidden lg:block" : undefined}
          >
            {React.isValidElement(child) ? React.cloneElement(child, { dense: true }) : child}
          </div>
        ))}
      </div>

      {overflow > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          className="lg:hidden w-full mt-2 py-2 rounded-lg border border-dashed flex items-center justify-center gap-1.5"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-dim)",
            fontSize: 11.5,
            fontWeight: 650,
            background: "transparent",
            cursor: "pointer",
          }}
        >
          {expanded ? "Ver menos" : `+ ${overflow} indicador${overflow === 1 ? "" : "es"}`}
          <ChevronDown
            size={13}
            style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 150ms" }}
          />
        </button>
      )}
    </div>
  );
}

export default StatCardGrid;
