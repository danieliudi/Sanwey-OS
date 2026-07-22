import { useCallback, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

// Toast "nova versão disponível" (spec: specautoupdatechangelogtoast.md,
// parte 1) — sem isso, quem já está com a aba aberta só vê o deploy novo
// depois de um hard refresh manual. registerType:"prompt" (vite.config.js)
// faz o registro expor needRefresh em vez de trocar o SW em silêncio.
//
// dismiss() esconde o toast até a PRÓXIMA versão detectada, não pra sempre —
// senão o usuário fecha uma vez e nunca mais vê aviso nenhum, mesmo pra
// deploys futuros.
export function useAppUpdate() {
  const [dismissedAt, setDismissedAt] = useState(0);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Checa por update a cada 10min — pega deploy mesmo com a aba aberta
      // o dia todo, sem depender do usuário navegar/recarregar. Default
      // ajustável, não é uma decisão fechada da spec.
      setInterval(() => { registration.update(); }, 10 * 60 * 1000);
    },
  });

  const updateNow = useCallback(() => { updateServiceWorker(true); }, [updateServiceWorker]);
  const dismiss = useCallback(() => { setDismissedAt(Date.now()); }, []);

  return {
    needRefresh: needRefresh && dismissedAt === 0,
    updateNow,
    dismiss,
  };
}

export default useAppUpdate;
