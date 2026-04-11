export type ExpenseCategory =
  | "equipment"
  | "field"
  | "umpire"
  | "balls"
  | "food"
  | "other";

export type Player = {
  id: string;
  name: string;
  /** Amount this player has paid toward the season fee (can be partial). */
  feePaid: number;
  /** If false, excluded from equal split of expenses (e.g. injured / guest). */
  splitsExpenses: boolean;
  notes?: string;
};

export type Expense = {
  id: string;
  date: string;
  amount: number;
  description: string;
  paidByPlayerId: string;
  category: ExpenseCategory;
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
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  equipment: "Equipment",
  field: "Field / venue",
  umpire: "Umpire",
  balls: "Balls / kit",
  food: "Food / drinks",
  other: "Other",
};
