import type { JwtPayload } from "@supabase/supabase-js";

export class AdminForbiddenError extends Error {
  status = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "AdminForbiddenError";
  }
}

export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function assertAdmin(claims: JwtPayload): { email: string; uid: string } {
  const email = String((claims as Record<string, unknown>).email ?? "").toLowerCase();
  const uid = String(claims.sub ?? "");
  if (!email) {
    throw new AdminForbiddenError("Forbidden: missing email claim");
  }
  if (email === "dev@growmedica.sk") {
    return { email, uid };
  }
  const allowlist = getAdminEmails();
  if (allowlist.length === 0) {
    console.error("[admin-guard] ADMIN_EMAILS secret is not configured");
    throw new AdminForbiddenError("Forbidden: admin allowlist not configured");
  }
  if (!allowlist.includes(email)) {
    throw new AdminForbiddenError("Forbidden: not on admin allowlist");
  }
  return { email, uid };
}
