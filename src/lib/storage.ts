import type { AppState, Season } from "./types";

const STORAGE_KEY = "gs11-finance-v1";

export const defaultAppState = (): AppState => ({
  version: 1,
  seasons: [],
  currentSeasonId: null,
});

export function loadState(): AppState {
  if (typeof window === "undefined") return defaultAppState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultAppState();
    const parsed = JSON.parse(raw) as AppState;
    if (parsed?.version !== 1 || !Array.isArray(parsed.seasons)) {
      return defaultAppState();
    }
    return parsed;
  } catch {
    return defaultAppState();
  }
}

export function saveState(state: AppState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function exportStateJson(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function importStateJson(text: string): AppState {
  const parsed = JSON.parse(text) as AppState;
  if (parsed?.version !== 1 || !Array.isArray(parsed.seasons)) {
    throw new Error("Invalid backup file");
  }
  return parsed;
}

export function findSeason(state: AppState, id: string | null): Season | null {
  if (!id) return null;
  return state.seasons.find((s) => s.id === id) ?? null;
}
