import { get, list, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { isAuthorized, isSameOrigin, json } from "../src/server/cloud-auth.js";

export const config = { runtime: "nodejs", maxDuration: 30 };
type Entry = { pathname: string; uploadedAt: Date | string };
async function latestEntry(): Promise<Entry | null> {
  let cursor: string | undefined;
  let latest: Entry | null = null;
  let iterations = 0;
  do {
    const result = await list({ prefix: "backups/", cursor, limit: 1000 });
    for (const blob of result.blobs) {
      const candidate = { pathname: blob.pathname, uploadedAt: blob.uploadedAt };
      if (!latest || new Date(candidate.uploadedAt).getTime() > new Date(latest.uploadedAt).getTime()) latest = candidate;
    }
    cursor = result.hasMore ? result.cursor : undefined;
    iterations += 1;
  } while (cursor && iterations < 20);
  return latest;
}
function isSnapshot(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (s.version === 1 || s.version === 2) &&
    Array.isArray(s.drawers) && Array.isArray(s.types) &&
    Array.isArray(s.customers) && Array.isArray(s.jobs) &&
    Array.isArray(s.payments) && typeof s.nextNumber === "number" &&
    (!s.goods || Array.isArray(s.goods)) && (!s.sales || Array.isArray(s.sales));
}
export async function GET(request: Request): Promise<Response> {
  if (!isAuthorized(request)) return json({ error: "Acceso requerido" }, 401);
  try {
    const entry = await latestEntry();
    if (!entry) return json({ revision: null, snapshot: null });
    if (new URL(request.url).searchParams.get("meta") === "1") return json({ revision: entry.pathname });
    const blob = await get(entry.pathname, { access: "private" });
    if (!blob || blob.statusCode !== 200 || !blob.stream) return json({ error: "Copia no disponible" }, 503);
    const payload = await new Response(blob.stream).json();
    if (!isSnapshot(payload.snapshot)) return json({ error: "Copia inválida" }, 503);
    return json({ revision: entry.pathname, snapshot: payload.snapshot, savedAt: payload.savedAt });
  } catch {
    return json({ error: "No se pudo leer la copia de seguridad" }, 503);
  }
}
export async function POST(request: Request): Promise<Response> {
  if (!isAuthorized(request)) return json({ error: "Acceso requerido" }, 401);
  if (!isSameOrigin(request)) return json({ error: "Origen no autorizado" }, 403);
  if (Number(request.headers.get("content-length") || 0) > 1_500_000) return json({ error: "Copia demasiado grande" }, 413);
  try {
    const body = await request.json();
    if (!isSnapshot(body?.snapshot) || (body.baseRevision !== null && typeof body.baseRevision !== "string"))
      return json({ error: "Datos inválidos" }, 400);
    const existing = await latestEntry();
    if ((existing?.pathname ?? null) !== body.baseRevision)
      return json({ error: "Hay cambios más recientes en otro dispositivo. No sobrescribimos sus datos.", revision: existing?.pathname ?? null }, 409);
    const pathname = `backups/${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.json`;
    const savedAt = new Date().toISOString();
    await put(pathname, JSON.stringify({ savedAt, snapshot: body.snapshot }), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      cacheControlMaxAge: 60,
    });
    return json({ revision: pathname, savedAt });
  } catch {
    return json({ error: "No se pudo guardar. La copia local permanece intacta." }, 503);
  }
}
