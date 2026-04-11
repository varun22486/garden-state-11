"use client";

import { useState } from "react";

export function TeamLogin({
  onLogin,
  error,
}: {
  onLogin: (password: string) => Promise<boolean>;
  error: string | null;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || busy) return;
    setBusy(true);
    try {
      await onLogin(password);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col justify-center px-2">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-lg">
        <h1 className="text-xl font-semibold">Garden State 11</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Use the <strong className="text-[var(--foreground)]">admin</strong>{" "}
          password for full access, or the{" "}
          <strong className="text-[var(--foreground)]">expense-only</strong>{" "}
          password to view and add expenses only.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              className="mt-1 min-h-12 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="min-h-12 w-full rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
