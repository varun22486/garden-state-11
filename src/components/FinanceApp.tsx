"use client";

import {
  computeSeasonTotals,
  formatMoney,
  makePlayer,
  newId,
  parsePlayerNamesBlob,
  suggestedCarryOver,
} from "@/lib/finance";
import { useFinanceState } from "@/hooks/useFinanceState";
import {
  clearSnapshots,
  loadSnapshots,
  removeSnapshot,
  SNAPSHOT_MAX_STORED,
  type StateSnapshot,
} from "@/lib/snapshots";
import {
  exportStateJson,
  findSeason,
  importStateJson,
  normalizeAppState,
} from "@/lib/storage";
import type { AppState, Expense, Player, Season } from "@/lib/types";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  expenseCategoryLabel,
  isExpenseCategoryInUse,
} from "@/lib/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TeamLogin } from "@/components/TeamLogin";

type MainTabId = "dashboard" | "history" | "add" | "audit";

const MAIN_TABS: { id: MainTabId; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "history", label: "Expenses History" },
  { id: "add", label: "Add Expenses" },
  { id: "audit", label: "Audit" },
];

function Card({
  title,
  value,
  hint,
  variant = "default",
}: {
  title: string;
  value: string;
  hint?: string;
  variant?: "default" | "warn" | "danger" | "ok";
}) {
  const border =
    variant === "danger"
      ? "border-[var(--danger)]/40"
      : variant === "warn"
        ? "border-[var(--warn)]/40"
        : variant === "ok"
          ? "border-[var(--accent)]/40"
          : "border-[var(--border)]";
  return (
    <div
      className={`rounded-xl border ${border} bg-[var(--card)] p-3 shadow-sm sm:p-4`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        {title}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? (
        <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

export function FinanceApp() {
  const {
    state,
    replaceState,
    update,
    ready: hookReady,
    remoteMode,
    authRequired,
    remoteError,
    login,
    logout,
    conflictNotice,
    clearConflictNotice,
    refreshFromServer,
    flushRemoteSave,
  } = useFinanceState();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showNewSeason, setShowNewSeason] = useState(false);
  const [newSeasonLabel, setNewSeasonLabel] = useState("");
  const [newSeasonFee, setNewSeasonFee] = useState("100");
  const [newSeasonCarry, setNewSeasonCarry] = useState("0");
  const [newSeasonCarryFromId, setNewSeasonCarryFromId] = useState<string>("");
  const [newSeasonPlayersText, setNewSeasonPlayersText] = useState("");

  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expensePaidBy, setExpensePaidBy] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [newExpenseTypeLabel, setNewExpenseTypeLabel] = useState("");
  const [expenseDate, setExpenseDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  const [editCarry, setEditCarry] = useState("");
  const [editFee, setEditFee] = useState("");
  const [activeTab, setActiveTab] = useState<MainTabId>("dashboard");

  const season = state ? findSeason(state, state.currentSeasonId) : null;
  const totals = useMemo(
    () => (season ? computeSeasonTotals(season) : null),
    [season],
  );
  const [snapRev, setSnapRev] = useState(0);
  const snapshots = useMemo(
    () => loadSnapshots(),
    [state, snapRev],
  );
  /** Oldest first so running total reads naturally top → bottom. */
  const expensesHistoryRows = useMemo(() => {
    if (!season) return [];
    const sorted = [...season.expenses].sort((a, b) => {
      const ta = new Date(a.date).getTime();
      const tb = new Date(b.date).getTime();
      if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
      return a.id.localeCompare(b.id);
    });
    let running = 0;
    return sorted.map((e) => {
      running += e.amount;
      return { expense: e, runningTotal: running };
    });
  }, [season]);

  useEffect(() => {
    if (season) {
      setEditCarry(String(season.carryOverAmount));
      setEditFee(String(season.initialFeePerPlayer));
      const first = season.players[0]?.id ?? "";
      setExpensePaidBy((prev) =>
        season.players.some((p) => p.id === prev) ? prev : first,
      );
    }
  }, [season?.id, season?.carryOverAmount, season?.initialFeePerPlayer]);

  useEffect(() => {
    if (!state?.expenseCategories.length) return;
    setExpenseCategory((prev) =>
      prev && state.expenseCategories.some((c) => c.id === prev)
        ? prev
        : state.expenseCategories[0].id,
    );
  }, [state]);

  useEffect(() => {
    setActiveTab("dashboard");
  }, [season?.id]);

  const openNewSeason = () => {
    const y = new Date().getFullYear();
    setNewSeasonLabel(`Season ${y}`);
    setNewSeasonFee("100");
    setNewSeasonCarry("0");
    setNewSeasonCarryFromId(state?.seasons[0]?.id ?? "");
    setNewSeasonPlayersText("");
    setShowNewSeason(true);
  };

  const applySuggestedCarry = () => {
    if (!state || !newSeasonCarryFromId) return;
    const src = findSeason(state, newSeasonCarryFromId);
    if (!src) return;
    const t = computeSeasonTotals(src);
    setNewSeasonCarry(String(suggestedCarryOver(t)));
  };

  const createSeason = () => {
    if (!state) return;
    const fee = Number.parseFloat(newSeasonFee);
    const carry = Number.parseFloat(newSeasonCarry);
    if (!newSeasonLabel.trim() || !Number.isFinite(fee) || fee < 0) return;
    if (!Number.isFinite(carry)) return;

    const names = parsePlayerNamesBlob(newSeasonPlayersText);
    const players: Player[] =
      names.length > 0 ? names.map((n) => makePlayer(n)) : [];

    const s: Season = {
      id: newId(),
      label: newSeasonLabel.trim(),
      createdAt: new Date().toISOString(),
      initialFeePerPlayer: fee,
      carryOverAmount: Math.max(0, carry),
      carryOverFromSeasonId: newSeasonCarryFromId || null,
      players,
      expenses: [],
    };

    update((app) => ({
      ...app,
      seasons: [s, ...app.seasons],
      currentSeasonId: s.id,
    }));
    setShowNewSeason(false);
  };

  const addExpense = () => {
    if (!season || season.players.length === 0 || !state) return;
    const amt = Number.parseFloat(expenseAmount);
    if (!Number.isFinite(amt) || amt <= 0 || !expenseDesc.trim()) return;
    if (!expensePaidBy || !season.players.some((p) => p.id === expensePaidBy))
      return;
    if (
      !expenseCategory ||
      !state.expenseCategories.some((c) => c.id === expenseCategory)
    )
      return;

    const e: Expense = {
      id: newId(),
      date: expenseDate,
      amount: amt,
      description: expenseDesc.trim(),
      paidByPlayerId: expensePaidBy,
      category: expenseCategory,
    };

    update((app) => ({
      ...app,
      seasons: app.seasons.map((x) =>
        x.id === season.id ? { ...x, expenses: [e, ...x.expenses] } : x,
      ),
    }));
    setExpenseAmount("");
    setExpenseDesc("");
    setActiveTab("history");
  };

  const removeExpense = (expenseId: string) => {
    if (!season) return;
    update((app) => ({
      ...app,
      seasons: app.seasons.map((x) =>
        x.id === season.id
          ? { ...x, expenses: x.expenses.filter((e) => e.id !== expenseId) }
          : x,
      ),
    }));
  };

  const addPlayer = () => {
    if (!season) return;
    const p = makePlayer("New player");
    update((app) => ({
      ...app,
      seasons: app.seasons.map((x) =>
        x.id === season.id ? { ...x, players: [...x.players, p] } : x,
      ),
    }));
  };

  const updatePlayer = (playerId: string, patch: Partial<Player>) => {
    if (!season) return;
    update((app) => ({
      ...app,
      seasons: app.seasons.map((x) =>
        x.id === season.id
          ? {
              ...x,
              players: x.players.map((p) =>
                p.id === playerId ? { ...p, ...patch } : p,
              ),
            }
          : x,
      ),
    }));
  };

  const removePlayer = (playerId: string) => {
    if (!season) return;
    const refs = season.expenses.some((e) => e.paidByPlayerId === playerId);
    if (refs) {
      alert(
        "This player has expenses recorded as paid by them. Delete or reassign those expenses first.",
      );
      return;
    }
    update((app) => ({
      ...app,
      seasons: app.seasons.map((x) =>
        x.id === season.id
          ? { ...x, players: x.players.filter((p) => p.id !== playerId) }
          : x,
      ),
    }));
  };

  const markFeePaid = (playerId: string) => {
    if (!season) return;
    update((app) => ({
      ...app,
      seasons: app.seasons.map((x) => {
        if (x.id !== season.id) return x;
        return {
          ...x,
          players: x.players.map((p) =>
            p.id === playerId ? { ...p, feePaid: x.initialFeePerPlayer } : p,
          ),
        };
      }),
    }));
  };

  const saveSeasonMeta = () => {
    if (!season) return;
    const fee = Number.parseFloat(editFee);
    const carry = Number.parseFloat(editCarry);
    if (!Number.isFinite(fee) || fee < 0 || !Number.isFinite(carry) || carry < 0)
      return;
    update((app) => ({
      ...app,
      seasons: app.seasons.map((x) =>
        x.id === season.id
          ? {
              ...x,
              initialFeePerPlayer: fee,
              carryOverAmount: carry,
            }
          : x,
      ),
    }));
  };

  const pullCarryFromPrior = () => {
    if (!season?.carryOverFromSeasonId || !state) return;
    const src = findSeason(state, season.carryOverFromSeasonId);
    if (!src) return;
    const t = computeSeasonTotals(src);
    update((app) => ({
      ...app,
      seasons: app.seasons.map((x) =>
        x.id === season.id
          ? { ...x, carryOverAmount: suggestedCarryOver(t) }
          : x,
      ),
    }));
    setEditCarry(String(suggestedCarryOver(t)));
  };

  const deleteSeason = () => {
    if (!season || !state) return;
    if (
      !confirm(
        `Delete season "${season.label}"? This cannot be undone (export a backup first).`,
      )
    )
      return;
       const rest = state.seasons.filter((s) => s.id !== season.id);
    const nextCurrent =
      state.currentSeasonId === season.id ? (rest[0]?.id ?? null) : state.currentSeasonId;
    update((app) => ({
      ...app,
      seasons: rest.map((s) =>
        s.carryOverFromSeasonId === season.id
          ? { ...s, carryOverFromSeasonId: null }
          : s,
      ),
      currentSeasonId: nextCurrent,
    }));
  };

  const exportJson = () => {
    if (!state) return;
    const blob = new Blob([exportStateJson(state)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `garden-state-11-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onImportFile = (f: File | null) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = importStateJson(String(reader.result));
        if (
          !confirm(
            "Replace all data on this device with the backup? Current data will be snapshotted first.",
          )
        )
          return;
        replaceState(imported);
        setSnapRev((x) => x + 1);
        setTimeout(() => {
          void flushRemoteSave();
        }, 0);
      } catch {
        alert("Could not read that file.");
      }
    };
    reader.readAsText(f);
  };

  const restoreFromSnapshot = (snap: StateSnapshot) => {
    if (
      !confirm(
        "Restore this auto-backup? Your current data is saved as a new backup first.",
      )
    )
      return;
    replaceState(normalizeAppState(snap.state));
    setSnapRev((x) => x + 1);
    setTimeout(() => {
      void flushRemoteSave();
    }, 0);
  };

  const deleteSnapshotById = (id: string) => {
    removeSnapshot(id);
    setSnapRev((x) => x + 1);
  };

  const clearSnapshotHistory = () => {
    if (
      !confirm(
        "Remove all auto-backup snapshots from this browser? Your current data is unchanged.",
      )
    )
      return;
    clearSnapshots();
    setSnapRev((x) => x + 1);
  };

  const addExpenseType = () => {
    if (!state) return;
    const label = newExpenseTypeLabel.trim();
    if (!label) return;
    update((app) => ({
      ...app,
      expenseCategories: [...app.expenseCategories, { id: newId(), label }],
    }));
    setNewExpenseTypeLabel("");
  };

  const renameExpenseType = (id: string, label: string) => {
    update((app) => ({
      ...app,
      expenseCategories: app.expenseCategories.map((c) =>
        c.id === id ? { ...c, label: label.trim() || c.label } : c,
      ),
    }));
  };

  const removeExpenseType = (id: string) => {
    if (!state) return;
    if (state.expenseCategories.length <= 1) {
      alert("Keep at least one expense type.");
      return;
    }
    if (isExpenseCategoryInUse(state, id)) {
      alert(
        "This type is used on an expense. Change or delete those expenses first.",
      );
      return;
    }
    update((app) => ({
      ...app,
      expenseCategories: app.expenseCategories.filter((c) => c.id !== id),
    }));
  };

  const resetExpenseTypesToDefaults = () => {
    if (
      !confirm(
        "Reset expense types to the built-in list? Custom types are removed from the picker; old expenses still reference their saved type id.",
      )
    )
      return;
    update((app) => ({
      ...app,
      expenseCategories: DEFAULT_EXPENSE_CATEGORIES.map((c) => ({ ...c })),
    }));
  };

  if (!hookReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--muted)]">
        Loading…
      </div>
    );
  }

  if (remoteMode && authRequired) {
    return <TeamLogin onLogin={login} error={remoteError} />;
  }

  if (remoteMode && !state && remoteError) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm text-[var(--danger)]" role="alert">
          {remoteError}
        </p>
        <button
          type="button"
          onClick={() => void refreshFromServer()}
          className="mt-4 min-h-11 rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--muted)]">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-10">
      <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-start sm:justify-between sm:pb-8">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Garden State 11
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
            Pool accounting for fees and expenses. Recording spend lowers the fund;
            whoever paid is shown as owed reimbursement.
            {remoteMode ? (
              <>
                {" "}
                This deploy shares one live dataset for the team (sign in with the
                shared password). Local snapshots and backups still live in your
                browser — see{" "}
                <strong className="text-[var(--foreground)]">Audit</strong>.
              </>
            ) : (
              <>
                {" "}
                Works offline in your browser — open{" "}
                <strong className="text-[var(--foreground)]">Audit</strong> for
                storage, backups, and custom expense types.
              </>
            )}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <select
            className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm sm:min-h-10 sm:w-auto"
            value={state.currentSeasonId ?? ""}
            onChange={(e) =>
              update((a) => ({
                ...a,
                currentSeasonId: e.target.value || null,
              }))
            }
          >
            {state.seasons.length === 0 ? (
              <option value="">No seasons yet</option>
            ) : null}
            {state.seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={openNewSeason}
            className="min-h-11 w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 sm:min-h-10 sm:w-auto"
          >
            New season
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            onImportFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
      </header>

      {conflictNotice ? (
        <div
          className="flex flex-col gap-3 rounded-xl border border-[var(--warn)]/45 bg-[var(--warn)]/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          role="status"
        >
          <p className="text-[var(--foreground)]">
            Another session saved first. This tab was updated to match the server
            so you don&apos;t overwrite their changes.
          </p>
          <button
            type="button"
            onClick={clearConflictNotice}
            className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {showNewSeason ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-season-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl">
            <h2 id="new-season-title" className="text-lg font-semibold">
              New season
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Set the team fee, opening balance, and optionally paste player
              names (one per line or comma-separated).
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-[var(--muted)]">Season name</span>
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                  value={newSeasonLabel}
                  onChange={(e) => setNewSeasonLabel(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--muted)]">Fee per player ($)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                  value={newSeasonFee}
                  onChange={(e) => setNewSeasonFee(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--muted)]">
                  Carry-over from prior season ($)
                </span>
                <div className="mt-1 flex gap-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                    value={newSeasonCarry}
                    onChange={(e) => setNewSeasonCarry(e.target.value)}
                  />
                </div>
              </label>
              <label className="block text-sm">
                <span className="text-[var(--muted)]">
                  Suggest carry-over from
                </span>
                <div className="mt-1 flex gap-2">
                  <select
                    className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                    value={newSeasonCarryFromId}
                    onChange={(e) => setNewSeasonCarryFromId(e.target.value)}
                  >
                    <option value="">— None —</option>
                    {state.seasons.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label} (cash left:{" "}
                        {formatMoney(
                          suggestedCarryOver(computeSeasonTotals(s)),
                        )}
                        )
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={applySuggestedCarry}
                    className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                  >
                    Use suggested
                  </button>
                </div>
              </label>
              <label className="block text-sm">
                <span className="text-[var(--muted)]">Players (optional)</span>
                <textarea
                  rows={5}
                  placeholder={"Alex\nJordan\nSam"}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm"
                  value={newSeasonPlayersText}
                  onChange={(e) => setNewSeasonPlayersText(e.target.value)}
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewSeason(false)}
                className="rounded-lg px-4 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createSeason}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
              >
                Create season
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {state.seasons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)]/50 px-8 py-16 text-center">
          <p className="text-[var(--muted)]">
            Create your first season to start tracking fees and expenses.
          </p>
          <button
            type="button"
            onClick={openNewSeason}
            className="mt-4 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white"
          >
            New season
          </button>
        </div>
      ) : !season ? (
        <p className="text-[var(--muted)]">Select a season above.</p>
      ) : (
        <>
          <nav
            className="-mx-2 flex gap-1 overflow-x-auto overscroll-x-contain border-b border-[var(--border)] px-2 pb-px [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Main sections"
          >
            {MAIN_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activeTab === t.id}
                className={`shrink-0 whitespace-nowrap rounded-t-lg border-b-2 px-3 py-3 text-sm font-medium sm:px-4 sm:py-2.5 ${
                  activeTab === t.id
                    ? "border-[var(--accent)] bg-[var(--card)]/70 text-[var(--foreground)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="mt-4 space-y-6 sm:mt-6 sm:space-y-8">
            {activeTab === "dashboard" ? (
              <>
                <section className="space-y-4">
                  <h2 className="text-lg font-semibold">Overview — {season.label}</h2>
            {totals ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <Card
                  title="Carry-over"
                  value={formatMoney(totals.carryOver)}
                  hint="Opening balance"
                />
                <Card
                  title="Fees collected"
                  value={formatMoney(totals.totalFeesCollected)}
                />
                <Card
                  title="Total in"
                  value={formatMoney(totals.totalInflows)}
                  hint="Carry-over + fees"
                />
                <Card title="Total expenses" value={formatMoney(totals.totalExpenses)} />
                <Card
                  title="Cash remaining"
                  value={formatMoney(totals.cashRemaining)}
                  hint="Inflows − expenses"
                  variant={
                    totals.cashRemaining < 0
                      ? "danger"
                      : totals.cashRemaining === 0
                        ? "warn"
                        : "ok"
                  }
                />
              </div>
            ) : null}
            {totals && totals.cashRemaining < 0 ? (
              <p className="rounded-lg border border-[var(--danger)]/50 bg-[var(--danger)]/10 px-4 py-3 text-sm">
                The books show more spent than collected plus carry-over. Check
                expenses or adjust carry-over / fees.
              </p>
            ) : null}
          </section>

                <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">Players & fees</h3>
              <button
                type="button"
                onClick={addPlayer}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
              >
                Add player
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full min-w-[640px] text-left text-xs sm:text-sm">
                <thead className="border-b border-[var(--border)] bg-[var(--card)] text-xs uppercase text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-2">Player</th>
                    <th className="px-3 py-2">Fee status</th>
                    <th className="px-3 py-2">Paid ($)</th>
                    <th className="px-3 py-2">Owed from pool</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {totals?.playerBalances.map((b) => {
                    const unpaid = b.feeShortfall > 0.005;
                    const owed = b.outOfPocket > 0.005;
                    return (
                      <tr
                        key={b.playerId}
                        className={
                          unpaid
                            ? "bg-[var(--danger)]/10"
                            : "border-b border-[var(--border)]/60"
                        }
                      >
                        <td className="px-3 py-2">
                          <input
                            className="w-full max-w-[160px] rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-[var(--border)]"
                            value={
                              season.players.find((p) => p.id === b.playerId)
                                ?.name ?? ""
                            }
                            onChange={(e) =>
                              updatePlayer(b.playerId, { name: e.target.value })
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          {unpaid ? (
                            <span className="inline-flex items-center rounded-full bg-[var(--danger)]/20 px-2 py-0.5 text-xs font-medium text-[var(--danger)]">
                              Owes {formatMoney(b.feeShortfall)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-[var(--accent)]/20 px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                              Fee paid
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="w-24 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1"
                            value={b.feePaid}
                            onChange={(e) =>
                              updatePlayer(b.playerId, {
                                feePaid: Number.parseFloat(e.target.value) || 0,
                              })
                            }
                          />
                          <button
                            type="button"
                            onClick={() => markFeePaid(b.playerId)}
                            className="ml-2 text-xs text-[var(--accent)] hover:underline"
                          >
                            Mark full
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          {owed ? (
                            <div className="space-y-1">
                              <span className="font-medium text-[var(--accent)]">
                                {formatMoney(b.outOfPocket)} to reimburse
                              </span>
                              <p className="text-xs text-[var(--muted)]">
                                Paid for the team — settle from the main pool
                              </p>
                            </div>
                          ) : (
                            <span className="text-[var(--muted)]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removePlayer(b.playerId)}
                            className="text-xs text-[var(--muted)] hover:text-[var(--danger)]"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Expenses hit the pool (see Overview). &quot;Owed from pool&quot; is
              only what that person fronted so you can reimburse them — not an
              extra charge to others. Season fee is separate (Fee status).
            </p>
          </section>
              </>
            ) : null}

            {activeTab === "history" ? (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Expenses History</h2>
                <p className="text-sm text-[var(--muted)]">
                  Oldest first. Running total is cumulative spend for this season
                  {season.expenses.length > 0
                    ? ` (${season.expenses.length} entr${season.expenses.length === 1 ? "y" : "ies"}).`
                    : "."}
                </p>
                {season.expenses.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No expenses yet.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                    <table className="w-full min-w-[720px] text-left text-xs sm:text-sm">
                      <thead className="border-b border-[var(--border)] bg-[var(--card)] text-xs uppercase text-[var(--muted)]">
                        <tr>
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Description</th>
                          <th className="px-3 py-2">Category</th>
                          <th className="px-3 py-2">Paid by</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                          <th className="px-3 py-2 text-right">Running total</th>
                          <th className="px-3 py-2 text-right" />
                        </tr>
                      </thead>
                      <tbody>
                        {expensesHistoryRows.map(({ expense: e, runningTotal }, i) => {
                          const payer = season.players.find(
                            (p) => p.id === e.paidByPlayerId,
                          );
                          return (
                            <tr
                              key={e.id}
                              className="border-b border-[var(--border)]/60"
                            >
                              <td className="px-3 py-2 tabular-nums text-[var(--muted)]">
                                {i + 1}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-[var(--muted)]">
                                {e.date}
                              </td>
                              <td className="px-3 py-2 font-medium">{e.description}</td>
                              <td className="px-3 py-2 text-[var(--muted)]">
                                {expenseCategoryLabel(state.expenseCategories, e.category)}
                              </td>
                              <td className="px-3 py-2">{payer?.name ?? "—"}</td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatMoney(e.amount)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums font-medium text-[var(--accent)]">
                                {formatMoney(runningTotal)}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeExpense(e.id)}
                                  className="text-xs text-[var(--danger)] hover:underline"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ) : null}

            {activeTab === "add" ? (
              <section>
                <div className="max-w-2xl space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
                  <h2 className="text-lg font-semibold">Add Expenses</h2>
                  <p className="text-sm text-[var(--muted)]">
                    Record who paid; they&apos;ll show as owed reimbursement from
                    the pool. The total fund drops by this amount automatically.
                  </p>
                  {season.players.length === 0 ? (
                <p className="text-sm text-[var(--warn)]">
                  Add at least one player before recording expenses.
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm sm:col-span-2">
                  <span className="text-[var(--muted)]">Description</span>
                  <input
                    className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-[var(--muted)]">Amount ($)</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-[var(--muted)]">Date</span>
                  <input
                    type="date"
                    className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-[var(--muted)]">Paid by</span>
                  <select
                    className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                    value={expensePaidBy}
                    onChange={(e) => setExpensePaidBy(e.target.value)}
                  >
                    {season.players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="text-[var(--muted)]">Category</span>
                  <select
                    className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                    value={
                      expenseCategory ||
                      state.expenseCategories[0]?.id ||
                      ""
                    }
                    onChange={(e) => setExpenseCategory(e.target.value)}
                  >
                    {state.expenseCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="button"
                onClick={addExpense}
                disabled={season.players.length === 0}
                className="min-h-12 w-full rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-10 sm:w-auto sm:py-2"
              >
                Record expense
              </button>
                </div>
              </section>
            ) : null}

            {activeTab === "audit" ? (
              <div className="space-y-6">
                <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6">
                  <h2 className="text-lg font-semibold">Audit</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Season settings, expense types, manual backups, and
                    auto-saved snapshots.
                  </p>
                  <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 text-sm text-[var(--muted)]">
                    <p className="font-medium text-[var(--foreground)]">
                      Where your data is stored
                    </p>
                    <p className="mt-2 leading-relaxed">
                      {remoteMode ? (
                        <>
                          The <strong>live books</strong> (seasons, players,
                          expenses) are stored on the server database for this
                          deploy so everyone sees the same numbers. Your session
                          uses a team password cookie — use{" "}
                          <strong className="text-[var(--foreground)]">
                            Log out
                          </strong>{" "}
                          on a shared computer.{" "}
                          <strong className="text-[var(--foreground)]">
                            Auto-backups
                          </strong>{" "}
                          below are still only in this browser&apos;s{" "}
                          <code className="rounded bg-[var(--card)] px-1.5 py-0.5 font-mono text-xs text-[var(--foreground)]">
                            localStorage
                          </code>{" "}
                          (
                          <code className="break-all font-mono text-xs text-[var(--foreground)]">
                            gs11-finance-snapshots-v1
                          </code>
                          ). Use{" "}
                          <strong className="text-[var(--foreground)]">
                            Export backup
                          </strong>{" "}
                          for a portable JSON file.
                        </>
                      ) : (
                        <>
                          All data lives only on <strong>this device</strong>, in
                          your browser&apos;s{" "}
                          <code className="rounded bg-[var(--card)] px-1.5 py-0.5 font-mono text-xs text-[var(--foreground)]">
                            localStorage
                          </code>
                          . Main app data uses key{" "}
                          <code className="break-all font-mono text-xs text-[var(--foreground)]">
                            gs11-finance-v1
                          </code>
                          ; auto-backups use{" "}
                          <code className="break-all font-mono text-xs text-[var(--foreground)]">
                            gs11-finance-snapshots-v1
                          </code>
                          . Nothing is uploaded to a server. Use{" "}
                          <strong className="text-[var(--foreground)]">
                            Export backup
                          </strong>{" "}
                          to save a JSON file you can move to another device or
                          keep safe.
                        </>
                      )}
                    </p>
                    {remoteMode ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void refreshFromServer()}
                          className="min-h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm"
                        >
                          Refresh from server
                        </button>
                        <button
                          type="button"
                          onClick={() => void logout()}
                          className="min-h-10 rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)]"
                        >
                          Log out
                        </button>
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6">
                  <h3 className="font-semibold">Expense types</h3>
                  <p className="text-sm text-[var(--muted)]">
                    These appear in the category picker on{" "}
                    <strong className="text-[var(--foreground)]">Add Expenses</strong>.
                    You can&apos;t remove a type that is still used on a line item.
                  </p>
                  <ul className="space-y-3">
                    {state.expenseCategories.map((c) => (
                      <li
                        key={c.id}
                        className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 sm:flex-row sm:items-center sm:gap-3"
                      >
                        <input
                          className="min-h-11 w-full flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 sm:min-h-10"
                          value={c.label}
                          onChange={(e) =>
                            renameExpenseType(c.id, e.target.value)
                          }
                          aria-label={`Rename expense type: ${c.label}`}
                        />
                        <button
                          type="button"
                          className="min-h-11 shrink-0 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={
                            state.expenseCategories.length <= 1 ||
                            isExpenseCategoryInUse(state, c.id)
                          }
                          onClick={() => removeExpenseType(c.id)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <input
                      className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 sm:max-w-xs"
                      placeholder="New type name"
                      value={newExpenseTypeLabel}
                      onChange={(e) => setNewExpenseTypeLabel(e.target.value)}
                    />
                    <button
                      type="button"
                      className="min-h-11 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
                      onClick={addExpenseType}
                    >
                      Add type
                    </button>
                    <button
                      type="button"
                      className="min-h-11 rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
                      onClick={resetExpenseTypesToDefaults}
                    >
                      Reset defaults
                    </button>
                  </div>
                </section>

                <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6">
                  <h3 className="font-semibold">Season settings</h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-sm">
                      <span className="text-[var(--muted)]">Fee per player ($)</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 sm:min-h-10"
                        value={editFee}
                        onChange={(e) => setEditFee(e.target.value)}
                      />
                    </label>
                    <label className="text-sm">
                      <span className="text-[var(--muted)]">Carry-over ($)</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 sm:min-h-10"
                        value={editCarry}
                        onChange={(e) => setEditCarry(e.target.value)}
                      />
                    </label>
                    <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:flex-wrap sm:items-end">
                      <button
                        type="button"
                        onClick={saveSeasonMeta}
                        className="min-h-11 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white sm:min-h-10"
                      >
                        Save settings
                      </button>
                      {season.carryOverFromSeasonId ? (
                        <button
                          type="button"
                          onClick={pullCarryFromPrior}
                          className="min-h-11 rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm sm:min-h-10"
                          title="Overwrite carry-over with current cash-left from linked season"
                        >
                          Sync from prior
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={deleteSeason}
                        className="min-h-11 rounded-lg border border-[var(--danger)]/50 px-4 py-2.5 text-sm text-[var(--danger)] sm:min-h-10"
                      >
                        Delete season
                      </button>
                    </div>
                  </div>
                  {season.carryOverFromSeasonId ? (
                    <p className="text-xs text-[var(--muted)]">
                      Linked prior:{" "}
                      {findSeason(state, season.carryOverFromSeasonId)?.label ??
                        "(missing)"}{" "}
                      — use &quot;Sync from prior&quot; to refresh carry-over from
                      that season&apos;s current cash remaining.
                    </p>
                  ) : null}
                </section>

                <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6">
                  <h3 className="font-semibold">Export &amp; import</h3>
                  <p className="text-sm text-[var(--muted)]">
                    Download a JSON file or restore from a backup. Your current
                    data is snapshotted before import.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      onClick={exportJson}
                      className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm sm:w-auto"
                    >
                      Export backup
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm sm:w-auto"
                    >
                      Import backup
                    </button>
                  </div>
                </section>

                <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">Auto-backups</h3>
                    {snapshots.length > 0 ? (
                      <button
                        type="button"
                        onClick={clearSnapshotHistory}
                        className="text-xs text-[var(--muted)] hover:text-[var(--danger)]"
                      >
                        Clear history
                      </button>
                    ) : null}
                  </div>
                  <p className="text-sm text-[var(--muted)]">
                    Each change keeps the previous full state (last{" "}
                    {SNAPSHOT_MAX_STORED} versions).
                  </p>
                  {snapshots.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">No snapshots yet.</p>
                  ) : (
                    <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
                      {snapshots.map((s) => (
                        <li
                          key={s.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                        >
                          <span className="text-[var(--muted)]">
                            {new Date(s.savedAt).toLocaleString()}
                          </span>
                          <span className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => restoreFromSnapshot(s)}
                              className="text-xs font-medium text-[var(--accent)] hover:underline"
                            >
                              Restore
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSnapshotById(s.id)}
                              className="text-xs text-[var(--muted)] hover:text-[var(--danger)]"
                            >
                              Remove
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
