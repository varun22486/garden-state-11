import {
  FINANCE_SESSION_COOKIE_NAME,
  getFinanceRoleFromCookie,
} from "@/lib/auth-cookie";
import { clubUmpiringMatchKeySet } from "@/lib/umpiring-schedule";
import { defaultAppState, normalizeAppState } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  getUmpiringSlots,
  type AppState,
  type UmpiringSlotAssignment,
} from "@/lib/types";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const DOC_ID = "garden-state-11";

const ALLOWED_KEYS = clubUmpiringMatchKeySet();

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function notConfigured() {
  return NextResponse.json(
    { error: "Supabase is not configured" },
    { status: 503 },
  );
}

function mergeUmpiringAssignment(
  state: AppState,
  seasonId: string,
  matchKey: string,
  slot: 1 | 2,
  playerId: string | null,
): AppState | null {
  const season = state.seasons.find((s) => s.id === seasonId);
  if (!season) return null;
  if (!ALLOWED_KEYS.has(matchKey)) return null;
  if (
    playerId != null &&
    playerId !== "" &&
    !season.players.some((p) => p.id === playerId)
  ) {
    return null;
  }
  const base = { ...(state.umpiringAssignments ?? {}) };
  const cur = getUmpiringSlots(base, matchKey);
  const next1 =
    slot === 1
      ? playerId && playerId.length > 0
        ? playerId
        : ""
      : cur.umpire1;
  const next2 =
    slot === 2
      ? playerId && playerId.length > 0
        ? playerId
        : ""
      : cur.umpire2;
  const entry: UmpiringSlotAssignment = {};
  if (next1) entry.umpire1 = next1;
  if (next2) entry.umpire2 = next2;
  const nextMap = { ...base };
  if (!entry.umpire1 && !entry.umpire2) {
    delete nextMap[matchKey];
  } else {
    nextMap[matchKey] = entry;
  }
  return {
    ...state,
    umpiringAssignments: nextMap,
  };
}

/** Admin and viewer: set or clear one umpiring assignment with revision check. */
export async function POST(req: Request) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return notConfigured();
  }

  const cookie = (await cookies()).get(FINANCE_SESSION_COOKIE_NAME)?.value;
  if (!getFinanceRoleFromCookie(cookie)) {
    return unauthorized();
  }

  let body: {
    seasonId?: string;
    matchKey?: string;
    slot?: number;
    playerId?: string | null;
    revision?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const seasonId = typeof body.seasonId === "string" ? body.seasonId : "";
  const matchKey = typeof body.matchKey === "string" ? body.matchKey : "";
  let playerId: string | null = null;
  if (
    body.playerId === null ||
    body.playerId === undefined ||
    body.playerId === ""
  ) {
    playerId = null;
  } else if (typeof body.playerId === "string") {
    playerId = body.playerId;
  } else {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const clientRevision =
    typeof body.revision === "number" && Number.isFinite(body.revision)
      ? body.revision
      : -1;

  const slot = body.slot === 1 || body.slot === 2 ? body.slot : null;
  if (!seasonId || !matchKey || slot == null) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
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
      const merged = mergeUmpiringAssignment(
        base,
        seasonId,
        matchKey,
        slot,
        playerId,
      );
      if (!merged) {
        return NextResponse.json({ error: "Season or match not found" }, { status: 400 });
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
    const merged = mergeUmpiringAssignment(st, seasonId, matchKey, slot, playerId);
    if (!merged) {
      return NextResponse.json({ error: "Season or match not found" }, { status: 400 });
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

    return NextResponse.json({ ok: true, revision: updatedRows[0].revision });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
