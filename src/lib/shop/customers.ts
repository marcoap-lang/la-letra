import { digits, norm } from "./format";

export type Billing = {
  rfc: string;
  name: string;
  email: string;
  zip: string;
  regime: string;
  cfdiUse: string;
};

export type Customer = { id: string; name: string; phone: string; billing?: Billing };

export const BILLING_FIELDS: { key: keyof Billing; label: string }[] = [
  { key: "rfc", label: "RFC" },
  { key: "name", label: "Razón social (nombre fiscal)" },
  { key: "email", label: "Correo para factura" },
  { key: "zip", label: "Código postal fiscal" },
  { key: "regime", label: "Régimen fiscal" },
  { key: "cfdiUse", label: "Uso de CFDI" },
];

export function emptyBilling(): Billing {
  return { rfc: "", name: "", email: "", zip: "", regime: "", cfdiUse: "" };
}

/** Mayúsculas, sin espacios ni guiones. Se aceptan letras, números, Ñ y &. */
export function cleanRfc(raw: string) {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9Ñ&]/g, "")
    .slice(0, 13);
}

export function cleanZip(raw: string) {
  return digits(raw).slice(0, 5);
}

/** Aviso suave: nunca bloquea. Devuelve "" cuando está bien o vacío. */
export function rfcHint(rfc: string) {
  const clean = cleanRfc(rfc);
  if (!clean) return "";
  if (clean.length === 12 || clean.length === 13) return "";
  return "El RFC normalmente tiene 12 o 13 letras y números. Revíselo; igual lo puede guardar.";
}

export function zipHint(zip: string) {
  const clean = cleanZip(zip);
  if (!clean || clean.length === 5) return "";
  return "El código postal tiene 5 números.";
}

export function emailHint(email: string) {
  const clean = email.trim();
  if (!clean || /^\S+@\S+\.\S+$/.test(clean)) return "";
  return "Ese correo parece incompleto. Revíselo; igual lo puede guardar.";
}

/** Limpia los campos. Si todo queda vacío devuelve undefined (el cliente no tiene datos de factura). */
export function normalizeBilling(value: unknown): Billing | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const raw = value as Record<string, unknown>;
  const text = (key: keyof Billing) => (typeof raw[key] === "string" ? (raw[key] as string).trim() : "");
  const out: Billing = {
    rfc: cleanRfc(text("rfc")),
    name: text("name"),
    email: text("email"),
    zip: cleanZip(text("zip")),
    regime: text("regime"),
    cfdiUse: text("cfdiUse"),
  };
  return Object.values(out).some(Boolean) ? out : undefined;
}

/** Acepta clientes de snapshots viejos (sin billing) o con datos dañados. */
export function normalizeCustomer(value: Customer): Customer {
  const { billing, ...rest } = value;
  const clean = normalizeBilling(billing);
  return clean ? { ...rest, billing: clean } : rest;
}

export function hasBilling(customer: Pick<Customer, "billing">) {
  return !!normalizeBilling(customer.billing);
}

export function billingText(customer: Pick<Customer, "name" | "billing">) {
  const billing = normalizeBilling(customer.billing);
  if (!billing) return "";
  const lines = ["Datos para factura", `Cliente: ${customer.name}`];
  for (const field of BILLING_FIELDS) {
    const v = billing[field.key];
    if (v) lines.push(`${field.label.replace(" (nombre fiscal)", "")}: ${v}`);
  }
  return lines.join("\n");
}

/** Mismo nombre (sin acentos ni mayúsculas) y mismo teléfono. Dos sin teléfono cuentan como iguales. */
export function findDuplicate(customers: Customer[], name: string, phone: string, exceptId?: string) {
  return customers.find(
    (customer) =>
      customer.id !== exceptId && norm(customer.name) === norm(name) && digits(customer.phone) === digits(phone),
  );
}

export function sortCustomers<T extends { name: string }>(list: T[]) {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
}

export function matchesCustomer(customer: Pick<Customer, "name" | "phone">, query: string) {
  const q = norm(query);
  if (!q) return true;
  if (norm(customer.name).includes(q)) return true;
  const d = digits(query);
  return d ? digits(customer.phone).includes(d) : norm(customer.phone).includes(q);
}

export type CustomerStats = { jobs: number; sales: number; owed: number };

export function statsByCustomer(
  jobs: { customerId: string; price: number; paid: number }[],
  sales: { customerId: string | null; total: number; paid: number }[],
) {
  const map = new Map<string, CustomerStats>();
  const get = (id: string) => {
    let s = map.get(id);
    if (!s) {
      s = { jobs: 0, sales: 0, owed: 0 };
      map.set(id, s);
    }
    return s;
  };
  const owe = (a: number, b: number) => Math.max(0, Math.round((a - b) * 100) / 100);
  for (const job of jobs) {
    const s = get(job.customerId);
    s.jobs += 1;
    s.owed += owe(job.price, job.paid);
  }
  for (const sale of sales) {
    if (!sale.customerId) continue;
    const s = get(sale.customerId);
    s.sales += 1;
    s.owed += owe(sale.total, sale.paid);
  }
  for (const s of map.values()) s.owed = Math.round(s.owed * 100) / 100;
  return map;
}
