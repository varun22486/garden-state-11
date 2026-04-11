import { formatMoney } from "@/lib/finance";
import type { AppState, Expense } from "@/lib/types";
import { expenseCategoryLabel } from "@/lib/types";

export type ExpenseNotifyContext = {
  expense: Expense;
  seasonLabel: string;
  paidByName: string;
  categoryLabel: string;
  role: "admin" | "viewer";
};

/** ntfy topic: letters, digits, underscore, hyphen; length for a usable secret. */
const TOPIC_RE = /^[a-zA-Z0-9_-]{8,64}$/;

/**
 * Topic path for ntfy (Audit → Expense notifications), then env EXPENSE_NTFY_TOPIC.
 * @see https://ntfy.sh — free push; install the app and subscribe to the same topic.
 */
export function resolveNtfyTopic(state: AppState): string | null {
  const fromState = state.expenseNtfyTopic?.trim();
  if (fromState && TOPIC_RE.test(fromState)) {
    return fromState;
  }
  const fromEnv = process.env.EXPENSE_NTFY_TOPIC?.trim();
  if (fromEnv && TOPIC_RE.test(fromEnv)) {
    return fromEnv;
  }
  return null;
}

export function buildExpenseNtfyBody(ctx: ExpenseNotifyContext): string {
  const roleLabel = ctx.role === "viewer" ? "Viewer (expense-only)" : "Admin";
  const amount = formatMoney(ctx.expense.amount);
  const lines = [
    `${amount} — ${ctx.expense.description}`,
    "",
    `Season: ${ctx.seasonLabel}`,
    `Date: ${ctx.expense.date}`,
    `Paid by: ${ctx.paidByName}`,
    `Category: ${ctx.categoryLabel}`,
    `Submitted as: ${roleLabel}`,
  ];
  return lines.join("\n");
}

function collectExpenseIdSet(state: AppState): Set<string> {
  const ids = new Set<string>();
  for (const s of state.seasons) {
    for (const e of s.expenses) {
      ids.add(e.id);
    }
  }
  return ids;
}

/** Expenses present in `next` but not in `prev`. If `prev` is null, returns all expenses in `next`. */
export function listNewExpenses(
  prev: AppState | null,
  next: AppState,
): { seasonId: string; expense: Expense }[] {
  const prevIds = prev ? collectExpenseIdSet(prev) : new Set<string>();
  const out: { seasonId: string; expense: Expense }[] = [];
  for (const s of next.seasons) {
    for (const e of s.expenses) {
      if (!prevIds.has(e.id)) {
        out.push({ seasonId: s.id, expense: e });
      }
    }
  }
  return out;
}

export function resolveExpenseNotifyContextBySeasonId(
  state: AppState,
  seasonId: string,
  expense: Expense,
  role: "admin" | "viewer",
): ExpenseNotifyContext | null {
  const season = state.seasons.find((s) => s.id === seasonId);
  if (!season) return null;
  const player = season.players.find((p) => p.id === expense.paidByPlayerId);
  return {
    expense,
    seasonLabel: season.label,
    paidByName: player?.name?.trim() || "Unknown player",
    categoryLabel: expenseCategoryLabel(state.expenseCategories, expense.category),
    role,
  };
}

/**
 * Sends a push via ntfy (no API key on public ntfy.sh). Optional NTFY_BASE_URL for self-hosting.
 * Never throws; logs errors. Skips if topic is not configured.
 */
export async function sendExpenseNtfyNotification(
  ctx: ExpenseNotifyContext,
  state: AppState,
): Promise<void> {
  const topic = resolveNtfyTopic(state);
  if (!topic) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[expense-notify] No ntfy topic — set Audit → Expense notifications or EXPENSE_NTFY_TOPIC",
      );
    }
    return;
  }

  const base =
    process.env.NTFY_BASE_URL?.trim().replace(/\/+$/, "") || "https://ntfy.sh";
  const url = `${base}/${encodeURIComponent(topic)}`;
  const amount = formatMoney(ctx.expense.amount);
  const title = `[GS11] ${amount} — ${ctx.expense.description.slice(0, 56)}${ctx.expense.description.length > 56 ? "…" : ""}`;
  const body = buildExpenseNtfyBody(ctx);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Title: title,
        Priority: "default",
        Tags: "money,receipt",
        "Content-Type": "text/plain; charset=utf-8",
      },
      body,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[expense-notify] ntfy error", res.status, errText);
    }
  } catch (e) {
    console.error("[expense-notify] Failed to send", e);
  }
}
