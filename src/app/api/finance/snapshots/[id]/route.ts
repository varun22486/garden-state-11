import {
  FINANCE_SESSION_COOKIE_NAME,
  getFinanceRoleFromCookie,
} from "@/lib/auth-cookie";
import { normalizeAppState } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function notConfigured() {
  return NextResponse.json(
    { error: "Supabase is not configured" },
    { status: 503 },
  );
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return notConfigured();
  }

  const cookie = (await cookies()).get(FINANCE_SESSION_COOKIE_NAME)?.value;
  const role = getFinanceRoleFromCookie(cookie);
  if (!role) {
    return unauthorized();
  }
  if (role !== "admin") {
    return forbidden();
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const { data: row, error } = await supabaseAdmin
      .from("finance_snapshots")
      .select("id,saved_at,payload")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: row.id,
      savedAt: row.saved_at,
      state: normalizeAppState(row.payload),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return notConfigured();
  }

  const cookie = (await cookies()).get(FINANCE_SESSION_COOKIE_NAME)?.value;
  const role = getFinanceRoleFromCookie(cookie);
  if (!role) {
    return unauthorized();
  }
  if (role !== "admin") {
    return forbidden();
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin.from("finance_snapshots").delete().eq("id", id);
    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
