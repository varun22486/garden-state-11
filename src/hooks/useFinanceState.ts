"use client";

import { appendSnapshot } from "@/lib/snapshots";
import { loadState, normalizeAppState, saveState } from "@/lib/storage";
import type { AppState } from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";

export const FINANCE_REMOTE =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_FINANCE_REMOTE === "true";

export function useFinanceState() {
  const [state, setState] = useState<AppState | null>(null);
  const [ready, setReady] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [conflictNotice, setConflictNotice] = useState(false);
  const revisionRef = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<AppState | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const refreshFromServer = useCallback(async () => {
    setRemoteError(null);
    const res = await fetch("/api/finance", { credentials: "include" });
    if (res.status === 401) {
      setAuthRequired(true);
      setState(null);
      setReady(true);
      return;
    }
    if (res.status === 503) {
      setRemoteError(
        "Server is not configured (check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).",
      );
      setReady(true);
      return;
    }
    if (!res.ok) {
      setRemoteError("Could not load shared data.");
      setReady(true);
      return;
    }
    const data = (await res.json()) as { state: unknown; revision: number };
    setState(normalizeAppState(data.state));
    revisionRef.current = data.revision;
    setAuthRequired(false);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!FINANCE_REMOTE) {
      setState(loadState());
      setReady(true);
      setAuthRequired(false);
      return;
    }
    void refreshFromServer();
  }, [refreshFromServer]);

  const runRemotePut = useCallback(
    async (payload: AppState, revision: number) => {
      const res = await fetch("/api/finance", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: payload, revision }),
      });
      if (res.status === 409) {
        const d = (await res.json()) as {
          state?: unknown;
          revision?: number;
        };
        if (d.state != null && typeof d.revision === "number") {
          setState(normalizeAppState(d.state));
          revisionRef.current = d.revision;
          setConflictNotice(true);
        }
        return;
      }
      if (res.ok) {
        const d = (await res.json()) as { revision?: number };
        if (typeof d.revision === "number") revisionRef.current = d.revision;
      }
    },
    [],
  );

  /** Call after import/replace so the server gets the new blob without waiting for debounce. */
  const flushRemoteSave = useCallback(async () => {
    if (!FINANCE_REMOTE || authRequired) return;
    const s = stateRef.current;
    if (!s) return;
    await runRemotePut(s, revisionRef.current);
  }, [authRequired, runRemotePut]);

  useEffect(() => {
    if (!FINANCE_REMOTE) {
      if (!ready || !state) return;
      saveState(state);
      return;
    }
    if (!ready || !state || authRequired) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void runRemotePut(state, revisionRef.current);
    }, 450);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [ready, state, authRequired, runRemotePut]);

  const login = useCallback(
    async (password: string) => {
      setRemoteError(null);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setRemoteError(d.error ?? "Invalid password");
        return false;
      }
      await refreshFromServer();
      return true;
    },
    [refreshFromServer],
  );

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setState(null);
    setAuthRequired(true);
    setReady(true);
  }, []);

  const update = useCallback((fn: (s: AppState) => AppState) => {
    setState((prev) => {
      if (!prev) return prev;
      appendSnapshot(prev);
      return fn(prev);
    });
  }, []);

  const replaceState = useCallback((next: AppState) => {
    setState((prev) => {
      if (prev) appendSnapshot(prev);
      return normalizeAppState(next);
    });
  }, []);

  return {
    state,
    update,
    replaceState,
    ready,
    remoteMode: FINANCE_REMOTE,
    authRequired,
    remoteError,
    setRemoteError,
    login,
    logout,
    conflictNotice,
    clearConflictNotice: () => setConflictNotice(false),
    refreshFromServer,
    flushRemoteSave,
  };
}
