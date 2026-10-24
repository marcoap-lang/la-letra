export function norm(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
}

export function digits(value: string) {
  return value.replace(/\D/g, "");
}

export function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function parseMoney(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return 0;
  return roundMoney(n);
}

export function formatMoney(value: number) {
  const n = roundMoney(value);
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function todayISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shiftISO(days: number, from = new Date()) {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return todayISO(date);
}

export type DueChoice = "hoy" | "manana" | "tres" | "semana" | "fecha";

export function dueFromChoice(choice: DueChoice, custom: string) {
  if (choice === "manana") return shiftISO(1);
  if (choice === "tres") return shiftISO(3);
  if (choice === "semana") return shiftISO(7);
  if (choice === "fecha" && /^\d{4}-\d{2}-\d{2}$/.test(custom)) return custom;
  return todayISO();
}

export function formatDay(iso: string) {
  if (!iso) return "Sin fecha";
  if (iso === todayISO()) return "Hoy";
  if (iso === shiftISO(1)) return "Mañana";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const label = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(y, m - 1, d));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatWhen(iso: string) {
  const day = iso.slice(0, 10);
  if (day === todayISO()) return "Hoy";
  if (day === shiftISO(-1)) return "Ayer";
  return formatDay(day);
}

export function waLink(phone: string, text: string) {
  const raw = digits(phone);
  const full = raw.length === 10 ? `52${raw}` : raw;
  const base = full ? `https://wa.me/${full}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}
