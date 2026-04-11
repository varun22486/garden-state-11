import {
  FINANCE_SESSION_COOKIE_NAME,
  getFinanceRoleFromCookie,
  type FinanceRole,
} from "@/lib/auth-cookie";
import {
  listNewExpenses,
  resolveExpenseNotifyContextBySeasonId,
  sendExpenseNtfyNotification,
} from "@/lib/expense-notify";
import { defaultAppState, normalizeAppState } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { AppState } from "@/lib/types";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const DOC_ID = "garden-state-11";

const MAX_EXPENSE_NOTIFY_PER_SAVE = 25;

async function notifyNewExpensesFromPut(
  prev: AppState | null,
  next: AppState,
  role: FinanceRole,
) {
  const added = listNewExpenses(prev, next);
  const slice = added.slice(0, MAX_EXPENSE_NOTIFY_PER_SAVE);
  for (const { seasonId, expense } of slice) {
    const ctx = resolveExpenseNotifyContextBySeasonId(
      next,
      seasonId,
      expense,
      role,
    );
    if (ctx) await sendExpenseNtfyNotification(ctx, next);
  }
  if (added.length > slice.length) {
    console.warn(
      `[expense-notify] Skipped ${added.length - slice.length} notification(s); max ${MAX_EXPENSE_NOTIFY_PER_SAVE} per save`,
    );
  }
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

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return notConfigured();
  }

  const cookie = (await cookies()).get(FINANCE_SESSION_COOKIE_NAME)?.value;
  const role = getFinanceRoleFromCookie(cookie);
  if (!role) {
    return unauthorized();
  }

  try {
    const { data: row, error } = await supabaseAdmin
      .from("finance_state")
      .select("payload,revision")
      .eq("id", DOC_ID)
      .maybeSingle();

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!row) {
      return NextResponse.json({
        state: defaultAppState(),
        revision: 0,
        role,
      });
    }

    return NextResponse.json({
      state: normalizeAppState(row.payload),
      revision: row.revision,
      role,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return notConfigured();
  }

  const cookie = (await cookies()).get(FINANCE_SESSION_COOKIE_NAME)?.value;
  const role = getFinanceRoleFromCookie(cookie);
  if (!role) {
    return unauthorized();
  }
  if (role !== "admin") {
    return NextResponse.json(
      { error: "Only admins can save full changes" },
      { status: 403 },
    );
  }

  let body: { state?: AppState; revision?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const clientState = body.state;
  const clientRevision =
    typeof body.revision === "number" && Number.isFinite(body.revision)
      ? body.revision
      : -1;

  if (!clientState || clientState.version !== 1 || !Array.isArray(clientState.seasons)) {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  const normalized = normalizeAppState(clientState);
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

      const { error: insErr } = await supabaseAdmin.from("finance_state").insert({
        id: DOC_ID,
        payload: normalized,
        revision: 1,
        updated_at: updatedAt,
      });

      if (insErr) {
        if (insErr.code === "23505") {
          const { data: again } = await supabaseAdmin
            .from("finance_state")
            .select("payload,revision")
            .eq("id", DOC_ID)
            .single();
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
        console.error(insErr);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }

      await notifyNewExpensesFromPut(null, normalized, role);
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

    await notifyNewExpensesFromPut(
      normalizeAppState(existing.payload),
      normalized,
      role,
    );
    return NextResponse.json({ ok: true, revision: updatedRows[0].revision });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
