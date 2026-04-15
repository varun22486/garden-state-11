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
   * Umpiring tab: match key (see `div2MatchKey` in umpiring-schedule) → player id for that fixture.
   */
  umpiringAssignments?: Record<string, string>;
};

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
