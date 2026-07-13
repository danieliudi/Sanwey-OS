import { useEffect, useRef } from "react";

// Fecha modais/drawers ao apertar ESC. Usa uma pilha LIFO em nível de módulo:
// quando há vários overlays abertos, só o do TOPO reage ao ESC (e chama
// stopPropagation na fase de captura, o que também impede que listeners de
// ESC mais antigos — inclusive os `window.addEventListener` que já existem em
// vários drawers — fechem o pai por baixo). Assim ESC fecha um overlay por vez.
//
// Uso: useEscToClose(onClose)            — ativo enquanto o componente existe
//      useEscToClose(onClose, isOpen)    — para modais que ficam montados

const stack = [];
let attached = false;

function globalHandler(e) {
  if (e.key !== "Escape" && e.keyCode !== 27) return;
  const top = stack[stack.length - 1];
  if (!top) return;
  e.stopPropagation();
  top();
}

function ensureAttached() {
  if (attached || typeof document === "undefined") return;
  // Fase de captura: roda antes dos listeners de bubble em window/document.
  document.addEventListener("keydown", globalHandler, true);
  attached = true;
}

export function useEscToClose(onClose, active = true) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return undefined;
    ensureAttached();
    const entry = () => onCloseRef.current?.();
    stack.push(entry);
    return () => {
      const i = stack.lastIndexOf(entry);
      if (i !== -1) stack.splice(i, 1);
    };
  }, [active]);
}

export default useEscToClose;
