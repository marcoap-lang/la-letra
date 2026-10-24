import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SEED_DRAWERS, SEED_TYPES, type Drawer, type JobType } from "./catalog";
import { digits, norm, roundMoney } from "./format";
import { SEED_GOODS, type Good } from "./goods";

export type { Drawer, JobType, Good };

export type JobStatus = "nuevo" | "aprobado" | "listo" | "entregado";

export type Customer = { id: string; name: string; phone: string };

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
  addDrawer: (name: string) => string;
  addType: (input: { drawerId: string; name: string; needsProof: boolean }) => string;
  setTypeHidden: (id: string, hidden: boolean) => void;
  renameType: (id: string, name: string) => void;
  addGood: (name: string, price: number) => string;
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
  updateCustomer: (id: string, patch: { name?: string; phone?: string }) => void;
  deleteJob: (jobId: string) => void;
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
  };
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
  return {
    version: 2,
    drawers: value.drawers as Drawer[],
    types: value.types as JobType[],
    customers: value.customers as Customer[],
    jobs: value.jobs as Job[],
    payments: value.payments as Payment[],
    nextNumber: value.nextNumber,
    goods,
    sales,
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
      addGood: (name, price) => {
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
          goods: [...state.goods, { id, name: clean, price: roundMoney(Math.max(0, price)), hidden: false }],
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
        set({
          customers,
          jobs: [job, ...state.jobs],
          payments,
          nextNumber: state.nextNumber + 1,
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
        const sale: Sale = {
          id: uid(),
          number: state.nextNumber,
          customerId,
          customerName: name || "Mostrador",
          lines,
          total,
          paid,
          createdAt: now(),
        };
        set({
          customers,
          sales: [sale, ...state.sales],
          nextNumber: state.nextNumber + 1,
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
        set((state) => ({
          jobs: state.jobs.map((job) => {
            if (job.id !== jobId) return job;
            const price = patch.price === undefined ? job.price : roundMoney(Math.max(0, patch.price));
            const paid =
              patch.paid === undefined ? job.paid : roundMoney(Math.max(0, Math.min(patch.paid, price)));
            return {
              ...job,
              ...patch,
              price,
              paid,
              quantity:
                patch.quantity === undefined ? job.quantity : Math.max(1, Math.round(patch.quantity) || 1),
              updatedAt: now(),
            };
          }),
        })),
      updateCustomer: (id, patch) =>
        set((state) => ({
          customers: state.customers.map((customer) =>
            customer.id === id
              ? {
                  ...customer,
                  name: patch.name?.trim() || customer.name,
                  phone: patch.phone === undefined ? customer.phone : patch.phone.trim(),
                }
              : customer,
          ),
        })),
      deleteJob: (jobId) => set((state) => ({ jobs: state.jobs.filter((job) => job.id !== jobId) })),
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
          goods: Array.isArray(saved.goods) && saved.goods.length > 0 ? saved.goods : current.goods,
          sales: Array.isArray(saved.sales) ? saved.sales : [],
        };
      },
    },
  ),
);
