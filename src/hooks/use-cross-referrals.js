import { useCallback, useMemo } from "react";
import { buildCrossReferrals } from "../data/cross-referrals";
import { STORAGE_KEYS } from "../constants/storage-keys";
import { usePersistentState } from "./use-persistent-state";

// Fix B6: cross-referrals are now derived from the live `leads` state via
// useMemo, so stage / owner changes reflect immediately. Only user overrides
// (approved / rejected / notes) are persisted.
export function useCrossReferrals(leads) {
  const [overrides, setOverrides] = usePersistentState(
    STORAGE_KEYS.crossReferralOverrides,
    {},
  );

  const crossReferrals = useMemo(
    () => buildCrossReferrals(leads, overrides),
    [leads, overrides],
  );

  const approve = useCallback((id) => {
    setOverrides(prev => ({
      ...prev,
      [id]: { status: "approved", approvedAt: new Date().toISOString() },
    }));
  }, [setOverrides]);

  const reject = useCallback((id) => {
    setOverrides(prev => ({
      ...prev,
      [id]: { status: "rejected", rejectedAt: new Date().toISOString() },
    }));
  }, [setOverrides]);

  return { crossReferrals, approve, reject };
}
