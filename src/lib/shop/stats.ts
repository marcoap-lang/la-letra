// Lógica pura de Estadísticas (sin React ni zustand): todo se calcula de lo que ya se guardó.
// Las fechas se cuentan por día LOCAL (el del equipo, en México), nunca por UTC.
import { roundMoney } from "./format";
import { alertsOf } from "./inventory";
import type { Customer, Good, Job, Payment, Sale, Supply } from "./store";

export type StatsData = {
  jobs: Job[];
  payments: Payment[];
  sales: Sale[];
  customers: Customer[];
  goods: Good[];
  supplies: Supply[];
};

export type PeriodId = "hoy" | "semana" | "mes" | "anio";

export const PERIODS: { id: PeriodId; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "semana", label: "Esta semana" },
  { id: "mes", label: "Este mes" },
  { id: "anio", label: "Este año" },
];

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const WEEKDAYS_SHORT = ["L", "M", "M", "J", "V", "S", "D"];

const pad = (n: number) => String(n).padStart(2, "0");

/** Día local "AAAA-MM-DD" de una fecha. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Día local de una marca guardada (ISO con hora, o solo fecha). null si no sirve. */
export function localDay(stamp: string | undefined | null): string | null {
  if (!stamp) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(stamp)) return stamp;
  const date = new Date(stamp);
  return Number.isNaN(date.getTime()) ? null : dayKey(date);
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export type Range = { id: PeriodId; start: string; end: string };

/** Primer y último día (inclusive) del periodo. La semana va de lunes a domingo. */
export function rangeOf(id: PeriodId, now: Date): Range {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  if (id === "hoy") {
    const key = dayKey(now);
    return { id, start: key, end: key };
  }
  if (id === "semana") {
    const back = (now.getDay() + 6) % 7;
    return { id, start: dayKey(new Date(y, m, d - back)), end: dayKey(new Date(y, m, d - back + 6)) };
  }
  if (id === "mes") {
    return { id, start: dayKey(new Date(y, m, 1)), end: dayKey(new Date(y, m + 1, 0)) };
  }
  return { id, start: `${y}-01-01`, end: `${y}-12-31` };
}

const inRange = (day: string | null, range: Range) => day !== null && day >= range.start && day <= range.end;

export type Ranked = { key: string; name: string; count: number; amount: number };
export type Bar = { key: string; label: string; value: number; current: boolean; future: boolean };

export type Stats = {
  range: Range;
  /** Trabajos creados + ventas de papelería del periodo. */
  sold: number;
  /** Dinero que entró en el periodo. */
  collected: number;
  /** Saldo pendiente de hoy (no depende del periodo). */
  receivable: number;
  jobsCount: number;
  jobsDone: number;
  jobsPending: number;
  topTypes: Ranked[];
  topGoods: Ranked[];
  topCustomers: Ranked[];
  bars: Bar[];
  barsBy: "dia" | "mes";
  bestBar: Bar | null;
  hasData: boolean;
  lowStock: number;
};

const TOP = 5;

function top(map: Map<string, Ranked>): Ranked[] {
  return [...map.values()]
    .sort((a, b) => b.count - a.count || b.amount - a.amount || a.name.localeCompare(b.name, "es"))
    .slice(0, TOP);
}

function bump(map: Map<string, Ranked>, key: string, name: string, count: number, amount: number) {
  const row = map.get(key);
  if (row) {
    row.count += count;
    row.amount = roundMoney(row.amount + amount);
  } else {
    map.set(key, { key, name, count, amount: roundMoney(amount) });
  }
}

/**
 * Dinero cobrado de los trabajos: cada pago tiene su fecha (payments[].at).
 * Dinero cobrado de las ventas: la venta solo guarda cuánto se pagó en total (Sale.paid), sin fecha
 * por pago; se cuenta completo en el día de la venta.
 * Los pagos de trabajos que ya no existen no se cuentan.
 */
