import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SEED_DRAWERS, SEED_TYPES, type Drawer, type JobType, type SupplyUse } from "./catalog";
import { digits, norm, roundMoney } from "./format";
import { canRemoveCustomer, customerUse, findDuplicate, normalizeBilling, normalizeCustomer, type Billing, type Customer } from "./customers";
import { SEED_GOODS, type Good, type GoodCategory } from "./goods";
import {
  applyAdjust,
  applyChange,
  applyJobUse,
  releaseJobUse,
  releaseSale,
  round2,
  trimMoves,
  type JobUse,
  type Ledger,
  type StockMove,
  type Supply,
} from "./inventory";

export type { Drawer, JobType, Good, GoodCategory, SupplyUse, Supply, StockMove, JobUse, Billing, Customer };

export type JobStatus = "nuevo" | "aprobado" | "listo" | "entregado";

export type Job = {
  id: string;
  number: number;
  customerId: string;
  typeId: string;
  typeName: string;
  needsProof: boolean;
  quantity: number;
  due: string;
  notes: string;
  price: number;
  paid: number;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  used?: JobUse[];
};

export type Payment = {
  id: string;
  jobId: string;
  customerId: string;
  amount: number;
  at: string;
};

export type SaleLine = {
  goodId: string;
  name: string;
  qty: number;
  price: number;
  // Cuánto se descontó de verdad del inventario al vender (si el artículo se controla).
  took?: number;
};

export type Sale = {
  id: string;
  number: number;
  customerId: string | null;
  customerName: string;
  lines: SaleLine[];
  total: number;
  paid: number;
  createdAt: string;
};

export type Snapshot = {
  version: 1 | 2;
  drawers: Drawer[];
  types: JobType[];
  customers: Customer[];
  jobs: Job[];
  payments: Payment[];
  nextNumber: number;
  goods?: Good[];
  sales?: Sale[];
  supplies?: Supply[];
  moves?: StockMove[];
};

export type NewJobInput = {
  customerId: string | null;
  name: string;
  phone: string;
  typeId: string;
  quantity: number;
  due: string;
  notes: string;
  price: number;
  paid: number;
};

export type NewSaleInput = {
  customerId: string | null;
  name: string;
  phone: string;
  lines: SaleLine[];
  paid: number;
};

type ShopState = Snapshot & {
  goods: Good[];
  sales: Sale[];
  supplies: Supply[];
  moves: StockMove[];
  addSupply: (input: { name: string; unit: string; qty: number; min: number }) => string;
  hideSupply: (id: string) => void;
  receiveStock: (what: "good" | "supply", id: string, amount: number) => void;
  adjustStock: (what: "good" | "supply", id: string, qty: number, min?: number) => void;
  stopControlGood: (id: string) => void;
  setTypeUses: (typeId: string, uses: SupplyUse[]) => void;
  addDrawer: (name: string) => string;
  addType: (input: { drawerId: string; name: string; needsProof: boolean }) => string;
  setTypeHidden: (id: string, hidden: boolean) => void;
  renameType: (id: string, name: string) => void;
  addGood: (name: string, price: number, category?: GoodCategory) => string;
  setGoodPrice: (id: string, price: number) => void;
  setGoodHidden: (id: string, hidden: boolean) => void;
  saveJob: (input: NewJobInput) => string;
  saveSale: (input: NewSaleInput) => string;
  setStatus: (jobId: string, status: JobStatus) => void;
  addPayment: (jobId: string, amount: number) => number;
  paySale: (saleId: string, amount: number) => number;
  updateJob: (
    jobId: string,
    patch: Partial<Pick<Job, "quantity" | "due" | "notes" | "price" | "paid" | "typeName">>,
  ) => void;
  addCustomer: (name: string, phone: string) => string;
  updateCustomer: (id: string, patch: { name?: string; phone?: string; billing?: Billing }) => void;
  deleteJob: (jobId: string) => void;
  deleteSale: (saleId: string) => boolean;
  deleteCustomer: (id: string) => boolean;
  replaceAll: (snap: Snapshot) => void;
};

