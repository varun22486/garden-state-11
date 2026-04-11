import type { AppState } from "./types";

import { archiveSnapshotIfRemote } from "./snapshot-archive";

const SNAPSHOTS_KEY = "gs11-finance-snapshots-v1";

/** Max auto-backups kept in this browser; older ones are sent to the server when remote mode is on. */
export const SNAPSHOT_MAX_STORED = 5;

export type StateSnapshot = {
  id: string;
  savedAt: string;
  state: AppState;
};

function snapId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `snap-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Stores a copy of `previous` before applying a mutation (auto-backup). */
export function appendSnapshot(previous: AppState): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    const list: StateSnapshot[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return;
    list.unshift({
      id: snapId(),
      savedAt: new Date().toISOString(),
      state: JSON.parse(JSON.stringify(previous)) as AppState,
    });
    while (list.length > SNAPSHOT_MAX_STORED) {
      const evicted = list.pop();
      if (evicted) archiveSnapshotIfRemote(evicted);
    }
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(list));
  } catch {
    try {
      const raw = localStorage.getItem(SNAPSHOTS_KEY);
      const list: StateSnapshot[] = raw ? JSON.parse(raw) : [];
      while (list.length > SNAPSHOT_MAX_STORED) {
        const evicted = list.pop();
        if (evicted) archiveSnapshotIfRemote(evicted);
      }
      localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  }
}

export function loadSnapshots(): StateSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as StateSnapshot[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function removeSnapshot(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const list = loadSnapshots().filter((s) => s.id !== id);
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function clearSnapshots(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SNAPSHOTS_KEY);
  } catch {
    /* ignore */
  }
}
