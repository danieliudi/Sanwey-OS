import { useEffect, useMemo } from "react";
import { usePersistentState } from "./use-persistent-state";
import { STORAGE_KEYS } from "../constants/storage-keys";
import { CHANGELOG } from "../data/changelog";

// Toast "novidades" (spec: specautoupdatechangelogtoast.md, parte 2).
// changelogSeenMap[user.id] guarda a última versão que ESSE usuário já viu —
// mesmo padrão de src/App.jsx (onboardingDoneMap), localStorage por usuário
// em vez de coluna no banco (não sincroniza entre dispositivos de propósito
// — schema novo exigiria confirmação explícita, não se justifica aqui).
export function useChangelogNotice(currentUser, { skip = false } = {}) {
  const [changelogSeenMap, setChangelogSeenMap] = usePersistentState(STORAGE_KEYS.changelogSeen, {});
  const userId = currentUser?.id;
  const lastSeen = userId ? changelogSeenMap[userId] : undefined;

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
    return CHANGELOG.slice(0, lastSeenIdx).flatMap(c => c.items);
  }, [skip, userId, lastSeen]);

  const dismiss = () => {
    if (!userId) return;
    setChangelogSeenMap(m => ({ ...m, [userId]: __APP_VERSION__ }));
  };

  return { items, dismiss };
}

export default useChangelogNotice;
