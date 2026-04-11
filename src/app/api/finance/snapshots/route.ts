import {
  FINANCE_SESSION_COOKIE_NAME,
  getFinanceRoleFromCookie,
} from "@/lib/auth-cookie";
import { normalizeAppState } from "@/lib/storage";
import type { AppState } from "@/lib/types";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const MAX_ARCHIVED_ROWS = 400;

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

async function pruneOldestArchives() {
  const { count, error: cErr } = await supabaseAdmin
    .from("finance_snapshots")
    .select("*", { count: "exact", head: true });
  if (cErr || count == null || count <= MAX_ARCHIVED_ROWS) return;

  const excess = count - MAX_ARCHIVED_ROWS;
  const { data: oldest, error: oErr } = await supabaseAdmin
    .from("finance_snapshots")
    .select("id")
    .order("saved_at", { ascending: true })
    .limit(excess);
  if (oErr || !oldest?.length) return;
  const ids = oldest.map((r) => r.id);
  await supabaseAdmin.from("finance_snapshots").delete().in("id", ids);
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
  if (role !== "admin") {
    return forbidden();
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("finance_snapshots")
      .select("id,saved_at")
      .order("saved_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const snapshots = (data ?? []).map((row) => ({
      id: row.id,
      savedAt: row.saved_at,
    }));

    return NextResponse.json({ snapshots });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
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

  let body: { id?: string; savedAt?: string; state?: AppState };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  const savedAt = typeof body.savedAt === "string" ? body.savedAt : "";
  const st = body.state;
  if (
    !id ||
    !savedAt ||
    !st ||
    st.version !== 1 ||
    !Array.isArray(st.seasons)
  ) {
    return NextResponse.json({ error: "Invalid snapshot" }, { status: 400 });
  }

  const normalized = normalizeAppState(st);

  try {
    const { error: insErr } = await supabaseAdmin.from("finance_snapshots").insert({
      id,
      saved_at: savedAt,
      payload: normalized,
    });

    if (insErr) {
      if (insErr.code === "23505") {
        return NextResponse.json({ ok: true, duplicate: true });
      }
      console.error(insErr);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    await pruneOldestArchives();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
