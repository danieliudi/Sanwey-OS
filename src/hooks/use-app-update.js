import { useCallback, useRef, useState } from "react";
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
  const [dismissed, setDismissed] = useState(false);
  // Guarda o id do interval de checagem de update pra nunca empilhar mais de
  // um (StrictMode dobra a invocação de onRegisteredSW em dev, e o hook
  // poderia em tese ser montado mais de uma vez) — sem isso cada invocação
  // extra criava um poll de 10min novo que nunca era limpo.
  const updateIntervalIdRef = useRef(null);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // Reset do dismiss a cada novo SW em waiting (inclusive no 2º deploy da
    // mesma sessão) — needRefresh do useRegisterSW fica true de vez após a
    // primeira detecção, então observar a transição via useEffect não pega
    // deploys seguintes; só este callback dispara em todos (achado do QA).
    onNeedRefresh() { setDismissed(false); },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Checa por update a cada 10min — pega deploy mesmo com a aba aberta
      // o dia todo, sem depender do usuário navegar/recarregar. Default
      // ajustável, não é uma decisão fechada da spec.
      if (updateIntervalIdRef.current != null) {
        clearInterval(updateIntervalIdRef.current);
      }
      updateIntervalIdRef.current = setInterval(() => { registration.update(); }, 10 * 60 * 1000);
    },
  });

  // updateServiceWorker(true) só manda o SKIP_WAITING e TORCE pro evento
  // "controllerchange" disparar o reload (é assim que virtual:pwa-register
  // funciona por baixo — o `true` passado aqui nem é lido pela lib, ver
  // node_modules/vite-plugin-pwa/dist/client/build/register.js). Isso falha
  // silenciosamente sempre que o SW novo já assumiu a aba sozinho antes do
  // clique (aba em segundo plano suspensa e retomada, ou o próprio Safari,
  // que é notoriamente instável nesse ciclo de vida) — nesses casos
  // registration.waiting já é null, a mensagem não tem o que fazer, e o
  // botão parece "não funcionar". O fallback força o reload de qualquer
  // jeito pouco depois do clique; se o reload por controllerchange já
  // rolou, a página já navegou e este timeout nunca chega a disparar.
  const updateNow = useCallback(() => {
    updateServiceWorker(true);
    setTimeout(() => window.location.reload(), 3000);
  }, [updateServiceWorker]);
  const dismiss = useCallback(() => { setDismissed(true); }, []);

  return {
    needRefresh: needRefresh && !dismissed,
    updateNow,
    dismiss,
  };
}

export default useAppUpdate;
