import { isAuthorized, isSameOrigin, json, makeSessionCookie, matchesAccessCode } from "../src/server/cloud-auth";

export const config = { runtime: "nodejs" };

export async function GET(request: Request): Promise<Response> {
  return json({ connected: isAuthorized(request) }, isAuthorized(request) ? 200 : 401);
}
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return json({ error: "Origen no autorizado" }, 403);
  if (Number(request.headers.get("content-length") || 0) > 1024) return json({ error: "Solicitud demasiado grande" }, 413);
  try {
    const body = await request.json();
    if (!matchesAccessCode(body?.code)) return json({ error: "Código incorrecto" }, 401);
    return json({ connected: true }, 200, { "Set-Cookie": makeSessionCookie() });
  } catch {
    return json({ error: "Solicitud inválida" }, 400);
  }
}
export async function DELETE(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return json({ error: "Origen no autorizado" }, 403);
  return json({ connected: false }, 200, { "Set-Cookie": "ll_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict" });
}
