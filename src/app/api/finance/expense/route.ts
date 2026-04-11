import {
  FINANCE_SESSION_COOKIE_NAME,
  getFinanceRoleFromCookie,
  type FinanceRole,
} from "@/lib/auth-cookie";
import {
  resolveExpenseNotifyContextBySeasonId,
  sendExpenseNtfyNotification,
} from "@/lib/expense-notify";
import { defaultAppState, normalizeAppState } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { AppState, Expense } from "@/lib/types";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const DOC_ID = "garden-state-11";

async function notifyExpenseAdded(
  normalized: AppState,
  seasonId: string,
  expense: Expense,
  role: FinanceRole,
) {
  const ctx = resolveExpenseNotifyContextBySeasonId(
    normalized,
    seasonId,
    expense,
    role,
  );
  if (ctx) await sendExpenseNtfyNotification(ctx, normalized);
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function notConfigured() {
  return NextResponse.json(
    { error: "Supabase is not configured" },
    { status: 503 },
  );
}

function isValidExpense(e: unknown): e is Expense {
  if (!e || typeof e !== "object") return false;
  const x = e as Expense;
  return (
    typeof x.id === "string" &&
    x.id.length > 0 &&
    typeof x.date === "string" &&
    typeof x.amount === "number" &&
    Number.isFinite(x.amount) &&
    x.amount > 0 &&
    typeof x.description === "string" &&
    x.description.trim().length > 0 &&
    typeof x.paidByPlayerId === "string" &&
    typeof x.category === "string"
  );
}

function mergeExpenseIntoSeason(
  state: AppState,
  seasonId: string,
  expense: Expense,
): AppState | null {
  const season = state.seasons.find((s) => s.id === seasonId);
  if (!season) return null;
  if (!season.players.some((p) => p.id === expense.paidByPlayerId)) return null;
  if (!state.expenseCategories.some((c) => c.id === expense.category)) return null;
  return {
    ...state,
    seasons: state.seasons.map((s) =>
      s.id === seasonId ? { ...s, expenses: [expense, ...s.expenses] } : s,
    ),
  };
}

/** Admin and viewer: append one expense with revision check (viewer cannot full PUT). */
export async function POST(req: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return notConfigured();
  }

  const cookie = (await cookies()).get(FINANCE_SESSION_COOKIE_NAME)?.value;
  const role = getFinanceRoleFromCookie(cookie);
  if (!role) {
    return unauthorized();
  }

  let body: { seasonId?: string; expense?: unknown; revision?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const seasonId = typeof body.seasonId === "string" ? body.seasonId : "";
  const expense = body.expense;
  const clientRevision =
    typeof body.revision === "number" && Number.isFinite(body.revision)
      ? body.revision
      : -1;

  if (!seasonId || !isValidExpense(expense)) {
    return NextResponse.json({ error: "Invalid expense or season" }, { status: 400 });
  }

  const updatedAt = new Date().toISOString();

  try {
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("finance_state")
      .select("id,payload,revision")
      .eq("id", DOC_ID)
      .maybeSingle();

    if (fetchErr) {
      console.error(fetchErr);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!existing) {
      if (clientRevision !== 0) {
        return NextResponse.json(
          { error: "Conflict", state: defaultAppState(), revision: 0 },
          { status: 409 },
        );
      }
      const base = defaultAppState();
      const merged = mergeExpenseIntoSeason(base, seasonId, expense);
      if (!merged) {
        return NextResponse.json({ error: "Season or data not found" }, { status: 400 });
      }
      const normalized = normalizeAppState(merged);
      const { error: insErr } = await supabaseAdmin.from("finance_state").insert({
        id: DOC_ID,
        payload: normalized,
        revision: 1,
        updated_at: updatedAt,
      });
      if (insErr) {
        console.error(insErr);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }
      await notifyExpenseAdded(normalized, seasonId, expense, role);
      return NextResponse.json({ ok: true, revision: 1 });
    }

    if (existing.revision !== clientRevision) {
      return NextResponse.json(
        {
          error: "Conflict",
          state: normalizeAppState(existing.payload),
          revision: existing.revision,
        },
        { status: 409 },
      );
    }

    const st = normalizeAppState(existing.payload);
    const merged = mergeExpenseIntoSeason(st, seasonId, expense);
    if (!merged) {
      return NextResponse.json({ error: "Season or data not found" }, { status: 400 });
    }
    const normalized = normalizeAppState(merged);
    const nextRev = existing.revision + 1;

    const { data: updatedRows, error: upErr } = await supabaseAdmin
      .from("finance_state")
      .update({
        payload: normalized,
        revision: nextRev,
        updated_at: updatedAt,
      })
      .eq("id", DOC_ID)
      .eq("revision", clientRevision)
      .select("revision");

    if (upErr) {
      console.error(upErr);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!updatedRows?.length) {
      const { data: again } = await supabaseAdmin
        .from("finance_state")
        .select("payload,revision")
        .eq("id", DOC_ID)
        .maybeSingle();
      if (!again) {
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }
      return NextResponse.json(
        {
          error: "Conflict",
          state: normalizeAppState(again.payload),
          revision: again.revision,
        },
        { status: 409 },
      );
    }

    await notifyExpenseAdded(normalized, seasonId, expense, role);
    return NextResponse.json({ ok: true, revision: updatedRows[0].revision });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
