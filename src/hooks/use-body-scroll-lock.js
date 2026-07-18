import { useEffect } from "react";

// Trava o scroll do body enquanto `open` for true — sem isso, um modal ou
// drawer aberto ainda deixava o conteúdo por trás rolar com toque/scroll,
// especialmente perceptível em mobile, onde o padrão esperado de um "sheet"
// é a tela de fundo congelada. Antes só o Sidebar mobile (App.jsx) fazia
// isso. Achado da auditoria de fricção de 18/07.
export function useBodyScrollLock(open) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);
}
