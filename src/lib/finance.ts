import type { Expense, Player, Season } from "./types";

export type PlayerBalance = {
  playerId: string;
  name: string;
  feePaid: number;
  feeRequired: number;
  feeShortfall: number;
  outOfPocket: number;
  expenseShare: number;
  /**
   * Splitters: feePaid + outOfPocket minus equal share of total expenses.
   * Positive → treasurer pays them from the main pool; negative → they pay into the pool.
   * Non-splitters: null (not in pool settlement).
   */
  netSettlement: number | null;
  splitsExpenses: boolean;
};

export type SeasonTotals = {
  carryOver: number;
  totalFeesCollected: number;
  totalInflows: number;
  totalExpenses: number;
  cashRemaining: number;
  splitCount: number;
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

  const splitters = season.players.filter((p) => p.splitsExpenses);
  const splitCount = splitters.length;
  const expenseShareEach =
    splitCount > 0 ? totalExpenses / splitCount : 0;

  const playerBalances: PlayerBalance[] = season.players.map((p) => {
    const outOfPocket = sumExpensesPaidByPlayer(season.expenses, p.id);
    const feeRequired = season.initialFeePerPlayer;
    const feeShortfall = Math.max(0, feeRequired - p.feePaid);
    const expenseShare = p.splitsExpenses ? expenseShareEach : 0;
    const contribution = p.feePaid + outOfPocket;
    const netSettlement: number | null = p.splitsExpenses
      ? contribution - expenseShareEach
      : null;

    return {
      playerId: p.id,
      name: p.name,
      feePaid: p.feePaid,
      feeRequired,
      feeShortfall,
      outOfPocket,
      expenseShare,
      netSettlement,
      splitsExpenses: p.splitsExpenses,
    };
  });

  return {
    carryOver,
    totalFeesCollected,
    totalInflows,
    totalExpenses,
    cashRemaining,
    splitCount,
    expenseShareEach,
    playerBalances,
  };
}

/** Suggested remaining cash to carry to next season (can be overridden). */
export function suggestedCarryOver(totals: SeasonTotals): number {
  return Math.max(0, totals.cashRemaining);
}

export type PoolSettlementLine = {
  playerId: string;
  name: string;
  amount: number;
};

const ROUND = (n: number) => Math.round(n * 100) / 100;

export type PoolSettlements = {
  /** Treasurer pays these people from the main pool (reimbursement / net credit). */
  receiveFromPool: PoolSettlementLine[];
  /** These people pay into the main pool (net shortfall vs fair share). */
  payToPool: PoolSettlementLine[];
  totalPayOut: number;
  totalCollect: number;
};

/**
 * All settlement runs through the team pool (treasurer): no person-to-person payments.
 */
export function computePoolSettlements(balances: PlayerBalance[]): PoolSettlements {
  const receiveFromPool: PoolSettlementLine[] = [];
  const payToPool: PoolSettlementLine[] = [];

  for (const b of balances) {
    if (b.netSettlement === null) continue;
    if (b.netSettlement > 0.005) {
      receiveFromPool.push({
        playerId: b.playerId,
        name: b.name,
        amount: ROUND(b.netSettlement),
      });
    } else if (b.netSettlement < -0.005) {
      payToPool.push({
        playerId: b.playerId,
        name: b.name,
        amount: ROUND(-b.netSettlement),
      });
    }
  }

  receiveFromPool.sort((a, x) => x.amount - a.amount);
  payToPool.sort((a, x) => x.amount - a.amount);

  const totalPayOut = ROUND(
    receiveFromPool.reduce((s, x) => s + x.amount, 0),
  );
  const totalCollect = ROUND(payToPool.reduce((s, x) => s + x.amount, 0));

  return { receiveFromPool, payToPool, totalPayOut, totalCollect };
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
export function makePlayer(name: string, splitsExpenses = true): Player {
  return {
    id: newId(),
    name,
    feePaid: 0,
    splitsExpenses,
    notes: undefined,
  };
}
