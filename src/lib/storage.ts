import type { AppState, ExpenseCategoryDef, Season } from "./types";
import { DEFAULT_EXPENSE_CATEGORIES } from "./types";

const STORAGE_KEY = "gs11-finance-v1";

export function normalizeAppState(raw: unknown): AppState {
  const r = raw as Partial<AppState>;
  const seasons = Array.isArray(r.seasons) ? (r.seasons as Season[]) : [];
  const currentSeasonId =
    typeof r.currentSeasonId === "string" || r.currentSeasonId === null
      ? r.currentSeasonId
      : null;

  let expenseCategories: ExpenseCategoryDef[] = [];
  if (Array.isArray(r.expenseCategories)) {
    expenseCategories = r.expenseCategories.filter(
      (c): c is ExpenseCategoryDef =>
        Boolean(c) &&
        typeof c.id === "string" &&
        c.id.length > 0 &&
        typeof c.label === "string",
    );
  }
  if (expenseCategories.length === 0) {
    expenseCategories = DEFAULT_EXPENSE_CATEGORIES.map((c) => ({ ...c }));
  }

  return {
    version: 1,
    seasons,
    currentSeasonId,
    expenseCategories,
  };
}

export const defaultAppState = (): AppState => ({
  version: 1,
  seasons: [],
  currentSeasonId: null,
  expenseCategories: DEFAULT_EXPENSE_CATEGORIES.map((c) => ({ ...c })),
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
    return normalizeAppState(parsed);
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
  return normalizeAppState(parsed);
}

export function findSeason(state: AppState, id: string | null): Season | null {
  if (!id) return null;
  return state.seasons.find((s) => s.id === id) ?? null;
}
