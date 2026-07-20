// Calcula se um registro tem comentário novo (de outra pessoa) desde a
// última vez que o usuário atual abriu o drawer — usado pro badge de
// "não lido" nos cards do kanban. Cada domínio guarda comentários em
// formatos ligeiramente diferentes (notes vs activities, authorId vs
// userId vs createdBy), então cada helper sabe ler o seu.

function newestOtherCommentAt(entries, { getType, getAuthor, getCreatedAt, getDeleted }, currentUserId) {
  let newest = null;
  for (const entry of entries) {
    if (getType && !getType(entry)) continue;
    if (getDeleted?.(entry)) continue;
    const author = getAuthor(entry);
    if (currentUserId && author === currentUserId) continue;
    const createdAt = getCreatedAt(entry);
    if (!createdAt) continue;
    if (!newest || new Date(createdAt) > new Date(newest)) newest = createdAt;
  }
  return newest;
}

function isUnread(newest, viewedAtIso) {
  if (!newest) return false;
  if (!viewedAtIso) return true;
  return new Date(newest) > new Date(viewedAtIso);
}

// RH (rh_ferias, rh_feedback, rh_treinamentos, rh_onboarding, rh_vagas,
// rh_candidatos) — comentários vivem em `activities` (type comment/note).
export function hasUnreadRHComment(record, viewedAt, currentUserId) {
  const newest = newestOtherCommentAt(record?.activities || [], {
    getType: a => a.type === "comment" || a.type === "note",
    getAuthor: a => a.createdBy,
    getCreatedAt: a => a.createdAt,
    getDeleted: a => a.deletedAt,
  }, currentUserId);
  return isUnread(newest, viewedAt?.[record?.id]);
}

// Lead — mescla lead.notes (legado, userId) + lead.activities (type
// comment/note, userId).
export function hasUnreadLeadComment(lead, viewedAt, currentUserId) {
  const notes = lead?.notes || [];
  const activities = lead?.activities || [];
  const fromNotes = newestOtherCommentAt(notes, {
    getAuthor: n => n.userId,
    getCreatedAt: n => n.createdAt,
    getDeleted: n => n.deletedAt,
  }, currentUserId);
  const fromActivities = newestOtherCommentAt(activities, {
    getType: a => a.type === "comment" || a.type === "note",
    getAuthor: a => a.userId,
    getCreatedAt: a => a.timestamp || a.createdAt,
    getDeleted: a => a.deletedAt,
  }, currentUserId);
  const newest = [fromNotes, fromActivities].filter(Boolean).sort().pop() || null;
  return isUnread(newest, viewedAt?.[lead?.id]);
}

// Campaign / Deliverable / Purchase Request — comentários vivem em
// `notes` (authorId, real id).
export function hasUnreadNotesComment(record, viewedAt, currentUserId) {
  const newest = newestOtherCommentAt(record?.notes || [], {
    getAuthor: n => n.authorId,
    getCreatedAt: n => n.createdAt,
    getDeleted: n => n.deletedAt,
  }, currentUserId);
  return isUnread(newest, viewedAt?.[record?.id]);
}
