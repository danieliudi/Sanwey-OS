import { useMemo } from "react";

// P5: pre-index users by id so `.map(...).find(u => u.id === lead.owner)`
// loops become O(1) lookups. Callers should wrap in useMemo where users
// might change (UserManagementView) — this hook does the indexing once
// per users array identity.
export function useUsersById(users) {
  return useMemo(() => {
    const map = new Map();
    for (const u of users) map.set(u.id, u);
    return map;
  }, [users]);
}
