import { AppState, EMPTY_APP_STATE, normalizeAppState } from "./recovery";

export const STORAGE_KEY = "clear-recovery-state-v1";

export function loadAppState(): AppState {
  if (typeof window === "undefined") return EMPTY_APP_STATE;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_APP_STATE;
    return normalizeAppState(JSON.parse(raw));
  } catch {
    return EMPTY_APP_STATE;
  }
}

export function clearAppState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage restrictions after an explicit reset.
  }
}
