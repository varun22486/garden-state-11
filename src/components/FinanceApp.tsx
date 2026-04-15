"use client";

import {
  computeSeasonTotals,
  formatMoney,
  makePlayer,
  newId,
  parsePlayerNamesBlob,
  sumExpensesPaidByPlayer,
  suggestedCarryOver,
  type PlayerBalance,
} from "@/lib/finance";
import { useFinanceState } from "@/hooks/useFinanceState";
import {
  clearSnapshots,
  loadSnapshots,
  removeSnapshot,
  SNAPSHOT_MAX_STORED,
  type StateSnapshot,
} from "@/lib/snapshots";
import { isValidNtfyTopic } from "@/lib/expense-notify";
import {
  exportStateJson,
  findSeason,
  importStateJson,
  normalizeAppState,
} from "@/lib/storage";
import type { Expense, Player, Season } from "@/lib/types";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  expenseCategoryLabel,
  isExpenseCategoryInUse,
} from "@/lib/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TeamLogin } from "@/components/TeamLogin";
import {
  div2MatchKey,
  gardenState11UmpiringMatches,
} from "@/lib/umpiring-schedule";

type MainTabId = "dashboard" | "umpiring" | "history" | "add" | "audit";

const MAIN_TABS: { id: MainTabId; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "umpiring", label: "Umpiring" },
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
      ? "border-[var(--danger)]/50 shadow-[0_0_0_1px_rgba(232,93,93,0.15)]"
      : variant === "warn"
        ? "border-[var(--warn)]/45 shadow-[0_0_0_1px_rgba(232,184,74,0.12)]"
        : variant === "ok"
          ? "border-[var(--accent)]/40 shadow-[0_0_20px_-8px_var(--glow-accent)]"
          : "border-[var(--border)]";
  const bg =
    variant === "danger"
      ? "bg-[var(--danger-softer)]"
      : variant === "ok"
        ? "bg-[var(--card)]"
        : "bg-[var(--card)]";
  return (
    <div
      className={`rounded-2xl border ${border} ${bg} p-4 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.55)] transition-shadow sm:p-5`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {title}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-[var(--foreground)] sm:text-[1.65rem]">
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{hint}</p>
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
    setRemoteError,
    login,
    logout,
    conflictNotice,
    clearConflictNotice,
    refreshFromServer,
    flushRemoteSave,
    postExpense,
    postUmpiringAssignment,
    isViewer,
  } = useFinanceState();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewerSeasonId, setViewerSeasonId] = useState<string | null>(null);
  const [expenseBusy, setExpenseBusy] = useState(false);
  const [umpiringBusy, setUmpiringBusy] = useState(false);

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
  const [expenseNtfyTopicDraft, setExpenseNtfyTopicDraft] = useState("");
  const [auditFlash, setAuditFlash] = useState<{
    message: string;
    variant: "ok" | "error";
  } | null>(null);
  const auditFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editCarry, setEditCarry] = useState("");
  const [editFee, setEditFee] = useState("");
  const [activeTab, setActiveTab] = useState<MainTabId>("dashboard");

  const effectiveSeasonId =
    (isViewer ? viewerSeasonId : null) ?? state?.currentSeasonId ?? null;
  const season =
    state && effectiveSeasonId
      ? findSeason(state, effectiveSeasonId)
      : null;

  const mainTabs = useMemo(
    () => (isViewer ? MAIN_TABS.filter((t) => t.id !== "audit") : MAIN_TABS),
    [isViewer],
  );

  useEffect(() => {
    if (!isViewer) setViewerSeasonId(null);
  }, [isViewer]);

  useEffect(() => {
    if (isViewer && activeTab === "audit") setActiveTab("dashboard");
  }, [isViewer, activeTab]);
  const totals = useMemo(
    () => (season ? computeSeasonTotals(season) : null),
    [season],
  );
  const outstandingBalanceRows = useMemo(() => {
    if (!totals) return [];
    return totals.playerBalances.filter((b) => {
      const unpaid = b.feeShortfall > 0.005;
      const paybackDue =
        !b.isTreasurer && b.reimbursementOutstanding > 0.005;
      return unpaid || paybackDue;
    });
  }, [totals]);

  const feeCollectionSummary = useMemo(() => {
    if (!totals) {
      return { unpaidPlayers: [] as PlayerBalance[], totalShortfall: 0 };
    }
    const unpaidPlayers = totals.playerBalances.filter(
      (b) => b.feeShortfall > 0.005,
    );
    const totalShortfall = unpaidPlayers.reduce((s, b) => s + b.feeShortfall, 0);
    return { unpaidPlayers, totalShortfall };
  }, [totals]);

  const paybackOwedSummary = useMemo(() => {
    if (!totals) {
      return { owedPlayers: [] as PlayerBalance[], totalOwed: 0 };
    }
    const owedPlayers = totals.playerBalances.filter(
      (b) => !b.isTreasurer && b.reimbursementOutstanding > 0.005,
    );
    const totalOwed = owedPlayers.reduce(
      (s, b) => s + b.reimbursementOutstanding,
      0,
    );
    return { owedPlayers, totalOwed };
  }, [totals]);
  const [snapRev, setSnapRev] = useState(0);
  const [serverArchives, setServerArchives] = useState<
    { id: string; savedAt: string }[]
  >([]);
  const snapshots = useMemo(() => loadSnapshots(), [snapRev]);

  const refreshServerArchives = useCallback(async () => {
    if (!remoteMode) return;
    const res = await fetch("/api/finance/snapshots", { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as {
      snapshots?: { id: string; savedAt: string }[];
    };
    setServerArchives(data.snapshots ?? []);
  }, [remoteMode]);

  useEffect(() => {
    if (activeTab !== "audit" || !remoteMode) return;
    void refreshServerArchives();
  }, [activeTab, remoteMode, refreshServerArchives, snapRev]);
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

  const umpiringScheduleRows = useMemo(() => gardenState11UmpiringMatches(), []);

  const onUmpiringAssign = useCallback(
    async (matchKey: string, playerId: string) => {
      if (!season) return;
      const pid = playerId === "" ? null : playerId;
      if (remoteMode) {
        setUmpiringBusy(true);
        try {
          await postUmpiringAssignment(season.id, matchKey, pid);
        } finally {
          setUmpiringBusy(false);
        }
      } else {
        update((app) => {
          const next = { ...(app.umpiringAssignments ?? {}) };
          if (!pid) delete next[matchKey];
          else next[matchKey] = pid;
          return { ...app, umpiringAssignments: next };
        });
      }
    },
    [season, remoteMode, postUmpiringAssignment, update],
  );

  useEffect(() => {
    if (season) {
      setEditCarry(String(season.carryOverAmount));
      setEditFee(String(season.initialFeePerPlayer));
      const first = season.players[0]?.id ?? "";
      setExpensePaidBy((prev) =>
        season.players.some((p) => p.id === prev) ? prev : first,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- narrow deps; keep Audit drafts when only players change
  }, [season?.id, season?.carryOverAmount, season?.initialFeePerPlayer]);

  useEffect(() => {
    if (!state?.expenseCategories.length) return;
    setExpenseCategory((prev) =>
      prev && state.expenseCategories.some((c) => c.id === prev)
        ? prev
        : state.expenseCategories[0].id,
    );
  }, [state]);

  const notifyNtfyTopicFromState = state?.expenseNtfyTopic ?? "";
  useEffect(() => {
    setExpenseNtfyTopicDraft(notifyNtfyTopicFromState);
  }, [notifyNtfyTopicFromState]);

  const showAuditFlash = useCallback(
    (message: string, variant: "ok" | "error" = "ok") => {
      if (auditFlashTimerRef.current) {
        clearTimeout(auditFlashTimerRef.current);
        auditFlashTimerRef.current = null;
      }
      setAuditFlash({ message, variant });
      auditFlashTimerRef.current = setTimeout(() => {
        setAuditFlash(null);
        auditFlashTimerRef.current = null;
      }, 3200);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (auditFlashTimerRef.current) {
        clearTimeout(auditFlashTimerRef.current);
      }
    };
  }, []);

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

  const addExpense = async () => {
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

    if (remoteMode) {
      setExpenseBusy(true);
      try {
        const ok = await postExpense(season.id, e);
        if (ok) {
          setExpenseAmount("");
          setExpenseDesc("");
          setActiveTab("history");
        }
      } finally {
        setExpenseBusy(false);
      }
      return;
    }

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
    const sid = season.id;
    update((app) => {
      const s = app.seasons.find((x) => x.id === sid);
      if (!s) return app;
      const patch2: Partial<Player> =
        patch.reimbursementSettled !== undefined
          ? {
              ...patch,
              reimbursementSettled: Math.max(
                0,
                Math.min(
                  sumExpensesPaidByPlayer(s.expenses, playerId),
                  patch.reimbursementSettled,
                ),
              ),
            }
          : patch;
      return {
        ...app,
        seasons: app.seasons.map((x) =>
          x.id === sid
            ? {
                ...x,
                players: x.players.map((p) =>
                  p.id === playerId ? { ...p, ...patch2 } : p,
                ),
              }
            : x,
        ),
      };
    });
  };

  /** At most one treasurer per season; `null` clears. */
  const setSeasonTreasurer = (playerId: string | null) => {
    if (!season) return;
    const sid = season.id;
    update((app) => ({
      ...app,
      seasons: app.seasons.map((x) =>
        x.id !== sid
          ? x
          : {
              ...x,
              players: x.players.map((p) => ({
                ...p,
                isTreasurer: playerId ? p.id === playerId : false,
              })),
            },
      ),
    }));
  };

  const settleReimburseFull = (playerId: string) => {
    const b = totals?.playerBalances.find((x) => x.playerId === playerId);
    if (!b || b.isTreasurer || b.reimbursementOutstanding < 0.005) return;
    updatePlayer(playerId, { reimbursementSettled: b.outOfPocket });
  };

  const settleReimbursePartial = (playerId: string) => {
    const raw = window.prompt("Amount reimbursed from the pool ($):", "");
    if (raw == null || !String(raw).trim()) return;
    const amt = Number.parseFloat(String(raw));
    if (!Number.isFinite(amt) || amt <= 0) {
      alert("Enter a positive number.");
      return;
    }
    const b = totals?.playerBalances.find((x) => x.playerId === playerId);
    if (!b || b.isTreasurer) return;
    const next = Math.min(b.outOfPocket, b.reimbursementSettled + amt);
    updatePlayer(playerId, { reimbursementSettled: next });
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

  const saveExpenseNtfyTopic = () => {
    if (!state) return;
    const t = expenseNtfyTopicDraft.trim();
    if (t.length === 0) {
      update((app) => ({
        ...app,
        expenseNtfyTopic: undefined,
      }));
      showAuditFlash("Saved — notifications off until you set a topic again.", "ok");
      return;
    }
    if (!isValidNtfyTopic(t)) {
      showAuditFlash(
        "Topic must be 1–64 characters: letters, numbers, underscores, or hyphens only.",
        "error",
      );
      return;
    }
    const saved = t.slice(0, 64);
    update((app) => ({
      ...app,
      expenseNtfyTopic: saved,
    }));
    showAuditFlash(
      remoteMode
        ? `Topic “${saved}” saved. Open the ntfy app, subscribe to that exact topic, then record an expense to test.`
        : `Topic “${saved}” saved locally. Push alerts only run on the deployed app (remote mode).`,
      "ok",
    );
  };

  const generateExpenseNtfyTopic = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    let s = "gs11-";
    for (let i = 0; i < bytes.length; i++) {
      s += chars[bytes[i]! % chars.length];
    }
    setExpenseNtfyTopicDraft(s);
  };

  const saveSeasonMeta = () => {
    if (!season) return;
    const fee = Number.parseFloat(editFee);
    const carry = Number.parseFloat(editCarry);
    if (!Number.isFinite(fee) || fee < 0 || !Number.isFinite(carry) || carry < 0) {
      showAuditFlash(
        "Fee and carry-over must be valid numbers (0 or greater).",
        "error",
      );
      return;
    }
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
    showAuditFlash("Season settings saved.", "ok");
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

  const restoreFromServerArchive = async (id: string) => {
    if (
      !confirm(
        "Restore this archived backup from the server? Your current data is saved as a new backup first.",
      )
    )
      return;
    const res = await fetch(
      `/api/finance/snapshots/${encodeURIComponent(id)}`,
      { credentials: "include" },
    );
    if (!res.ok) {
      alert("Could not load that backup.");
      return;
    }
    const data = (await res.json()) as { state?: unknown };
    if (data.state == null) {
      alert("Invalid backup response.");
      return;
    }
    replaceState(normalizeAppState(data.state));
    setSnapRev((x) => x + 1);
    void refreshServerArchives();
    setTimeout(() => {
      void flushRemoteSave();
    }, 0);
  };

  const deleteServerArchive = async (id: string) => {
    const res = await fetch(
      `/api/finance/snapshots/${encodeURIComponent(id)}`,
      { method: "DELETE", credentials: "include" },
    );
    if (!res.ok) {
      alert("Could not delete that backup.");
      return;
    }
    void refreshServerArchives();
  };

  const clearServerArchives = async () => {
    if (
      !confirm(
        "Delete all archived auto-backups on the server? Recent backups in this browser are unchanged.",
      )
    )
      return;
    await Promise.all(
      serverArchives.map((a) =>
        fetch(`/api/finance/snapshots/${encodeURIComponent(a.id)}`, {
          method: "DELETE",
          credentials: "include",
        }),
      ),
    );
    void refreshServerArchives();
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
            {remoteMode && isViewer ? (
              <>
                {" "}
                You&apos;re signed in with <strong>expense-only</strong> access:
                view the dashboard and history, switch seasons, and add expenses.
                Admin tasks use the other password.
              </>
            ) : remoteMode ? (
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
            value={effectiveSeasonId ?? ""}
            onChange={(e) => {
              const v = e.target.value || null;
              if (isViewer) {
                setViewerSeasonId(v);
              } else {
                update((a) => ({
                  ...a,
                  currentSeasonId: v,
                }));
              }
            }}
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
          {!isViewer ? (
            <button
              type="button"
              onClick={openNewSeason}
              className="min-h-11 w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 sm:min-h-10 sm:w-auto"
            >
              New season
            </button>
          ) : null}
          {remoteMode ? (
            <button
              type="button"
              onClick={() => void logout()}
              className="min-h-11 w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] sm:min-h-10 sm:w-auto"
            >
              Log out
            </button>
          ) : null}
        </div>
        {!isViewer ? (
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
        ) : null}
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

      {remoteMode && remoteError && !authRequired ? (
        <div
          className="flex flex-col gap-2 rounded-xl border border-[var(--danger)]/45 bg-[var(--danger)]/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p className="text-[var(--foreground)]">{remoteError}</p>
          <button
            type="button"
            onClick={() => setRemoteError(null)}
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
            {isViewer
              ? "No season yet. Ask a team admin to create one before you can add expenses."
              : "Create your first season to start tracking fees and expenses."}
          </p>
          {!isViewer ? (
            <button
              type="button"
              onClick={openNewSeason}
              className="mt-4 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white"
            >
              New season
            </button>
          ) : null}
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
            {mainTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activeTab === t.id}
                className={`shrink-0 whitespace-nowrap rounded-t-xl border-b-2 px-3 py-3 text-sm font-semibold transition-colors sm:px-4 sm:py-2.5 ${
                  activeTab === t.id
                    ? "border-[var(--accent)] bg-[var(--card)] text-[var(--foreground)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
                    : "border-transparent text-[var(--muted)] hover:bg-[var(--card)]/40 hover:text-[var(--foreground)]"
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
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                    <h2 className="text-lg font-semibold tracking-tight">
                      Overview — {season.label}
                    </h2>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--muted)] sm:text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-[var(--danger)]"
                          aria-hidden
                        />
                        Unpaid fee
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-[var(--warn)]"
                          aria-hidden
                        />
                        Payback owed
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]"
                          aria-hidden
                        />
                        Settled
                      </span>
                    </p>
                  </div>

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

            <div className="space-y-4">
              {totals &&
              feeCollectionSummary.unpaidPlayers.length > 0 &&
              season.players.length > 0 ? (
                <div
                  className="rounded-2xl border-2 border-[var(--danger)]/55 bg-[var(--danger-soft)] px-4 py-4 shadow-[0_0_40px_-12px_rgba(232,93,93,0.45)] sm:px-5 sm:py-5"
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[var(--danger)]">
                        Season fee not paid
                      </p>
                      <p className="mt-1 text-base font-semibold text-[var(--foreground)] sm:text-lg">
                        {feeCollectionSummary.unpaidPlayers.length}{" "}
                        {feeCollectionSummary.unpaidPlayers.length === 1
                          ? "player still owes"
                          : "players still owe"}{" "}
                        <span className="tabular-nums text-[var(--danger)]">
                          {formatMoney(feeCollectionSummary.totalShortfall)}
                        </span>{" "}
                        in fees
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Highlighted in red in Players &amp; fees below — collect
                        before treating the season as fully funded.
                      </p>
                    </div>
                  </div>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {feeCollectionSummary.unpaidPlayers.map((b) => (
                      <li
                        key={b.playerId}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--danger)]/40 bg-[var(--background)]/80 px-3 py-1.5 text-sm font-medium text-[var(--foreground)]"
                      >
                        <span>{b.name}</span>
                        <span className="tabular-nums text-[var(--danger)]">
                          {formatMoney(b.feeShortfall)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {totals &&
              paybackOwedSummary.owedPlayers.length > 0 &&
              season.players.length > 0 ? (
                <div
                  className="rounded-2xl border-2 border-[var(--warn)]/55 bg-[var(--warn-soft)] px-4 py-4 shadow-[0_0_40px_-12px_rgba(232,184,74,0.35)] sm:px-5 sm:py-5"
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[var(--warn)]">
                        Owed money
                      </p>
                      <p className="mt-1 text-base font-semibold text-[var(--foreground)] sm:text-lg">
                        The pool still owes{" "}
                        <span className="tabular-nums text-[var(--warn)]">
                          {formatMoney(paybackOwedSummary.totalOwed)}
                        </span>{" "}
                        to{" "}
                        {paybackOwedSummary.owedPlayers.length === 1
                          ? "1 player"
                          : `${paybackOwedSummary.owedPlayers.length} players`}{" "}
                        for reimbursed expenses.
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Highlighted in amber in Players &amp; fees below — separate
                        from season fees.
                      </p>
                    </div>
                  </div>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {paybackOwedSummary.owedPlayers.map((b) => (
                      <li
                        key={b.playerId}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--warn)]/45 bg-[var(--background)]/80 px-3 py-1.5 text-sm font-medium text-[var(--foreground)]"
                      >
                        <span>{b.name}</span>
                        <span className="tabular-nums text-[var(--warn)]">
                          {formatMoney(b.reimbursementOutstanding)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            {!isViewer && totals && season.players.length > 0 ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)] sm:p-5">
                <h3 className="text-sm font-semibold text-[var(--foreground)]">
                  Outstanding fees &amp; paybacks
                </h3>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Red rows = unpaid season fee. Amber = payback from the pool still
                  owed (fee may already be paid).
                </p>
                {outstandingBalanceRows.length === 0 ? (
                  <p className="mt-3 text-sm text-[var(--muted)]">
                    No one owes a fee and no paybacks are pending — all square.
                  </p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[280px] border-separate border-spacing-y-2 text-left text-xs sm:text-sm">
                      <thead className="text-[var(--muted)]">
                        <tr>
                          <th className="pb-0 pr-3 pl-1 font-medium">Player</th>
                          <th className="pb-0 pr-3 font-medium">Fee</th>
                          <th className="pb-0 pl-1 font-medium">Payback</th>
                        </tr>
                      </thead>
                      <tbody>
                        {outstandingBalanceRows.map((b) => {
                          const unpaid = b.feeShortfall > 0.005;
                          const due =
                            !b.isTreasurer &&
                            b.reimbursementOutstanding > 0.005;
                          const rowTone = unpaid
                            ? "border-l-4 border-l-[var(--danger)] bg-[var(--danger-soft)] ring-1 ring-inset ring-[var(--danger)]/25"
                            : due
                              ? "border-l-4 border-l-[var(--warn)] bg-[var(--warn-soft)] ring-1 ring-inset ring-[var(--warn)]/20"
                              : "border-[var(--border)]/50 bg-[var(--background)]/30";
                          return (
                            <tr
                              key={b.playerId}
                              className={`rounded-xl ${rowTone}`}
                            >
                              <td className="rounded-l-xl py-3 pr-3 pl-3 font-medium">
                                {b.name}
                                {b.isTreasurer ? (
                                  <span className="ml-1.5 align-middle rounded bg-[var(--muted)]/20 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-[var(--muted)]">
                                    Treasurer
                                  </span>
                                ) : null}
                              </td>
                              <td
                                className={`py-3 pr-3 tabular-nums ${
                                  unpaid
                                    ? "font-semibold text-[var(--danger)]"
                                    : "text-[var(--muted)]"
                                }`}
                              >
                                {unpaid
                                  ? `${formatMoney(b.feeShortfall)} due`
                                  : "Paid"}
                              </td>
                              <td
                                className={`rounded-r-xl py-3 pl-1 pr-3 tabular-nums ${
                                  due
                                    ? "font-semibold text-[var(--warn)]"
                                    : "text-[var(--muted)]"
                                }`}
                              >
                                {b.isTreasurer
                                  ? "—"
                                  : due
                                    ? formatMoney(b.reimbursementOutstanding)
                                    : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}
          </section>

                <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">Players & fees</h3>
              {!isViewer ? (
                <button
                  type="button"
                  onClick={addPlayer}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
                >
                  Add player
                </button>
              ) : null}
            </div>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full min-w-[640px] text-left text-xs sm:text-sm">
                <thead className="border-b border-[var(--border)] bg-[var(--card)] text-xs uppercase text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-2">Player</th>
                    <th className="px-3 py-2">Fee status</th>
                    <th className="px-3 py-2">Paid ($)</th>
                    <th className="px-3 py-2">Reimbursement</th>
                    {!isViewer ? <th className="px-3 py-2" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {totals?.playerBalances.map((b) => {
                    const unpaid = b.feeShortfall > 0.005;
                    const hasOop = b.outOfPocket > 0.005;
                    const due = !b.isTreasurer && b.reimbursementOutstanding > 0.005;
                    const name =
                      season.players.find((p) => p.id === b.playerId)?.name ?? "";
                    return (
                      <tr
                        key={b.playerId}
                        className={
                          unpaid
                            ? "border-b border-[var(--border)]/40 bg-[var(--danger-soft)] ring-1 ring-inset ring-[var(--danger)]/20 [box-shadow:inset_4px_0_0_0_var(--danger)]"
                            : due
                              ? "border-b border-[var(--border)]/40 bg-[var(--warn-soft)] ring-1 ring-inset ring-[var(--warn)]/15 [box-shadow:inset_4px_0_0_0_var(--warn)]"
                              : "border-b border-[var(--border)]/60"
                        }
                      >
                        <td className="px-3 py-2">
                          {isViewer ? (
                            <span className="font-medium">{name}</span>
                          ) : (
                            <input
                              className="w-full max-w-[160px] rounded border border-transparent bg-transparent px-1 py-0.5 hover:border-[var(--border)]"
                              value={name}
                              onChange={(e) =>
                                updatePlayer(b.playerId, {
                                  name: e.target.value,
                                })
                              }
                            />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {unpaid ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--danger)]/35 bg-[var(--background)]/60 px-2.5 py-1 text-xs font-semibold text-[var(--danger)]">
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--danger)]"
                                aria-hidden
                              />
                              Owes {formatMoney(b.feeShortfall)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--accent)]/25 bg-[var(--accent)]/12 px-2.5 py-1 text-xs font-medium text-[var(--accent)]">
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"
                                aria-hidden
                              />
                              Fee paid
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {isViewer ? (
                            <span className="tabular-nums">
                              {formatMoney(b.feePaid)}
                            </span>
                          ) : (
                            <>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                className="w-24 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1"
                                value={b.feePaid}
                                onChange={(e) =>
                                  updatePlayer(b.playerId, {
                                    feePaid:
                                      Number.parseFloat(e.target.value) || 0,
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
                            </>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {b.isTreasurer ? (
                            <span className="text-sm text-[var(--muted)]">
                              Not tracked — treasurer / fee collector
                            </span>
                          ) : hasOop ? (
                            <div className="max-w-[220px] space-y-2">
                              <p className="text-xs text-[var(--muted)]">
                                Fronted {formatMoney(b.outOfPocket)} · Settled{" "}
                                {formatMoney(b.reimbursementSettled)}
                                {due ? (
                                  <span className="font-medium text-[var(--warn)]">
                                    {" "}
                                    · Still due{" "}
                                    {formatMoney(b.reimbursementOutstanding)}
                                  </span>
                                ) : (
                                  <span className="text-[var(--accent)]">
                                    {" "}
                                    · Fully settled
                                  </span>
                                )}
                              </p>
                              {due && !isViewer ? (
                                <div className="flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => settleReimburseFull(b.playerId)}
                                    className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs font-medium"
                                  >
                                    Settle all
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      settleReimbursePartial(b.playerId)
                                    }
                                    className="rounded border border-[var(--border)] px-2 py-1 text-xs"
                                  >
                                    Record partial…
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-[var(--muted)]">—</span>
                          )}
                        </td>
                        {!isViewer ? (
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => removePlayer(b.playerId)}
                              className="text-xs text-[var(--muted)] hover:text-[var(--danger)]"
                            >
                              Remove
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[var(--muted)]">
              {isViewer ? (
                <>
                  View only — admins update fees, settlements, and roster in
                  Audit. Expenses hit the pool (see Overview); reimbursement
                  shows what the team still owes someone who fronted costs.
                </>
              ) : (
                <>
                  Expenses hit the pool (see Overview). Reimbursement tracks what you
                  still owe someone for what they fronted — use{" "}
                  <strong className="text-[var(--foreground)]">Settle all</strong> or{" "}
                  <strong className="text-[var(--foreground)]">Record partial</strong>{" "}
                  when paid from the pool. Choose the treasurer under{" "}
                  <strong className="text-[var(--foreground)]">Audit → Season settings</strong>{" "}
                  if they collect fees and should not be owed payback from the pool.
                  Season fee is separate (Fee status).
                </>
              )}
            </p>
          </section>
              </>
            ) : null}

            {activeTab === "umpiring" ? (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Umpiring schedule</h2>
                <p className="text-sm text-[var(--muted)]">
                  Div-2 fixtures where the league lists{" "}
                  <strong className="text-[var(--foreground)]">
                    Garden State 11
                  </strong>{" "}
                  or{" "}
                  <strong className="text-[var(--foreground)]">
                    Garden State Tigers
                  </strong>{" "}
                  as the umpiring side. Assign a roster player for each match
                  (saved with your finance data).
                </p>
                {season.players.length === 0 ? (
                  <p className="text-sm text-[var(--warn)]">
                    Add players to this season (Dashboard or Audit) to assign
                    umpires.
                  </p>
                ) : null}
                {umpiringScheduleRows.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    No club umpiring rows in the embedded schedule.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                    <table className="w-full min-w-[56rem] text-left text-xs sm:text-sm">
                      <thead className="border-b border-[var(--border)] bg-[var(--card)] text-xs uppercase text-[var(--muted)]">
                        <tr>
                          <th className="px-3 py-2">Week</th>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Match</th>
                          <th className="px-3 py-2">Home team</th>
                          <th className="px-3 py-2">League umpiring</th>
                          <th className="px-3 py-2 min-w-[10rem]">Assign to</th>
                        </tr>
                      </thead>
                      <tbody>
                        {umpiringScheduleRows.map((r) => {
                          const mk = div2MatchKey(r);
                          const assigned =
                            state.umpiringAssignments?.[mk] ?? "";
                          const ghost =
                            assigned !== "" &&
                            !season.players.some((p) => p.id === assigned);
                          return (
                            <tr
                              key={mk}
                              className="border-b border-[var(--border)]/60"
                            >
                              <td className="px-3 py-2 tabular-nums text-[var(--muted)]">
                                {r.week}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-[var(--muted)]">
                                {r.date}
                              </td>
                              <td className="px-3 py-2 font-medium">
                                {r.div2a} vs {r.div2d}
                              </td>
                              <td className="px-3 py-2">{r.homeTeam}</td>
                              <td className="px-3 py-2 text-[var(--muted)]">
                                {r.umpiringTeam}
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  className="min-h-9 w-full max-w-[14rem] rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs sm:text-sm"
                                  disabled={
                                    umpiringBusy || season.players.length === 0
                                  }
                                  value={assigned}
                                  onChange={(e) =>
                                    void onUmpiringAssign(mk, e.target.value)
                                  }
                                  aria-label={`Assign umpire for week ${r.week} ${r.date}`}
                                >
                                  <option value="">— Unassigned —</option>
                                  {ghost ? (
                                    <option value={assigned}>
                                      (removed from roster)
                                    </option>
                                  ) : null}
                                  {season.players.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
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
                          {!isViewer ? (
                            <th className="px-3 py-2 text-right" />
                          ) : null}
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
                              {!isViewer ? (
                                <td className="px-3 py-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() => removeExpense(e.id)}
                                    className="text-xs text-[var(--danger)] hover:underline"
                                  >
                                    Delete
                                  </button>
                                </td>
                              ) : null}
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
                onClick={() => void addExpense()}
                disabled={season.players.length === 0 || expenseBusy}
                className="min-h-12 w-full rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-10 sm:w-auto sm:py-2"
              >
                {expenseBusy ? "Saving…" : "Record expense"}
              </button>
                </div>
              </section>
            ) : null}

            {activeTab === "audit" ? (
              <div className="space-y-6">
                {auditFlash ? (
                  <div
                    role="status"
                    className={
                      auditFlash.variant === "error"
                        ? "rounded-xl border border-[var(--danger)]/50 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--foreground)]"
                        : "rounded-xl border border-[var(--accent)]/45 bg-[var(--accent)]/12 px-4 py-3 text-sm text-[var(--foreground)]"
                    }
                  >
                    {auditFlash.message}
                  </div>
                ) : null}
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
                  <h3 className="font-semibold">Expense notifications</h3>
                  <p className="text-sm text-[var(--muted)]">
                    Free push alerts via{" "}
                    <a
                      href="https://ntfy.sh"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent)] underline-offset-2 hover:underline"
                    >
                      ntfy.sh
                    </a>
                    : install the ntfy app, subscribe to the{" "}
                    <strong className="text-[var(--foreground)]">exact topic</strong>{" "}
                    you save here (1–64 chars: letters, numbers,{" "}
                    <code className="rounded bg-[var(--background)] px-1 font-mono text-xs">
                      _
                    </code>
                    ,{" "}
                    <code className="rounded bg-[var(--background)] px-1 font-mono text-xs">
                      -
                    </code>
                    ). Anyone who knows the topic can see messages — use a long random
                    topic. Optional server fallback:{" "}
                    <code className="rounded bg-[var(--background)] px-1 font-mono text-xs">
                      EXPENSE_NTFY_TOPIC
                    </code>
                    .
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                    <label className="block min-w-[200px] flex-1 text-sm">
                      <span className="text-[var(--muted)]">ntfy topic</span>
                      <input
                        type="text"
                        autoComplete="off"
                        spellCheck={false}
                        className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm sm:min-h-10"
                        value={expenseNtfyTopicDraft}
                        onChange={(e) =>
                          setExpenseNtfyTopicDraft(e.target.value)
                        }
                        placeholder="gs11-your-secret-topic"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={generateExpenseNtfyTopic}
                      className="min-h-11 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm sm:min-h-10"
                    >
                      Generate topic
                    </button>
                    <button
                      type="button"
                      onClick={saveExpenseNtfyTopic}
                      className="min-h-11 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white sm:min-h-10"
                    >
                      Save topic
                    </button>
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
                  <div className="mt-4 border-t border-[var(--border)] pt-4">
                    <label className="block text-sm">
                      <span className="text-[var(--muted)]">
                        Treasurer / admin (collects fees; no payback tracked from
                        pool)
                      </span>
                      <select
                        className="mt-1 min-h-11 w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 sm:min-h-10"
                        value={
                          season.players.find((p) => p.isTreasurer)?.id ?? ""
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          setSeasonTreasurer(v === "" ? null : v);
                        }}
                      >
                        <option value="">— None —</option>
                        {season.players.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      One person per season. They can still owe a season fee like
                      anyone else; only expense payback from the shared pool is
                      skipped for them.
                    </p>
                  </div>
                  {season.carryOverFromSeasonId ? (
                    <p className="mt-4 text-xs text-[var(--muted)]">
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
                        Clear local
                      </button>
                    ) : null}
                  </div>
                  <p className="text-sm text-[var(--muted)]">
                    Each change saves the previous full state. This browser keeps the{" "}
                    {SNAPSHOT_MAX_STORED} most recent backups
                    {remoteMode
                      ? "; older ones are archived on the team server when you’re signed in."
                      : "."}
                  </p>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                    Recent ({snapshots.length}/{SNAPSHOT_MAX_STORED} in this browser)
                  </p>
                  {snapshots.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">No local snapshots yet.</p>
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

                  {remoteMode ? (
                    <div className="mt-6 border-t border-[var(--border)] pt-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                          Archived on server ({serverArchives.length})
                        </p>
                        {serverArchives.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => void clearServerArchives()}
                            className="text-xs text-[var(--muted)] hover:text-[var(--danger)]"
                          >
                            Clear archived
                          </button>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Older auto-backups (evicted from the {SNAPSHOT_MAX_STORED}-slot
                        list here) while you
                        were signed in. Same team password; not tied to one device.
                      </p>
                      {serverArchives.length === 0 ? (
                        <p className="mt-2 text-sm text-[var(--muted)]">
                          No server archives yet.
                        </p>
                      ) : (
                        <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-sm">
                          {serverArchives.map((s) => (
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
                                  onClick={() => void restoreFromServerArchive(s.id)}
                                  className="text-xs font-medium text-[var(--accent)] hover:underline"
                                >
                                  Restore
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteServerArchive(s.id)}
                                  className="text-xs text-[var(--muted)] hover:text-[var(--danger)]"
                                >
                                  Remove
                                </button>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </section>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
