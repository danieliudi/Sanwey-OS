import { useEffect, useMemo } from "react";
import { usePersistentState } from "./use-persistent-state";
import { STORAGE_KEYS } from "../constants/storage-keys";
import { CHANGELOG } from "../data/changelog";

// Toast "novidades" (spec: specautoupdatechangelogtoast.md, parte 2).
// changelogSeenMap[user.id] guarda a última versão que ESSE usuário já viu —
// mesmo padrão de src/App.jsx (onboardingDoneMap), localStorage por usuário
// em vez de coluna no banco (não sincroniza entre dispositivos de propósito
// — schema novo exigiria confirmação explícita, não se justifica aqui).
//
// Filtro por cargo (30/07/2026, pedido do Daniel: "não mostrar tudo pra
// todos, só o que tem a ver com os cargos da pessoa"): item de changelog sem
// `roles` é global (todo mundo vê — é o padrão pra não perder cobertura por
// esquecimento de tag). Item COM `roles` só aparece pra quem tem pelo menos
// um desses cargos em `currentUserRoles` — exceto admin/diretoria, que
// sempre veem tudo (mesmo bypass usado em toda checagem de módulo/RLS da
// plataforma, não é regra nova). Isso filtra só o TOAST — a aba "Novidades"
// (TutoriaisView) continua mostrando o histórico completo pra quem quiser
// ver o que mudou em outras áreas.
//
// Filtro por impacto no toast (04/09/2026, pedido do Daniel: toast virava
// muro de texto em patch visual/layout): por default só `kind: "novo"`
// interrompe. `correcao`/`ajuste` ficam na aba Novidades. Override opcional
// `toast: true|false` no item — ver cabeçalho de changelog.js. Histórico
// antigo sem o campo herda o default por kind (não precisa reescrever).
function shouldShowInToast(item) {
  if (item.toast === true) return true;
  if (item.toast === false) return false;
  return item.kind === "novo";
}

export function useChangelogNotice(currentUser, currentUserRoles, { skip = false } = {}) {
  const [changelogSeenMap, setChangelogSeenMap] = usePersistentState(STORAGE_KEYS.changelogSeen, {});
  const userId = currentUser?.id;
  const lastSeen = userId ? changelogSeenMap[userId] : undefined;
  const sees = (roles) => currentUserRoles?.includes("admin") || currentUserRoles?.includes("diretoria")
    || !roles || roles.some(r => currentUserRoles?.includes(r));

  // Usuário nunca visto por essa feature (inclui todo usuário já existente
  // na primeira vez que ela for ao ar) — grava a versão atual em silêncio,
  // sem mostrar toast nessa sessão. Evita despejar o histórico inteiro em
  // quem já usa a plataforma há tempos.
  useEffect(() => {
    if (skip || !userId || lastSeen !== undefined) return;
    setChangelogSeenMap(m => ({ ...m, [userId]: __APP_VERSION__ }));
  }, [skip, userId, lastSeen, setChangelogSeenMap]);

  const items = useMemo(() => {
    if (skip || !userId || lastSeen === undefined || lastSeen === __APP_VERSION__) return [];
    const lastSeenIdx = CHANGELOG.findIndex(c => c.version === lastSeen);
    // Versão vista não é (mais) reconhecida no changelog atual (ex.: entrada
    // removida) — mais seguro não mostrar nada do que despejar o histórico
    // inteiro por engano.
    if (lastSeenIdx === -1) return [];
    // Array vem mais novo primeiro — tudo ANTES do índice da última vista é
    // mais novo que ela (exclusive) até a versão atual no topo (inclusive).
    return CHANGELOG.slice(0, lastSeenIdx)
      .flatMap(c => c.items)
      .filter(item => sees(item.roles) && shouldShowInToast(item));
  }, [skip, userId, lastSeen, currentUserRoles]);

  const dismiss = () => {
    if (!userId) return;
    setChangelogSeenMap(m => ({ ...m, [userId]: __APP_VERSION__ }));
  };

  return { items, dismiss };
}

export default useChangelogNotice;
