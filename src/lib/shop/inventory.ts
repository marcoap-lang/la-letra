// Lógica pura del inventario (sin React ni zustand) para poder probarla sola.
import type { SupplyUse } from "./catalog.ts";
import type { Good } from "./goods.ts";

export type Supply = {
  id: string;
  name: string;
  unit: string;
  qty: number;
  min: number;
  hidden?: boolean;
  review?: boolean;
};

export type MoveKind = "entrada" | "venta" | "trabajo" | "ajuste";

// change = lo que de verdad cambió (con signo). after = cuánto quedó. short = lo que faltó y no se pudo descontar.
export type StockMove = {
  id: string;
  at: string;
  kind: MoveKind;
  what: "good" | "supply";
  itemId: string;
  itemName: string;
  change: number;
  after: number;
  reason: string;
  short?: number;
};

// Lo que un trabajo ya gastó de un insumo. want = lo que le toca; took = lo que de verdad se descontó.
export type JobUse = { supplyId: string; per: number; by: "pieza" | "trabajo"; want: number; took: number };

export type Ledger = { goods: Good[]; supplies: Supply[]; moves: StockMove[] };

export const UNITS = ["pieza", "caja", "hoja", "paquete", "rollo", "frasco", "litro"] as const;
export const MAX_MOVES = 600;

