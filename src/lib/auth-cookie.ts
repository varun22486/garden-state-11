import { createHmac, timingSafeEqual } from "crypto";

const COOKIE = "gs11_finance";

export type FinanceRole = "admin" | "viewer";

export function expectedAdminSessionToken(): string | null {
  const secret = process.env.FINANCE_SESSION_SECRET?.trim();
  const pass = process.env.FINANCE_TEAM_PASSWORD?.trim();
  if (!secret || !pass) return null;
  return createHmac("sha256", secret).update(`admin|${pass}`).digest("hex");
}

export function expectedViewerSessionToken(): string | null {
  const secret = process.env.FINANCE_SESSION_SECRET?.trim();
  const pass = process.env.FINANCE_VIEWER_PASSWORD?.trim();
  if (!secret || !pass) return null;
  return createHmac("sha256", secret).update(`viewer|${pass}`).digest("hex");
}

export function getFinanceRoleFromCookie(
  cookieValue: string | undefined,
): FinanceRole | null {
  if (!cookieValue) return null;
  const admin = expectedAdminSessionToken();
  const viewer = expectedViewerSessionToken();
  try {
    const b = Buffer.from(cookieValue, "utf8");
    if (admin) {
      const a = Buffer.from(admin, "utf8");
      if (a.length === b.length && timingSafeEqual(a, b)) return "admin";
    }
    if (viewer) {
      const v = Buffer.from(viewer, "utf8");
      if (v.length === b.length && timingSafeEqual(v, b)) return "viewer";
    }
  } catch {
    return null;
  }
  return null;
}

export function isValidFinanceSession(cookieValue: string | undefined): boolean {
  return getFinanceRoleFromCookie(cookieValue) !== null;
}

/** @deprecated use expectedAdminSessionToken */
export function expectedSessionToken(): string | null {
  return expectedAdminSessionToken();
}

export { COOKIE as FINANCE_SESSION_COOKIE_NAME };