export function collectedItems(data: Pick<StatsData, "jobs" | "payments" | "sales">): { day: string; amount: number }[] {
  const jobIds = new Set(data.jobs.map((job) => job.id));
  const out: { day: string; amount: number }[] = [];
  for (const payment of data.payments) {
    const day = localDay(payment.at);
    if (day && jobIds.has(payment.jobId) && payment.amount > 0) out.push({ day, amount: payment.amount });
  }
  for (const sale of data.sales) {
    const day = localDay(sale.createdAt);
    if (day && sale.paid > 0) out.push({ day, amount: sale.paid });
  }
  return out;
}

function soldItems(data: Pick<StatsData, "jobs" | "sales">): { day: string; amount: number }[] {
  const out: { day: string; amount: number }[] = [];
  for (const job of data.jobs) {
    const day = localDay(job.createdAt);
    if (day) out.push({ day, amount: job.price });
  }
  for (const sale of data.sales) {
    const day = localDay(sale.createdAt);
    if (day) out.push({ day, amount: sale.total });
  }
  return out;
}

export function receivableOf(data: Pick<StatsData, "jobs" | "sales">): number {
  const jobs = data.jobs.reduce((sum, job) => sum + Math.max(0, roundMoney(job.price - job.paid)), 0);
  const sales = data.sales.reduce((sum, sale) => sum + Math.max(0, roundMoney(sale.total - sale.paid)), 0);
  return roundMoney(jobs + sales);
}

function sum(items: { amount: number }[]) {
  return roundMoney(items.reduce((total, item) => total + item.amount, 0));
}

function barsFor(range: Range, now: Date, sold: { day: string; amount: number }[]) {
  const today = dayKey(now);
  if (range.id === "anio") {
    const year = Number(range.start.slice(0, 4));
    const totals = new Array<number>(12).fill(0);
    for (const item of sold) if (item.day >= range.start && item.day <= range.end) totals[Number(item.day.slice(5, 7)) - 1] += item.amount;
    const thisMonth = today.slice(0, 7);
    return {
      barsBy: "mes" as const,
      bars: totals.map((value, i): Bar => {
        const key = `${year}-${pad(i + 1)}`;
        return { key, label: MONTHS_SHORT[i], value: roundMoney(value), current: key === thisMonth, future: key > thisMonth };
      }),
    };
  }
  const byDay = new Map<string, number>();
  for (const item of sold) byDay.set(item.day, (byDay.get(item.day) ?? 0) + item.amount);
  const bars: Bar[] = [];
  const first = parseKey(range.start);
  const last = parseKey(range.end);
  for (let at = first; at <= last; at = new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1)) {
    const key = dayKey(at);
    const label = range.id === "semana" ? WEEKDAYS_SHORT[(at.getDay() + 6) % 7] : String(at.getDate());
    bars.push({ key, label, value: roundMoney(byDay.get(key) ?? 0), current: key === today, future: key > today });
  }
  return { barsBy: "dia" as const, bars };
}