export function round2(n: number) {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function parseQty(raw: string) {
  const n = Number(raw.replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? round2(n) : 0;
}

export function fmtQty(n: number) {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(round2(n));
}

export function unitLabel(n: number, unit: string) {
  if (!unit) return "";
  if (Math.abs(n - 1) < 1e-9) return unit;
  return /[aeiou]$/i.test(unit) ? `${unit}s` : `${unit}es`;
}

export function qtyText(n: number, unit: string) {
  return `${fmtQty(n)} ${unitLabel(n, unit)}`.trim();
}

export type StockState = "agotado" | "poco" | "ok";

export function stockState(qty: number, min: number): StockState {
  if (qty <= 0) return "agotado";
  if (min > 0 && qty <= min) return "poco";
  return "ok";
}

export type Alert = {
  what: "good" | "supply";
  id: string;
  name: string;
  qty: number;
  unit: string;
  min: number;
  state: StockState;
  review: boolean;
};

export function alertsOf(goods: Good[], supplies: Supply[]): Alert[] {
  const out: Alert[] = [];
  for (const g of goods) {
    if (g.hidden || g.stock === undefined) continue;
    const state = stockState(g.stock, g.min ?? 0);
    if (state !== "ok" || g.review)
      out.push({ what: "good", id: g.id, name: g.name, qty: g.stock, unit: "", min: g.min ?? 0, state, review: !!g.review });
  }
  for (const s of supplies) {
    if (s.hidden) continue;
    const state = stockState(s.qty, s.min);
    if (state !== "ok" || s.review)
      out.push({ what: "supply", id: s.id, name: s.name, qty: s.qty, unit: s.unit, min: s.min, state, review: !!s.review });
  }
  const rank = { agotado: 0, poco: 1, ok: 2 } as const;
  return out.sort((a, b) => rank[a.state] - rank[b.state] || a.name.localeCompare(b.name, "es"));
}

export function trimMoves(moves: StockMove[]) {
  return moves.length > MAX_MOVES ? moves.slice(0, MAX_MOVES) : moves;
}

export type ChangeOpts = {
  what: "good" | "supply";
  id: string;
  delta: number; // negativo = sale, positivo = entra
  kind: MoveKind;
  reason: string;
  at: string;
  moveId: string;
  clearReview?: boolean;
};

// Cambia una existencia. Nunca baja de 0: si faltó, deja 0, marca "revisar" y anota cuánto faltó.
// Un artículo sin existencia registrada (stock indefinido) no se controla: no hace nada.
export function applyChange(ledger: Ledger, o: ChangeOpts): { ledger: Ledger; applied: number; short: number } {
  const none = { ledger, applied: 0, short: 0 };
  const delta = round2(o.delta);
  let before: number | undefined;
  let name = "";
  if (o.what === "good") {
    const g = ledger.goods.find((x) => x.id === o.id);
    if (!g || g.stock === undefined) return none;
    before = g.stock;
    name = g.name;
  } else {
    const s = ledger.supplies.find((x) => x.id === o.id);
    if (!s) return none;
    before = s.qty;
    name = s.name;
  }
  const after = Math.max(0, round2(before + delta));
  const applied = round2(after - before);
  const short = delta < 0 ? round2(-delta + applied) : 0;
  if (applied === 0 && short === 0 && !o.clearReview) return none;
  const flag = (review: boolean | undefined) => (short > 0 ? true : o.clearReview ? false : review);
  const goods =
    o.what === "good"
      ? ledger.goods.map((g) => (g.id === o.id ? { ...g, stock: after, review: flag(g.review) } : g))
      : ledger.goods;
  const supplies =
    o.what === "supply"
      ? ledger.supplies.map((s) => (s.id === o.id ? { ...s, qty: after, review: flag(s.review) } : s))
      : ledger.supplies;
  const move: StockMove = {
    id: o.moveId,
    at: o.at,
    kind: o.kind,
    what: o.what,
    itemId: o.id,
    itemName: name,
    change: applied,
    after,
    reason: short > 0 ? `${o.reason} (faltaban ${fmtQty(short)}; quedó en 0, revisar)` : o.reason,
    ...(short > 0 ? { short } : {}),
  };
  return { ledger: { goods, supplies, moves: trimMoves([move, ...ledger.moves]) }, applied, short };
}

// "Poner la cantidad real". Guarda la diferencia como movimiento de ajuste.
export function applyAdjust(
  ledger: Ledger,
  o: { what: "good" | "supply"; id: string; qty: number; min?: number; reason: string; at: string; moveId: string },
): Ledger {
  const qty = Math.max(0, round2(o.qty));
  const min = o.min === undefined ? undefined : Math.max(0, round2(o.min));
  let before: number | undefined;
  let name = "";
  if (o.what === "good") {
    const g = ledger.goods.find((x) => x.id === o.id);
    if (!g) return ledger;
    before = g.stock;
    name = g.name;
  } else {
    const s = ledger.supplies.find((x) => x.id === o.id);
    if (!s) return ledger;
    before = s.qty;
    name = s.name;
  }
  const goods =
    o.what === "good"
      ? ledger.goods.map((g) =>
          g.id === o.id ? { ...g, stock: qty, min: min ?? g.min ?? 0, review: false } : g,
        )
      : ledger.goods;
  const supplies =
    o.what === "supply"
      ? ledger.supplies.map((s) => (s.id === o.id ? { ...s, qty, min: min ?? s.min, review: false } : s))
      : ledger.supplies;
  const change = round2(qty - (before ?? 0));
  const move: StockMove = {
    id: o.moveId,
    at: o.at,
    kind: "ajuste",
    what: o.what,
    itemId: o.id,
    itemName: name,
    change,
    after: qty,
    reason: o.reason,
  };
  return { goods, supplies, moves: trimMoves([move, ...ledger.moves]) };
}

export function wantOf(use: Pick<SupplyUse, "per" | "by">, quantity: number) {
  return round2(Math.max(0, use.per) * (use.by === "pieza" ? Math.max(1, quantity) : 1));
}

export type JobUsePlan = {
  used: JobUse[];
  // Cambios que hay que aplicar al inventario (con signo, antes de ajustar a lo disponible).
  steps: { supplyId: string; delta: number }[];
};

// Compara lo que el trabajo ya gastó con lo que le toca ahora (por cambio de cantidad o al borrarlo con quantity = 0 y "release").
// - Si ahora le toca más: pide descontar la diferencia (apply decide cuánto se pudo).
// - Si ahora le toca menos: devuelve la diferencia, pero nunca más de lo que de verdad se descontó.
export function planJobUse(prev: JobUse[] | undefined, uses: SupplyUse[] | undefined, quantity: number): JobUsePlan {
  const steps: { supplyId: string; delta: number }[] = [];
  const used: JobUse[] = [];
  const old = new Map((prev ?? []).map((u) => [u.supplyId, u]));
  const list = (uses ?? []).filter((u) => u.per > 0);
  for (const u of list) {
    const before = old.get(u.supplyId);
    const want = wantOf(u, quantity);
    if (!before) {
      steps.push({ supplyId: u.supplyId, delta: -want });
      used.push({ supplyId: u.supplyId, per: u.per, by: u.by, want, took: 0 });
    } else {
      const d = round2(want - before.want);
      if (d > 0) steps.push({ supplyId: u.supplyId, delta: -d });
      if (d < 0) {
        const back = Math.min(-d, before.took);
        if (back > 0) steps.push({ supplyId: u.supplyId, delta: back });
      }
      used.push({ ...before, want });
    }
  }
  return { used, steps };
}

type Ctx = { label: string; at: string; newId: () => string };

// Descuenta (o reajusta) los insumos de un trabajo. Se usa al guardar el trabajo y al cambiar su cantidad.
// Es seguro repetirlo: solo mueve la diferencia entre lo que ya se gastó y lo que le toca.
export function applyJobUse(
  ledger: Ledger,
  prev: JobUse[] | undefined,
  uses: SupplyUse[] | undefined,
  quantity: number,
  ctx: Ctx,
): { ledger: Ledger; used: JobUse[] } {
  const plan = planJobUse(prev, uses, quantity);
  let cur = ledger;
  const used = plan.used.map((u) => ({ ...u }));
  for (const step of plan.steps) {
    const r = applyChange(cur, {
      what: "supply",
      id: step.supplyId,
      delta: step.delta,
      kind: "trabajo",
      reason: step.delta < 0 ? ctx.label : `${ctx.label} (se corrigió la cantidad)`,
      at: ctx.at,
      moveId: ctx.newId(),
    });
    cur = r.ledger;
    const target = used.find((u) => u.supplyId === step.supplyId);
    if (target) target.took = round2(Math.max(0, target.took - r.applied));
  }
  return { ledger: cur, used };
}

// Al borrar un trabajo: se devuelve al inventario lo que de verdad se había descontado.
export function releaseJobUse(ledger: Ledger, prev: JobUse[] | undefined, ctx: Ctx): Ledger {
  let cur = ledger;
  for (const u of prev ?? []) {
    if (u.took <= 0) continue;
    cur = applyChange(cur, {
      what: "supply",
      id: u.supplyId,
      delta: u.took,
      kind: "trabajo",
      reason: `${ctx.label} (se borró el trabajo, se devolvió)`,
      at: ctx.at,
      moveId: ctx.newId(),
    }).ledger;
  }
  return cur;
}

// ---- Borrar una venta de papelería ----

export type SaleForReturn = { number: number; lines: { goodId: string; qty: number; took?: number }[] };

function isSaleMove(reason: string, number: number) {
  const tag = `Venta #${number}`;
  return reason === tag || reason.startsWith(`${tag} (`);
}

// Cuánto descontó de verdad una venta de cada artículo (nunca más de lo que se vendió).
// Las ventas nuevas lo traen anotado en cada renglón (took). En las viejas se lee del historial de movimientos.
export function saleReturns(sale: SaleForReturn, moves: StockMove[]): { goodId: string; qty: number }[] {
  const byGood = new Map<string, { sold: number; noted: number; allNoted: boolean }>();
  for (const line of sale.lines) {
    const row = byGood.get(line.goodId) ?? { sold: 0, noted: 0, allNoted: true };
    row.sold += Math.max(0, line.qty);
    if (typeof line.took === "number") row.noted += Math.max(0, line.took);
    else row.allNoted = false;
    byGood.set(line.goodId, row);
  }
  const out: { goodId: string; qty: number }[] = [];
  for (const [goodId, row] of byGood) {
    let took = row.noted;
    if (!row.allNoted) {
      took = 0;
      for (const m of moves) {
        if (m.kind === "venta" && m.what === "good" && m.itemId === goodId && isSaleMove(m.reason, sale.number)) {
          took += Math.max(0, -m.change);
        }
      }
    }
    const qty = round2(Math.min(took, row.sold));
    if (qty > 0) out.push({ goodId, qty });
  }
  return out;
}

// Devuelve al inventario lo que la venta había descontado y lo deja anotado en el historial como ajuste.
// Un artículo que ya no se controla no se toca.
export function releaseSale(ledger: Ledger, sale: SaleForReturn, ctx: Ctx): Ledger {
  let cur = ledger;
  for (const r of saleReturns(sale, ledger.moves)) {
    cur = applyChange(cur, {
      what: "good",
      id: r.goodId,
      delta: r.qty,
      kind: "ajuste",
      reason: `Se borró la venta #${sale.number}, se devolvió`,
      at: ctx.at,
      moveId: ctx.newId(),
    }).ledger;
  }
  return cur;
}
