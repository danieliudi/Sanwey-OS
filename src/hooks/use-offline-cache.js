import { openDB } from "idb";

const DB_NAME = "sanwey-offline";
const DB_VERSION = 1;
const LEADS_STORE = "leadsCache";
const QUEUE_STORE = "pendingActivities";

let dbPromise = null;
function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(LEADS_STORE)) {
          db.createObjectStore(LEADS_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

// Grava tudo de uma vez, substituindo o conteúdo anterior — não é um cache
// incremental, é sempre o snapshot mais recente do que fetchAll() já trouxe
// (a RLS já decidiu o escopo; nunca filtramos de novo aqui).
export async function saveLeadsSnapshot(leads) {
  const db = await getDB();
  const tx = db.transaction(LEADS_STORE, "readwrite");
  await tx.store.clear();
  const cachedAt = new Date().toISOString();
  for (const lead of leads || []) {
    await tx.store.put({ ...lead, cachedAt });
  }
  await tx.done;
}

export async function readLeadsSnapshot() {
  const db = await getDB();
  const rows = await db.getAll(LEADS_STORE);
  if (!rows.length) return { leads: [], cachedAt: null };
  const cachedAt = rows.reduce((latest, r) => (!latest || r.cachedAt > latest ? r.cachedAt : latest), null);
  const leads = rows.map(({ cachedAt: _cachedAt, ...lead }) => lead);
  return { leads, cachedAt };
}

// `userId` carimba o dono do item — sem isso, a fila é global do
// navegador: usuário B logando no mesmo device depois de A sair sem
// sincronizar herdava (e sincronizava, com o JWT de B) as notas de A
// (achado de segurança M5, mistura de conteúdo/autoria entre usuários).
export async function enqueueActivity({ id, leadId, activity, userId }) {
  const db = await getDB();
  await db.put(QUEUE_STORE, {
    id,
    leadId,
    activity,
    userId: userId || null,
    status: "pending",
    error: null,
    createdAt: new Date().toISOString(),
  });
}

// Filtro estrito por igualdade — sem userId (auth ainda não resolveu) não
// retorna nada, fail-safe. Itens legados sem `userId` (gravados antes desta
// migração) nunca batem `=== userId` de ninguém real — ficam órfãos até o
// próximo clearAll(), nunca sincronizam pra conta errada.
export async function listPending(userId) {
  const db = await getDB();
  const rows = await db.getAll(QUEUE_STORE);
  return rows
    .filter(r => r.userId === userId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export async function updateStatus(id, status, error = null) {
  const db = await getDB();
  const item = await db.get(QUEUE_STORE, id);
  if (!item) return;
  await db.put(QUEUE_STORE, { ...item, status, error });
}

export async function removeFromQueue(id) {
  const db = await getDB();
  await db.delete(QUEUE_STORE, id);
}

export async function clearAll() {
  const db = await getDB();
  await Promise.all([db.clear(LEADS_STORE), db.clear(QUEUE_STORE)]);
}