export function computeStats(data: StatsData, id: PeriodId, now: Date): Stats {
  const range = rangeOf(id, now);
  const nameOf = (customerId: string) => data.customers.find((c) => c.id === customerId)?.name ?? "Sin nombre";

  const jobs = data.jobs.filter((job) => inRange(localDay(job.createdAt), range));
  const sales = data.sales.filter((sale) => inRange(localDay(sale.createdAt), range));
  const collected = sum(collectedItems(data).filter((item) => inRange(item.day, range)));
  const soldAll = soldItems(data);
  const sold = sum(soldAll.filter((item) => inRange(item.day, range)));

  const types = new Map<string, Ranked>();
  const goods = new Map<string, Ranked>();
  const customers = new Map<string, Ranked>();
  const recent = [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const job of recent) {
    bump(types, job.typeId || job.typeName, job.typeName, 1, job.price);
    bump(customers, job.customerId, nameOf(job.customerId), 1, job.price);
  }
  for (const sale of sales) {
    for (const line of sale.lines) {
      bump(goods, line.goodId || line.name, line.name, line.qty, roundMoney(line.qty * line.price));
    }
    if (sale.customerId) bump(customers, sale.customerId, nameOf(sale.customerId), 0, sale.total);
  }
  // Mejores clientes: por monto vendido (el conteo solo desempata, no se muestra aparte).
  const topCustomers = [...customers.values()]
    .sort((a, b) => b.amount - a.amount || b.count - a.count || a.name.localeCompare(b.name, "es"))
    .slice(0, TOP);

  const { bars, barsBy } = barsFor(range, now, soldAll);
  const bestBar = bars.reduce<Bar | null>((best, bar) => (bar.value > 0 && (!best || bar.value > best.value) ? bar : best), null);
  const jobsDone = jobs.filter((job) => job.status === "listo" || job.status === "entregado").length;

  return {
    range,
    sold,
    collected,
    receivable: receivableOf(data),
    jobsCount: jobs.length,
    jobsDone,
    jobsPending: jobs.length - jobsDone,
    topTypes: top(types),
    topGoods: top(goods),
    topCustomers,
    bars,
    barsBy,
    bestBar,
    hasData: jobs.length > 0 || sales.length > 0 || collected > 0,
    lowStock: alertsOf(data.goods, data.supplies).length,
  };
}

export type MonthRow = {
  key: string;
  month: string;
  year: number;
  sold: number;
  collected: number;
  current: boolean;
};

/** Últimos 12 meses (el actual primero y 11 hacia atrás). Meses sin datos salen en 0. */
export function monthlyResults(data: StatsData, now: Date): MonthRow[] {
  const soldAll = soldItems(data);
  const paidAll = collectedItems(data);
  const rows: MonthRow[] = [];
  for (let back = 0; back < 12; back++) {
    const at = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const key = `${at.getFullYear()}-${pad(at.getMonth() + 1)}`;
    const inMonth = (item: { day: string }) => item.day.slice(0, 7) === key;
    rows.push({
      key,
      month: MONTHS_SHORT[at.getMonth()],
      year: at.getFullYear(),
      sold: sum(soldAll.filter(inMonth)),
      collected: sum(paidAll.filter(inMonth)),
      current: back === 0,
    });
  }
  return rows;
}

/** Pesos para las barras: enteros; de un millón en adelante, "$1.2 millones". */
export function moneyBar(value: number): string {
  const n = Math.round(value);
  if (n >= 1_000_000) {
    const m = Math.round(n / 100_000) / 10;
    return `$${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(m)} ${m === 1 ? "millón" : "millones"}`;
  }
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

/** Texto del periodo: "domingo 25 de octubre", "octubre 2026", "2026", "del 20 al 26 de octubre". */
export function rangeText(range: Range): string {
  const a = parseKey(range.start);
  const b = parseKey(range.end);
  if (range.id === "hoy") {
    const weekday = new Intl.DateTimeFormat("es-MX", { weekday: "long" }).format(a);
    return `${weekday} ${a.getDate()} de ${MONTHS_LONG[a.getMonth()]}`;
  }
  if (range.id === "semana") {
    return a.getMonth() === b.getMonth()
      ? `del ${a.getDate()} al ${b.getDate()} de ${MONTHS_LONG[b.getMonth()]}`
      : `del ${a.getDate()} de ${MONTHS_LONG[a.getMonth()]} al ${b.getDate()} de ${MONTHS_LONG[b.getMonth()]}`;
  }
  if (range.id === "mes") return `${MONTHS_LONG[a.getMonth()]} ${a.getFullYear()}`;
  return String(a.getFullYear());
}

/** Nombre largo de un día para "Mejor día": "25 de octubre". */
export function dayText(key: string): string {
  const d = parseKey(key);
  return `${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`;
}

export function monthText(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}
