import {
  FINANCE_SESSION_COOKIE_NAME,
  expectedAdminSessionToken,
  expectedViewerSessionToken,
} from "@/lib/auth-cookie";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const adminEnv = process.env.FINANCE_TEAM_PASSWORD?.trim() ?? "";
  const secret = process.env.FINANCE_SESSION_SECRET?.trim() ?? "";
  if (!adminEnv || !secret) {
    return NextResponse.json(
      { error: "Server is not configured for team login" },
      { status: 503 },
    );
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const pw = (body.password ?? "").trim();
  const viewerEnv = process.env.FINANCE_VIEWER_PASSWORD?.trim() ?? "";
  let token: string | null = null;

  if (!pw) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  if (pw === adminEnv) {
    token = expectedAdminSessionToken();
  } else if (viewerEnv && pw === viewerEnv) {
    token = expectedViewerSessionToken();
  } else {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  if (!token) {
    return NextResponse.json({ error: "Session misconfigured" }, { status: 503 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(FINANCE_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
