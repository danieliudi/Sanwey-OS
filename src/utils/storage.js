const hasWindow = typeof window !== "undefined";

export function loadJSON(key, fallback) {
  if (!hasWindow) return fallback;
  try {
    const raw = window.localStorage?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  if (!hasWindow) return;
  try {
    window.localStorage?.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Quota exceeded or private-browsing — silently ignore. App keeps
    // working from in-memory state.
    if (typeof console !== "undefined") {
      console.warn(`[storage] failed to save "${key}":`, e?.message);
    }
  }
}
