import type { Expense, Player, Season } from "./types";

export type PlayerBalance = {
  playerId: string;
  name: string;
  feePaid: number;
  feeRequired: number;
  feeShortfall: number;
  /** Team expenses this player paid out of pocket — reimburse from the main pool when ready. */
  outOfPocket: number;
};

export type SeasonTotals = {
  carryOver: number;
  totalFeesCollected: number;
  totalInflows: number;
  totalExpenses: number;
  cashRemaining: number;
  playerBalances: PlayerBalance[];
};

function sumExpensesPaidByPlayer(expenses: Expense[], playerId: string): number {
  return expenses
    .filter((e) => e.paidByPlayerId === playerId)
    .reduce((s, e) => s + e.amount, 0);
}

/**
 * Pool = carry-over + fees. Expenses reduce the pool (Overview).
 * Players who paid expenses are owed reimbursement from that pool — no per-person "owe" for shares.
 */
export function computeSeasonTotals(season: Season): SeasonTotals {
  const totalFeesCollected = season.players.reduce((s, p) => s + p.feePaid, 0);
  const totalExpenses = season.expenses.reduce((s, e) => s + e.amount, 0);
  const carryOver = season.carryOverAmount;
  const totalInflows = carryOver + totalFeesCollected;
  const cashRemaining = totalInflows - totalExpenses;

  const playerBalances: PlayerBalance[] = season.players.map((p) => {
    const outOfPocket = sumExpensesPaidByPlayer(season.expenses, p.id);
    const feeRequired = season.initialFeePerPlayer;
    const feeShortfall = Math.max(0, feeRequired - p.feePaid);

    return {
      playerId: p.id,
      name: p.name,
      feePaid: p.feePaid,
      feeRequired,
      feeShortfall,
      outOfPocket,
    };
  });

  return {
    carryOver,
    totalFeesCollected,
    totalInflows,
    totalExpenses,
    cashRemaining,
    playerBalances,
  };
}

/** Suggested remaining cash to carry to next season (can be overridden). */
export function suggestedCarryOver(totals: SeasonTotals): number {
  return Math.max(0, totals.cashRemaining);
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function parsePlayerNamesBlob(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Default player row from name (fee starts at 0). */
export function makePlayer(name: string): Player {
  return {
    id: newId(),
    name,
    feePaid: 0,
    splitsExpenses: true,
    notes: undefined,
  };
}
