import type { Expense, Player, Season } from "./types";

export type PlayerBalance = {
  playerId: string;
  name: string;
  feePaid: number;
  feeRequired: number;
  feeShortfall: number;
  /** Total team expenses this player paid (counts toward refund). */
  outOfPocket: number;
  /** Equal share of all team expenses across all players. */
  expenseShare: number;
  /**
   * outOfPocket − expenseShare only (season fee is separate; not refundable here).
   * Positive → refund pending for team expenses they fronted; negative → owe toward share.
   */
  netBalance: number;
};

export type SeasonTotals = {
  carryOver: number;
  totalFeesCollected: number;
  totalInflows: number;
  totalExpenses: number;
  cashRemaining: number;
  playerCount: number;
  expenseShareEach: number;
  playerBalances: PlayerBalance[];
};

function sumExpensesPaidByPlayer(expenses: Expense[], playerId: string): number {
  return expenses
    .filter((e) => e.paidByPlayerId === playerId)
    .reduce((s, e) => s + e.amount, 0);
}

export function computeSeasonTotals(season: Season): SeasonTotals {
  const totalFeesCollected = season.players.reduce((s, p) => s + p.feePaid, 0);
  const totalExpenses = season.expenses.reduce((s, e) => s + e.amount, 0);
  const carryOver = season.carryOverAmount;
  const totalInflows = carryOver + totalFeesCollected;
  const cashRemaining = totalInflows - totalExpenses;

  const playerCount = season.players.length;
  const expenseShareEach =
    playerCount > 0 ? totalExpenses / playerCount : 0;

  const playerBalances: PlayerBalance[] = season.players.map((p) => {
    const outOfPocket = sumExpensesPaidByPlayer(season.expenses, p.id);
    const feeRequired = season.initialFeePerPlayer;
    const feeShortfall = Math.max(0, feeRequired - p.feePaid);
    const expenseShare = expenseShareEach;
    const netBalance = outOfPocket - expenseShareEach;

    return {
      playerId: p.id,
      name: p.name,
      feePaid: p.feePaid,
      feeRequired,
      feeShortfall,
      outOfPocket,
      expenseShare,
      netBalance,
    };
  });

  return {
    carryOver,
    totalFeesCollected,
    totalInflows,
    totalExpenses,
    cashRemaining,
    playerCount,
    expenseShareEach,
    playerBalances,
  };
}

/** Suggested remaining cash to carry to next season (can be overridden). */
export function suggestedCarryOver(totals: SeasonTotals): number {
  return Math.max(0, totals.cashRemaining);
}

const EPS = 0.005;

export function oweOrRefundLabel(net: number): {
  kind: "even" | "owe" | "refund";
  amount: number;
} {
  if (net > EPS) return { kind: "refund", amount: net };
  if (net < -EPS) return { kind: "owe", amount: -net };
  return { kind: "even", amount: 0 };
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
