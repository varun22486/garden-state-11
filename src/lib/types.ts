export type ExpenseCategoryDef = {
  id: string;
  label: string;
};

export type Player = {
  id: string;
  name: string;
  /** Amount this player has paid toward the season fee (can be partial). */
  feePaid: number;
  /** Legacy field; all players share expenses equally in calculations. */
  splitsExpenses: boolean;
  notes?: string;
  /**
   * Treasurer / fee collector: team does not track reimbursement owed to them
   * (they front expenses but are not paid back through the pool in the app).
   */
  isTreasurer?: boolean;
  /** Out-of-pocket expenses already reimbursed from the pool (see Overview cash). */
  reimbursementSettled?: number;
};

export type Expense = {
  id: string;
  date: string;
  amount: number;
  description: string;
  paidByPlayerId: string;
  /** Matches `ExpenseCategoryDef.id` from app settings. */
  category: string;
};

export type Season = {
  id: string;
  label: string;
  createdAt: string;
  /** Expected fee per player for highlighting unpaid status. */
  initialFeePerPlayer: number;
  /** Cash brought forward from prior season (single pool line). */
  carryOverAmount: number;
  /** Optional reference to prior season id (for display only). */
  carryOverFromSeasonId?: string | null;
  players: Player[];
  expenses: Expense[];
};

export type AppState = {
  version: 1;
  seasons: Season[];
  currentSeasonId: string | null;
  /** User-editable expense type list (Audit → Expense types). */
  expenseCategories: ExpenseCategoryDef[];
  /**
   * ntfy.sh topic for push alerts when an expense is added (Audit → Expense notifications).
   * Subscribe to the same topic in the ntfy app. Falls back to EXPENSE_NTFY_TOPIC env.
   */
  expenseNtfyTopic?: string;
  /**
   * Umpiring tab: match key → two optional roster assignments per fixture.
   * Legacy payloads used a single string per key (treated as umpire1).
   */
  umpiringAssignments?: Record<string, UmpiringSlotAssignment>;
};

export type UmpiringSlotAssignment = {
  umpire1?: string;
  umpire2?: string;
};

/**
 * Reads umpire slots; tolerates legacy per-match string values in runtime JSON
 * (older saves) even though the typed state uses objects only.
 */
export function getUmpiringSlots(
  assignments: AppState["umpiringAssignments"],
  matchKey: string,
): { umpire1: string; umpire2: string } {
  const v = assignments?.[matchKey] as
    | UmpiringSlotAssignment
    | string
    | undefined;
  if (typeof v === "string") {
    return { umpire1: v, umpire2: "" };
  }
  if (v && typeof v === "object") {
    return {
      umpire1: v.umpire1 ?? "",
      umpire2: v.umpire2 ?? "",
    };
  }
  return { umpire1: "", umpire2: "" };
}

/** Seeded for new installs and when `expenseCategories` is missing in storage. */
export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategoryDef[] = [
  { id: "equipment", label: "Equipment" },
  { id: "field", label: "Field / venue" },
  { id: "umpire", label: "Umpire" },
  { id: "balls", label: "Balls / kit" },
  { id: "food", label: "Food / drinks" },
  { id: "other", label: "Other" },
];

export function expenseCategoryLabel(
  categories: ExpenseCategoryDef[],
  categoryId: string,
): string {
  return categories.find((c) => c.id === categoryId)?.label ?? categoryId;
}

export function isExpenseCategoryInUse(
  state: AppState,
  categoryId: string,
): boolean {
  return state.seasons.some((s) =>
    s.expenses.some((e) => e.category === categoryId),
  );
}