function uid() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function phonesMatch(a: string, b: string) {
  const da = digits(a);
  const db = digits(b);
  return !da || !db || da === db;
}

export function balanceOf(job: Pick<Job, "price" | "paid">) {
  return roundMoney(job.price - job.paid);
}

export function saleBalance(sale: Pick<Sale, "total" | "paid">) {
  return roundMoney(sale.total - sale.paid);
}

export function toSnapshot(state: Snapshot): Snapshot {
  return {
    version: 2,
    drawers: state.drawers,
    types: state.types,
    customers: state.customers,
    jobs: state.jobs,
    payments: state.payments,
    nextNumber: state.nextNumber,
    goods: state.goods ?? SEED_GOODS,
    sales: state.sales ?? [],
    supplies: state.supplies ?? [],
    moves: state.moves ?? [],
  };
}

function ledgerOf(state: Pick<ShopState, "goods" | "supplies" | "moves">): Ledger {
  return { goods: state.goods, supplies: state.supplies, moves: state.moves };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseSnapshot(value: unknown): Snapshot | null {
  if (!isRecord(value) || (value.version !== 1 && value.version !== 2)) return null;
  if (!Array.isArray(value.drawers) || !Array.isArray(value.types)) return null;
  if (!Array.isArray(value.customers) || !Array.isArray(value.jobs)) return null;
  if (!Array.isArray(value.payments) || typeof value.nextNumber !== "number") return null;
  const jobsOk = value.jobs.every(
    (job) =>
      isRecord(job) &&
      typeof job.id === "string" &&
      typeof job.number === "number" &&
      typeof job.customerId === "string" &&
      typeof job.typeName === "string",
  );
  if (!jobsOk) return null;
  const goods = Array.isArray(value.goods) ? (value.goods as Good[]) : SEED_GOODS;
  const sales = Array.isArray(value.sales) ? (value.sales as Sale[]) : [];
  const supplies = Array.isArray(value.supplies) ? (value.supplies as Supply[]) : [];
  const moves = Array.isArray(value.moves) ? (value.moves as StockMove[]) : [];
  return {
    version: 2,
    drawers: value.drawers as Drawer[],
    types: value.types as JobType[],
    customers: (value.customers as Customer[]).map(normalizeCustomer),
    jobs: value.jobs as Job[],
    payments: value.payments as Payment[],
    nextNumber: value.nextNumber,
    goods,
    sales,
    supplies,
    moves,
  };
}

export function downloadSnapshot(snap: Snapshot) {
  const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `la-letra-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export const useShop = create<ShopState>()(
  persist(
    (set, get) => ({
      version: 2,
      drawers: SEED_DRAWERS,
      types: SEED_TYPES,
      customers: [],
      jobs: [],
      payments: [],
      goods: SEED_GOODS,
      sales: [],
      supplies: [],
      moves: [],
      nextNumber: 1001,
      addDrawer: (name) => {
        const clean = name.trim();
        const found = get().drawers.find((drawer) => norm(drawer.name) === norm(clean));
        if (found) return found.id;
        const drawerId = uid();
        set((state) => ({ drawers: [...state.drawers, { id: drawerId, name: clean }] }));
        return drawerId;
      },
      addType: (input) => {
        const clean = input.name.trim();
        const found = get().types.find(
          (type) => type.drawerId === input.drawerId && norm(type.name) === norm(clean),
        );
        if (found) {
          set((state) => ({
            types: state.types.map((type) =>
              type.id === found.id ? { ...type, hidden: false, needsProof: input.needsProof } : type,
            ),
          }));
          return found.id;
        }
        const typeId = uid();
        set((state) => ({
          types: [
            ...state.types,
            {
              id: typeId,
              drawerId: input.drawerId,
              name: clean,
              needsProof: input.needsProof,
              hidden: false,
            },
          ],
        }));
        return typeId;
      },
      setTypeHidden: (id, hidden) =>
        set((state) => ({
          types: state.types.map((type) => (type.id === id ? { ...type, hidden } : type)),
        })),
      renameType: (id, name) =>
        set((state) => ({
          types: state.types.map((type) =>
            type.id === id ? { ...type, name: name.trim() || type.name } : type,
          ),
        })),
      addGood: (name, price, category = "Otros") => {
        const clean = name.trim();
        const found = get().goods.find((good) => norm(good.name) === norm(clean));
        if (found) {
          set((state) => ({
            goods: state.goods.map((good) =>
              good.id === found.id ? { ...good, hidden: false, price: roundMoney(Math.max(0, price)) } : good,
            ),
          }));
          return found.id;
        }
        const id = uid();
        set((state) => ({
          goods: [...state.goods, { id, name: clean, category, price: roundMoney(Math.max(0, price)), hidden: false }],
        }));
        return id;
      },
      setGoodPrice: (id, price) =>
        set((state) => ({
          goods: state.goods.map((good) =>
            good.id === id ? { ...good, price: roundMoney(Math.max(0, price)) } : good,
          ),
        })),
      setGoodHidden: (id, hidden) =>
        set((state) => ({
          goods: state.goods.map((good) => (good.id === id ? { ...good, hidden } : good)),
        })),
      addSupply: (input) => {
        const clean = input.name.trim();
        const state = get();
        const found = state.supplies.find((item) => norm(item.name) === norm(clean));
        const qty = Math.max(0, round2(input.qty));
        const min = Math.max(0, round2(input.min));
        if (found) {
          set((st) => ({
            supplies: st.supplies.map((item) =>
              item.id === found.id ? { ...item, hidden: false, unit: input.unit || item.unit } : item,
            ),
          }));
          if (qty > 0) get().adjustStock("supply", found.id, qty, min);
          return found.id;
        }
        const id = uid();
        set((st) => ({
          supplies: [...st.supplies, { id, name: clean, unit: input.unit, qty: 0, min }],
        }));
        if (qty > 0) get().adjustStock("supply", id, qty, min);
        return id;
      },
      hideSupply: (id) =>
        set((state) => ({
          supplies: state.supplies.map((item) => (item.id === id ? { ...item, hidden: true } : item)),
        })),
      receiveStock: (what, id, amount) => {
        const n = round2(amount);
        if (n <= 0) return;
        const r = applyChange(ledgerOf(get()), {
          what,
          id,
          delta: n,
          kind: "entrada",
          reason: "Llegó mercancía",
          at: now(),
          moveId: uid(),
          clearReview: true,
        });
        set({ goods: r.ledger.goods, supplies: r.ledger.supplies, moves: r.ledger.moves });
      },
      adjustStock: (what, id, qty, min) => {
        const next = applyAdjust(ledgerOf(get()), {
          what,
          id,
          qty,
          min,
          reason: "Se puso la cantidad real",
          at: now(),
          moveId: uid(),
        });
        set({ goods: next.goods, supplies: next.supplies, moves: next.moves });
      },
      stopControlGood: (id) =>
        set((state) => ({
          goods: state.goods.map((good) => {
            if (good.id !== id) return good;
            const { stock: _s, min: _m, review: _r, ...rest } = good;
            return rest;
          }),
          moves: trimMoves([
            {
              id: uid(),
              at: now(),
              kind: "ajuste" as const,
              what: "good" as const,
              itemId: id,
              itemName: state.goods.find((good) => good.id === id)?.name ?? "",
              change: 0,
              after: 0,
              reason: "Se dejó de controlar la existencia",
            },
            ...state.moves,
          ]),
        })),
      setTypeUses: (typeId, uses) =>
        set((state) => ({
          types: state.types.map((type) =>
            type.id === typeId
              ? {
                  ...type,
                  uses: uses
                    .filter((use) => use.per > 0)
                    .map((use) => ({ supplyId: use.supplyId, per: round2(use.per), by: use.by })),
                }
              : type,
          ),
        })),
      saveJob: (input) => {
        const state = get();
        let customerId = input.customerId;
        let customers = state.customers;
        const name = input.name.trim();
        const phone = input.phone.trim();
        if (customerId) {
          customers = customers.map((customer) =>
            customer.id === customerId
              ? { ...customer, phone: phone || customer.phone }
              : customer,
          );
        } else {
          const existing = customers.find(
            (customer) => norm(customer.name) === norm(name) && phonesMatch(customer.phone, phone),
          );
          if (existing) {
            customerId = existing.id;
            if (phone && !existing.phone) {
              customers = customers.map((customer) =>
                customer.id === existing.id ? { ...customer, phone } : customer,
              );
            }
          } else {
            customerId = uid();
            customers = [...customers, { id: customerId, name, phone }];
          }
        }
        const type = state.types.find((item) => item.id === input.typeId);
        const jobId = uid();
        const price = roundMoney(Math.max(0, input.price));
        const paid = roundMoney(Math.min(Math.max(0, input.paid), price));
        const stamp = now();
        const job: Job = {
          id: jobId,
          number: state.nextNumber,
          customerId,
          typeId: input.typeId,
          typeName: type?.name ?? "Trabajo",
          needsProof: type?.needsProof ?? true,
          quantity: Math.max(1, Math.round(input.quantity) || 1),
          due: input.due,
          notes: input.notes.trim(),
          price,
          paid,
          status: "nuevo",
          createdAt: stamp,
          updatedAt: stamp,
        };
        const payments =
          paid > 0
            ? [...state.payments, { id: uid(), jobId, customerId, amount: paid, at: stamp }]
            : state.payments;
        // Los insumos del tipo de trabajo se descuentan una sola vez, al guardar.
        const spent = applyJobUse(ledgerOf(state), undefined, type?.uses, job.quantity, {
          label: `Trabajo #${job.number} (${job.typeName})`,
          at: stamp,
          newId: uid,
        });
        const withUse: Job = spent.used.length > 0 ? { ...job, used: spent.used } : job;
        set({
          customers,
          jobs: [withUse, ...state.jobs],
          payments,
          nextNumber: state.nextNumber + 1,
          supplies: spent.ledger.supplies,
          moves: spent.ledger.moves,
        });
        return jobId;
      },
      saveSale: (input) => {
        const state = get();
        const lines = input.lines
          .map((line) => ({
            ...line,
            name: line.name.trim(),
            qty: Math.max(1, Math.round(line.qty) || 1),
            price: roundMoney(Math.max(0, line.price)),
          }))
          .filter((line) => line.name && line.qty > 0);
        if (lines.length === 0) return "";
        const total = roundMoney(lines.reduce((sum, line) => sum + line.qty * line.price, 0));
        const paid = roundMoney(Math.min(Math.max(0, input.paid), total));
        let customerId = input.customerId;
        let customers = state.customers;
        const name = input.name.trim();
        const phone = input.phone.trim();
        if (name && norm(name) !== norm("Mostrador")) {
          if (customerId) {
            customers = customers.map((customer) =>
              customer.id === customerId ? { ...customer, phone: phone || customer.phone } : customer,
            );
          } else {
            const existing = customers.find(
              (customer) => norm(customer.name) === norm(name) && phonesMatch(customer.phone, phone),
            );
            if (existing) {
              customerId = existing.id;
              if (phone && !existing.phone) {
                customers = customers.map((customer) =>
                  customer.id === existing.id ? { ...customer, phone } : customer,
                );
              }
            } else {
              customerId = uid();
              customers = [...customers, { id: customerId, name, phone }];
            }
          }
        } else {
          customerId = null;
        }
        const number = state.nextNumber;
        const stamp = now();
        // Cada artículo con existencia registrada baja; los demás no se controlan.
        // Se anota cuánto bajó de verdad, para devolver justo eso si la venta se borra.
        let ledger = ledgerOf(state);
        const soldLines = lines.map((line) => {
          const r = applyChange(ledger, {
            what: "good",
            id: line.goodId,
            delta: -line.qty,
            kind: "venta",
            reason: `Venta #${number}`,
            at: stamp,
            moveId: uid(),
          });
          ledger = r.ledger;
          return { ...line, took: round2(Math.max(0, -r.applied)) };
        });
        const sale: Sale = {
          id: uid(),
          number,
          customerId,
          customerName: name || "Mostrador",
          lines: soldLines,
          total,
          paid,
          createdAt: stamp,
        };
        set({
          customers,
          sales: [sale, ...state.sales],
          nextNumber: state.nextNumber + 1,
          goods: ledger.goods,
          moves: ledger.moves,
        });
        return sale.id;
      },
      setStatus: (jobId, status) =>
        set((state) => ({
          jobs: state.jobs.map((job) =>
            job.id === jobId ? { ...job, status, updatedAt: now() } : job,
          ),
        })),
      addPayment: (jobId, amount) => {
        const job = get().jobs.find((item) => item.id === jobId);
        if (!job) return 0;
        const due = Math.max(0, balanceOf(job));
        const applied = roundMoney(Math.min(Math.max(0, amount), due));
        if (applied <= 0) return 0;
        const stamp = now();
        set((state) => ({
          jobs: state.jobs.map((item) =>
            item.id === jobId
              ? { ...item, paid: roundMoney(item.paid + applied), updatedAt: stamp }
              : item,
          ),
          payments: [
            ...state.payments,
            { id: uid(), jobId, customerId: job.customerId, amount: applied, at: stamp },
          ],
        }));
        return applied;
      },
      paySale: (saleId, amount) => {
        const sale = get().sales.find((item) => item.id === saleId);
        if (!sale) return 0;
        const due = Math.max(0, saleBalance(sale));
        const applied = roundMoney(Math.min(Math.max(0, amount), due));
        if (applied <= 0) return 0;
        set((state) => ({
          sales: state.sales.map((item) =>
            item.id === saleId ? { ...item, paid: roundMoney(item.paid + applied) } : item,
          ),
        }));
        return applied;
      },
      updateJob: (jobId, patch) =>
        set((state) => {
          const found = state.jobs.find((job) => job.id === jobId);
          if (!found) return state;
          const price = patch.price === undefined ? found.price : roundMoney(Math.max(0, patch.price));
          const paid =
            patch.paid === undefined ? found.paid : roundMoney(Math.max(0, Math.min(patch.paid, price)));
          const quantity =
            patch.quantity === undefined ? found.quantity : Math.max(1, Math.round(patch.quantity) || 1);
          const stamp = now();
          let updated: Job = { ...found, ...patch, price, paid, quantity, updatedAt: stamp };
          let ledger = ledgerOf(state);
          // Si cambió la cantidad, solo se mueve la diferencia de insumos (nunca se descuenta doble).
          if (found.used && found.used.length > 0 && quantity !== found.quantity) {
            const spent = applyJobUse(
              ledger,
              found.used,
              found.used.map((u) => ({ supplyId: u.supplyId, per: u.per, by: u.by })),
              quantity,
              { label: `Trabajo #${found.number} (${found.typeName})`, at: stamp, newId: uid },
            );
            ledger = spent.ledger;
            updated = { ...updated, used: spent.used };
          }
          return {
            jobs: state.jobs.map((job) => (job.id === jobId ? updated : job)),
            supplies: ledger.supplies,
            moves: ledger.moves,
          };
        }),
      addCustomer: (name, phone) => {
        const cleanName = name.trim();
        const cleanPhone = phone.trim();
        const found = findDuplicate(get().customers, cleanName, cleanPhone);
        if (found) return found.id;
        const id = uid();
        set((state) => ({ customers: [...state.customers, { id, name: cleanName, phone: cleanPhone }] }));
        return id;
      },
      updateCustomer: (id, patch) =>
        set((state) => ({
          customers: state.customers.map((customer) => {
            if (customer.id !== id) return customer;
            const next: Customer = {
              ...customer,
              name: patch.name?.trim() || customer.name,
              phone: patch.phone === undefined ? customer.phone : patch.phone.trim(),
            };
            if (patch.billing === undefined) return next;
            const { billing: _old, ...rest } = next;
            const billing = normalizeBilling(patch.billing);
            return billing ? { ...rest, billing } : rest;
          }),
        })),
      deleteJob: (jobId) =>
        set((state) => {
          const found = state.jobs.find((job) => job.id === jobId);
          if (!found) return state;
          // Se devuelve al inventario lo que el trabajo había gastado; el historial lo deja anotado.
          const ledger = releaseJobUse(ledgerOf(state), found.used, {
            label: `Trabajo #${found.number} (${found.typeName})`,
            at: now(),
            newId: uid,
          });
          return {
            jobs: state.jobs.filter((job) => job.id !== jobId),
            payments: state.payments.filter((payment) => payment.jobId !== jobId),
            supplies: ledger.supplies,
            moves: ledger.moves,
          };
        }),
      deleteSale: (saleId) => {
        const found = get().sales.find((sale) => sale.id === saleId);
        if (!found) return false;
        set((state) => {
          // Se devuelve al inventario lo que la venta había descontado; el historial lo deja anotado.
          const ledger = releaseSale(ledgerOf(state), found, { label: `Venta #${found.number}`, at: now(), newId: uid });
          return {
            sales: state.sales.filter((sale) => sale.id !== saleId),
            goods: ledger.goods,
            moves: ledger.moves,
          };
        });
        return true;
      },
      deleteCustomer: (id) => {
        const state = get();
        if (!state.customers.some((customer) => customer.id === id)) return false;
        if (!canRemoveCustomer(customerUse(id, state.jobs, state.sales, state.payments))) return false;
        set({
          customers: state.customers.filter((customer) => customer.id !== id),
          // Pagos sueltos de trabajos que ya no existen: se van con el cliente.
          payments: state.payments.filter((payment) => payment.customerId !== id),
        });
        return true;
      },
      replaceAll: (snap) =>
        set({
          version: 2,
          drawers: snap.drawers,
          types: snap.types,
          customers: snap.customers,
          jobs: snap.jobs,
          payments: snap.payments,
          goods: snap.goods ?? SEED_GOODS,
          sales: snap.sales ?? [],
          supplies: snap.supplies ?? [],
          moves: snap.moves ?? [],
          nextNumber: snap.nextNumber,
        }),
    }),
    {
      name: "la-letra-v1",
      skipHydration: true,
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<Snapshot>;
        return {
          ...current,
          ...saved,
          goods: (() => {
            // Add newly introduced defaults while preserving all saved prices and custom goods.
            const prior = Array.isArray(saved.goods) ? saved.goods : [];
            const byId = new Map(prior.map((good) => [good.id, good]));
            const seedIds = new Set(current.goods.map((good) => good.id));
            return [
              ...current.goods.map((good) => ({ ...good, ...byId.get(good.id) })),
              ...prior.filter((good) => !seedIds.has(good.id)),
            ];
          })(),
          sales: Array.isArray(saved.sales) ? saved.sales : [],
          supplies: Array.isArray(saved.supplies) ? saved.supplies : [],
          moves: Array.isArray(saved.moves) ? saved.moves : [],
        };
      },
    },
  ),
);
