import { useEffect, useMemo, useState } from "react";
import { usePersistentState } from "./use-persistent-state";
import { STORAGE_KEYS } from "../constants/storage-keys";
import { VIDEO_TUTORIALS, papeisDoUsuario } from "../data/tutorials";

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
// ── CORREÇÃO DE 15/09/2026: a dica voltava a cada atualização ─────────────
//
// O Daniel relatou que "toda vez que atualizo a plataforma, esse guia volta a
// aparecer, mesmo eu não sendo usuário novo". Não era a chave de
// armazenamento (`V` é fixa em "v4"; deploy não apaga nada). Eram duas coisas
// somadas, as duas medidas antes de mexer:
//
//   1. Em 14/09/2026 (v5.13.0), 114 telas ganharam `quickStart.resumo` DE UMA
//      VEZ — o campo saiu de 0 para 114 num único commit. Antes disso nenhuma
//      dica montava painel. Pra quem já usava a plataforma, isso não é "uma
//      dica": é uma interrupção por tela, em toda tela que ele abrir daí em
//      diante. E repete a cada lote de guias migrados, ou seja, a cada
//      atualização.
//   2. `dismiss()` só roda no "X" e no "Ver guia completo". Sair da tela pelo
//      menu NÃO marca como vista — então a mesma dica voltava na visita
//      seguinte, indefinidamente.
//
// A decisão anterior (registrada logo abaixo e agora revista) era não ter
// linha de base em silêncio, ao contrário do useChangelogNotice. O raciocínio
// estava certo pro caso que ele mirava — a 1ª tela de um usuário NOVO é o
// momento mais valioso da feature — e errado pro caso que ele não previu: 114
// guias chegando de uma vez pra quem já sabe usar a plataforma.
//
// Agora, a pedido do Daniel (15/09/2026): **dica automática é para usuário
// novo**. Quem já usava continua tendo o guia inteiro, a um clique, pelo "?"
// da barra superior — que já existe desde a v5.13.0 e já ganhou spotlight
// próprio. Cada mecanismo com um trabalho só: dica de tela ensina quem está
// chegando, spotlight avisa a novidade a quem já está, changelog conta o que
// mudou, tour desenha o mapa, Tutoriais é a referência.
//
// A escolha é GRAVADA por usuário, não recalculada: `showOnboarding` vira
// false no instante em que a pessoa fecha o modal de boas-vindas, então
// recalcular desligaria a dica do usuário novo no primeiro clique dele.
export function useScreenTips(currentUser, screenKey, { skip = false, usuarioNovo = false } = {}) {
  const [screenTipsSeenMap, setScreenTipsSeenMap] = usePersistentState(STORAGE_KEYS.screenTipsSeen, {});
  const [autoMap, setAutoMap] = usePersistentState(STORAGE_KEYS.screenTipsAuto, {});
  // Reabertura manual pelo "?" da barra superior. Vive em estado, não no
  // localStorage: pedir a dica de novo não desfaz o "já vi" — sair da tela e
  // voltar não traz o painel de volta sozinho. Antes de 14/09/2026 não existia
  // caminho nenhum de volta: fechou uma vez, acabou pra sempre naquele
  // navegador, sem nem um lugar pra pedir de novo.
  const [forcado, setForcado] = useState(null);
  const userId = currentUser?.id;
  const seenForUser = (userId && screenTipsSeenMap[userId]) || {};

  // Gravado na PRIMEIRA vez que este código vê o usuário, e nunca reescrito.
  // `usuarioNovo` é o mesmo `showOnboarding` do App.jsx — true só enquanto a
  // pessoa ainda não fechou o modal de boas-vindas.
  useEffect(() => {
    if (!userId) return;
    setAutoMap(m => (userId in m ? m : { ...m, [userId]: usuarioNovo }));
  }, [userId, usuarioNovo, setAutoMap]);
  // `undefined` (ainda não gravou) conta como NÃO automático: numa plataforma
  // que já está em uso, o caso comum é o usuário existente, e errar pro lado
  // de não interromper é o lado certo — o "?" continua ali.
  const recebeDicaAutomatica = Boolean(userId && autoMap[userId]);

  // Cargo principal primeiro, secundários depois, sem repetir. A ordem vive em
  // `papeisDoUsuario` (data/tutorials.js) e é a MESMA que a tela de Ajuda usa —
  // as duas divergiam, e a varredura visual de 14/09/2026 pegou o efeito.
  const papeis = useMemo(() => papeisDoUsuario(currentUser), [currentUser?.role, currentUser?.roles]);

  // O guia da tela atual, independente de já ter sido visto — é o que
  // alimenta tanto o painel quanto o botão "?" (que só aparece quando há o
  // que reabrir).
  const guia = useMemo(() => {
    if (!screenKey) return null;
    for (const papel of papeis) {
      // Várias rotas têm MAIS DE UM guia (o Funil tem 7, Viagens tem 6) —
      // vence o primeiro do array, que por convenção é o introdutório, e é o
      // certo pra quem está chegando. A exceção é marcada no próprio guia com
      // `semDicaDeChegada`: guia que descreve uma FUNCIONALIDADE presente em
      // várias telas (e não a tela da sua `route`) não disputa o painel.
      // Hoje só `v-desc1` está marcado — sem isso ele ganhava de `v-set1` por
      // estar antes no array, e Configurações abria falando do lápis de
      // descrição de página, que nem fica nessa tela.
      const achado = (VIDEO_TUTORIALS[papel] || [])
        .find(v => v.route === screenKey && !v.semDicaDeChegada && v.quickStart?.resumo);
      if (achado) return achado;
    }
    return null;
  }, [screenKey, papeis]);

  // Guia sem `resumo` não monta painel nenhum — em vez de cair no formato
  // antigo de texto corrido. É o que torna a migração dos 93 guias gradual:
  // quem ainda não tem as duas frases simplesmente não interrompe ninguém.
  const tip = useMemo(() => {
    if (!guia) return null;
    // O "?" ignora tudo: é o pedido explícito da pessoa, e é o caminho de
    // volta pra quem não recebe a dica sozinho.
    if (forcado === screenKey) return { ...guia.quickStart, steps: guia.quickStart.steps };
    if (skip || !userId || seenForUser[screenKey]) return null;
    if (!recebeDicaAutomatica) return null;
    return guia.quickStart;
  }, [guia, forcado, screenKey, skip, userId, seenForUser, recebeDicaAutomatica]);

  const dismiss = () => {
    setForcado(null);
    if (!userId || !screenKey) return;
    setScreenTipsSeenMap(m => ({ ...m, [userId]: { ...(m[userId] || {}), [screenKey]: true } }));
  };

  const reabrir = () => setForcado(screenKey);

  return { tip, guia, dismiss, reabrir, temGuia: !!guia };
}

export default useScreenTips;
