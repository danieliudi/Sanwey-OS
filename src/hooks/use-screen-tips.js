import { useMemo } from "react";
import { usePersistentState } from "./use-persistent-state";
import { STORAGE_KEYS } from "../constants/storage-keys";
import { VIDEO_TUTORIALS } from "../data/tutorials";

// Dica contextual (quickStart) mostrada quando o usuário chega numa tela pela
// 1ª vez — reaproveita o mesmo conteúdo de VIDEO_TUTORIALS que também aparece
// na tela "Ajuda & Tutoriais".
//
// ── CORREÇÃO DE 14/09/2026: a dica mostrava a tela ERRADA ──────────────────
//
// O Daniel abriu a Visão Geral de RH e recebeu um painel intitulado
// "Visão Geral · RH" cujo corpo descrevia a Visão Geral do COMERCIAL — leads,
// Funil de Vendas, Fit score, "Distribuição por etapa do funil". Nada daquilo
// existe na tela de RH.
//
// A causa não era o texto: era a CHAVE de busca. O `App.jsx` mantinha um mapa
// `section -> rótulo humano` e este hook procurava por
// `videos.find(v => v.description === screenKey)`. Três seções distintas usam
// o mesmo rótulo "Visão Geral" (Comercial, Marketing e RH), então o `find`
// devolvia o PRIMEIRO do array do cargo — o guia do Comercial, para
// admin/gerente. O título vem de outro caminho (`sectionTitle`) e nunca era
// comparado com o corpo, por isso o erro era silencioso.
//
// Medido antes de mexer, nas 154 combinações seção × cargo:
//   antes  → 27 certas ·  12 ERRADAS · 115 sem dica
//   depois → 31 certas ·   0 ERRADAS · 123 sem dica
//
// Agora a busca é por `route`, que já existia em toda entrada de
// VIDEO_TUTORIALS e é o MESMO id de `section` do App.jsx — identificador, não
// rótulo. Rótulo humano é escolha de redação e muda; foi por isso que quebrou.
// Ganham dica de volta o Funil de Vendas (a chave era "Negócios", que não
// casava com nada) e as duas Visões Gerais que mostravam a do vizinho.
//
// ── Cargo: roles[] e não o escalar ────────────────────────────────────────
// Antes lia só `currentUser.role`. Quem tem o cargo como SECUNDÁRIO caía no
// array errado (ou no fallback `vendedor`) e via a dica de outra pessoa —
// mesma classe do MD-11 do CLAUDE.md, aqui em conteúdo em vez de permissão.
// A ordem é `role` escalar primeiro e depois `roles[]`: o cargo principal tem
// precedência, e o secundário só entra quando o principal não tem guia
// daquela tela. Nunca devolve menos do que antes.
//
// screenTipsSeenMap[user.id] = { [section]: true, ... } em localStorage,
// mesmo espírito do onboardingDoneMap (App.jsx) e do changelogSeenMap
// (use-changelog-notice.js) — sem coluna no banco, não sincroniza entre
// dispositivos de propósito. A chave de "visto" passou a ser o id da seção
// junto com a busca: quando era o rótulo, fechar a dica numa das três
// "Visão Geral" marcava as TRÊS como vistas de uma vez, e as outras duas
// nunca mais apareciam para aquele usuário.
//
// Difere de propósito do useChangelogNotice num ponto: NÃO existe "marcar a
// 1ª tela como vista em silêncio, sem mostrar". Pro changelog isso faz
// sentido (usuário novo não precisa de retrospectiva). Aqui o objetivo é o
// oposto — a dica da 1ª tela que um usuário novo abre é a mais valiosa de
// todas, é exatamente o momento que essa feature existe pra cobrir.
export function useScreenTips(currentUser, screenKey, { skip = false } = {}) {
  const [screenTipsSeenMap, setScreenTipsSeenMap] = usePersistentState(STORAGE_KEYS.screenTipsSeen, {});
  const userId = currentUser?.id;
  const seenForUser = (userId && screenTipsSeenMap[userId]) || {};

  // Cargo principal primeiro, secundários depois, sem repetir. `vendedor` é o
  // fim de linha porque é o único array que cobre o tronco comum da
  // plataforma — é o mesmo fallback que TutoriaisView usa.
  const papeis = useMemo(() => {
    const lista = [currentUser?.role, ...(currentUser?.roles || []), "vendedor"];
    return [...new Set(lista.filter(Boolean))];
  }, [currentUser?.role, currentUser?.roles]);

  const tip = useMemo(() => {
    if (skip || !userId || !screenKey || seenForUser[screenKey]) return null;
    for (const papel of papeis) {
      const achado = (VIDEO_TUTORIALS[papel] || []).find(v => v.route === screenKey);
      if (achado?.quickStart) return achado.quickStart;
    }
    return null;
  }, [skip, userId, screenKey, seenForUser, papeis]);

  const dismiss = () => {
    if (!userId || !screenKey) return;
    setScreenTipsSeenMap(m => ({ ...m, [userId]: { ...(m[userId] || {}), [screenKey]: true } }));
  };

  return { tip, dismiss };
}

export default useScreenTips;
