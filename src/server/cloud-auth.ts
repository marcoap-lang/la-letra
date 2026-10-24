import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
function sign(payload: string): string {
  const secret = process.env.LA_LETRA_SESSION_SECRET;
  if (!secret) throw new Error("Missing session secret");
  return createHmac("sha256", secret).update(payload).digest("hex");
}
export function isAuthorized(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)ll_session=([^;]+)/);
  if (!match) return false;
  const token = decodeURIComponent(match[1]);
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const expires = Number(parts[1]);
  if (!Number.isSafeInteger(expires) || expires <= Math.floor(Date.now() / 1000)) return false;
  try {
    return safeEqual(parts[2], sign(`v1.${parts[1]}`));
  } catch {
    return false;
  }
}
export function matchesAccessCode(value: unknown): boolean {
  if (typeof value !== "string" || value.length > 128) return false;
  const expected = process.env.LA_LETRA_ACCESS_SHA256 ?? "";
  const actual = createHash("sha256").update(value.trim().toUpperCase()).digest("hex");
  return expected.length === 64 && safeEqual(actual, expected);
}
export function makeSessionCookie(): string {
  const expiration = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const body = `v1.${expiration}`;
  return `ll_session=${body}.${sign(body)}; Max-Age=${MAX_AGE_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}
export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store, private", ...headers } });
}
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  return origin === url.origin;
}
