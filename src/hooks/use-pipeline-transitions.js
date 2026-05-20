import { useCallback } from "react";
import { usePersistentState } from "./use-persistent-state";
import { STORAGE_KEYS } from "../constants/storage-keys";

/**
 * Manages allowed stage transition rules per company.
 *
 * Shape stored in localStorage:
 *   { [companyId]: { [fromStageId]: string[] } }
 *
 * When a companyId is absent → all transitions are allowed (open mode).
 * When fromStageId maps to an array → only listed stages are allowed destinations.
 * Empty array means the stage is locked (no manual moves out of it).
 *
 * isTransitionAllowed(companyId, fromStageId, toStageId):
 *   Returns true if the move is allowed (or if no rules are configured).
 */
export function usePipelineTransitions() {
  const [rules, setRules] = usePersistentState(STORAGE_KEYS.pipelineTransitions, {});

  /** Returns true when the transition is permitted. */
  const isTransitionAllowed = useCallback((companyId, fromStageId, toStageId) => {
    if (!companyId || fromStageId === toStageId) return false;
    const companyRules = rules[companyId];
    if (!companyRules) return true;          // no rules → all allowed
    const allowed = companyRules[fromStageId];
    if (!Array.isArray(allowed)) return true; // stage not configured → allowed
    return allowed.includes(toStageId);
  }, [rules]);

  /**
   * Toggles a single transition on/off.
   * If the company has no rules yet, we first build a fully-open ruleset
   * (all→all), then flip the requested transition.
   */
  const toggleTransition = useCallback((companyId, stages, fromStageId, toStageId) => {
    setRules(prev => {
      const companyRules = prev[companyId] ?? buildOpenRules(stages);
      const current = companyRules[fromStageId] ?? stages.map(s => s.id).filter(id => id !== fromStageId);
      const next = current.includes(toStageId)
        ? current.filter(id => id !== toStageId)
        : [...current, toStageId];
      return {
        ...prev,
        [companyId]: { ...companyRules, [fromStageId]: next },
      };
    });
  }, [setRules]);

  /** Resets all transition rules for a company (back to fully open). */
  const resetCompany = useCallback((companyId) => {
    setRules(prev => {
      const next = { ...prev };
      delete next[companyId];
      return next;
    });
  }, [setRules]);

  /**
   * Define em bloco quais destinos são permitidos a partir de uma etapa.
   * Usado pelos bulk actions ("Só avançar", "Bloquear todos", "Permitir
   * todos"). Aceita lista vazia (bloqueia tudo) sem regredir pro modo
   * aberto — preserva a intenção explícita do usuário.
   */
  const setRowAllowed = useCallback((companyId, stages, fromStageId, allowedIds) => {
    setRules(prev => {
      const companyRules = prev[companyId] ?? buildOpenRules(stages);
      return {
        ...prev,
        [companyId]: { ...companyRules, [fromStageId]: [...allowedIds] },
      };
    });
  }, [setRules]);

  /** Returns the allowed destinations for a given stage (or all if unconfigured). */
  const getAllowedDestinations = useCallback((companyId, fromStageId, allStageIds) => {
    const companyRules = rules[companyId];
    if (!companyRules) return allStageIds;
    const allowed = companyRules[fromStageId];
    if (!Array.isArray(allowed)) return allStageIds;
    return allowed;
  }, [rules]);

  return { rules, isTransitionAllowed, toggleTransition, resetCompany, setRowAllowed, getAllowedDestinations };
}

/** Builds a rule object where every stage can go to every other stage. */
function buildOpenRules(stages) {
  const result = {};
  for (const stage of stages) {
    result[stage.id] = stages.map(s => s.id).filter(id => id !== stage.id);
  }
  return result;
}

export default usePipelineTransitions;
