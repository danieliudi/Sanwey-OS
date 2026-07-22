import { useEffect, useRef, useState } from "react";

// Mede, ao vivo, o espaço vertical restante da viewport a partir do topo do
// elemento referenciado (ref) até o rodapé da janela — usado pra limitar a
// altura da área de colunas do Kanban, sem depender de um `calc(100vh - Npx)`
// hardcoded (cada board de RH tinha um número mágico diferente — 220px,
// 260px, 320px — que só funcionava pro tanto de conteúdo acima do board que
// existia quando o número foi escolhido; em janelas menores, ou quando
// filtros quebram linha, o cálculo errava e a barra de scroll horizontal do
// board acabava abaixo da dobra, exigindo rolar a página inteira pra
// alcançá-la — o pedido do usuário era que ela nunca saísse da tela visível,
// como no Pipefy). Recalcula em resize e sempre que `deps` mudar (ex.:
// `loading` terminando, o que muda a altura do conteúdo acima do board).
//
// `trailingRef` (opcional) aponta pro wrapper de qualquer conteúdo que vem
// DEPOIS do board no mesmo fluxo (texto de dica, painel de analytics — ver
// CRMView/MarketingView/EntregasView) — sua ALTURA entra na conta pra sobrar
// espaço suficiente pra ele também caber. Importante: usar a altura de um
// elemento (intrínseca) e não a POSIÇÃO de um elemento downstream (ex.: o
// <footer> global, tentado antes) — a posição de algo depois do board
// depende da altura do próprio board, então usá-la criava um cálculo
// circular que só piorava a cada resize em vez de convergir.
export function useAvailableHeight(marginBottom = 16, deps = [], trailingRef = null) {
  const ref = useRef(null);
  const [height, setHeight] = useState(480);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const top = el.getBoundingClientRect().top;
      const trailingHeight = trailingRef?.current ? trailingRef.current.getBoundingClientRect().height : 0;
      setHeight(Math.max(280, Math.round(window.innerHeight - top - trailingHeight - marginBottom)));
    };
    update();
    window.addEventListener("resize", update);
    // ResizeObserver no body (não só no próprio elemento) — o topo do
    // elemento se move quando QUALQUER coisa acima dele na página muda de
    // altura (filtros quebrando linha, banner de erro aparecendo, etc.),
    // não só quando o elemento em si muda de tamanho.
    const ro = new ResizeObserver(update);
    ro.observe(document.body);
    return () => {
      window.removeEventListener("resize", update);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marginBottom, ...deps]);

  return [ref, height];
}
