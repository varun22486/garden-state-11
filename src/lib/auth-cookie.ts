import { createHmac, timingSafeEqual } from "crypto";

const COOKIE = "gs11_finance";

export function expectedSessionToken(): string | null {
  const secret = process.env.FINANCE_SESSION_SECRET;
  const pass = process.env.FINANCE_TEAM_PASSWORD;
  if (!secret || !pass) return null;
  return createHmac("sha256", secret).update(pass).digest("hex");
}

export function isValidFinanceSession(cookieValue: string | undefined): boolean {
  const expected = expectedSessionToken();
  if (!expected || !cookieValue) return false;
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(cookieValue, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export { COOKIE as FINANCE_SESSION_COOKIE_NAME };
