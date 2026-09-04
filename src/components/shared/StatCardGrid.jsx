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
// Acima de md o layout é o de hoje: quem chama passa as colunas de desktop em
// `desktopClassName` e o card volta ao tamanho cheio sozinho, por CSS. O corte
// tem que ser o MESMO breakpoint que o `dense` do StatCard usa — se as duas
// metades discordarem, existe uma faixa de largura em que a grade já está no
// layout de desktop mas os cards ainda estão densos (e escondidos).
//
// Cada item do grid leva `h-full` e o StatCard denso também: sem isso o card
// fica com height:auto dentro do wrapper e cards com sublabel ficam mais altos
// que os sem, quebrando o alinhamento das bordas de baixo no desktop.
export function StatCardGrid({
  children,
  desktopClassName = "md:grid-cols-4",
  maxMobile = 4,
  className = "",
  stagger = false,
}) {
  const [expanded, setExpanded] = useState(false);
  // toArray já descarta null/false — as views montam os cards atrás de
  // `widgetVisible(...)`, então a contagem tem que ser a dos visíveis.
  const items = React.Children.toArray(children);
  const overflow = Math.max(0, items.length - maxMobile);

  return (
    <div className={className}>
      <div className={`grid grid-cols-2 gap-2 md:gap-3 ${desktopClassName}${stagger ? " polish-stagger" : ""}`}>
        {items.map((child, i) => (
          <div
            key={child.key ?? i}
            className={!expanded && i >= maxMobile ? "hidden md:block h-full" : "h-full"}
          >
            {/* Só injeta `dense` em componente React. Se o filho for uma tag
                DOM (alguém embrulhando o card num <div> pra segurar um
                title/ref), passar `dense` viraria atributo inválido no HTML e
                warning do React — aconteceu de verdade no Painel Executivo. */}
            {React.isValidElement(child) && typeof child.type !== "string"
              ? React.cloneElement(child, { dense: true })
              : child}
          </div>
        ))}
      </div>

      {overflow > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          className="md:hidden w-full mt-2 py-2 rounded-lg border border-dashed flex items-center justify-center gap-1.5"
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
