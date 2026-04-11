import { FINANCE_SESSION_COOKIE_NAME, expectedSessionToken } from "@/lib/auth-cookie";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  if (!process.env.FINANCE_TEAM_PASSWORD || !process.env.FINANCE_SESSION_SECRET) {
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

  if (body.password !== process.env.FINANCE_TEAM_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = expectedSessionToken();
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
