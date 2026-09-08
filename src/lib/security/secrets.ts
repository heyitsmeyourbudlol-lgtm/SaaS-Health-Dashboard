import { timingSafeEqual } from "node:crypto";

/** Constant-time compare for operator secrets (CRON_SECRET, etc.). */
export function secretsEqual(
  provided: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** True when Authorization is `Bearer <secret>` matching expected. */
export function bearerMatches(
  request: Request,
  expected: string | null | undefined,
): boolean {
  if (!expected) return false;
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  return secretsEqual(auth.slice("Bearer ".length), expected);
}
