import { useCallback } from "react";
import { usePersistentState } from "./use-persistent-state";
import { STORAGE_KEYS } from "../constants/storage-keys";
import { DEFAULT_FORM_CONFIG } from "../constants/lead-form-fields";

export function useLeadFormConfig() {
  const [config, setConfig] = usePersistentState(
    STORAGE_KEYS.leadFormConfig,
    DEFAULT_FORM_CONFIG,
  );

  const updateConfig = useCallback((fields) => {
    setConfig(fields);
  }, [setConfig]);

  const effectiveConfig = Array.isArray(config) && config.length > 0
    ? config
    : DEFAULT_FORM_CONFIG;

  return { formConfig: effectiveConfig, updateFormConfig: updateConfig };
}
