import assert from "node:assert/strict";
import { test } from "node:test";
import { useShop, type Snapshot } from "./store.ts";

function seed(extra: Partial<Snapshot> = {}) {
  useShop.getState().replaceAll({
    version: 2,
    drawers: [{ id: "d", name: "Sellos" }],
    types: [{ id: "t", drawerId: "d", name: "Sello automático", needsProof: false, hidden: false }],
    customers: [
      { id: "c1", name: "Con trabajo", phone: "1" },
      { id: "c2", name: "Con venta", phone: "2" },
      { id: "c3", name: "Sin nada", phone: "3" },
    ],
    jobs: [],
    payments: [],
    nextNumber: 1001,
    goods: [
      { id: "pluma", name: "Bolígrafo", price: 5, hidden: false, stock: 10, min: 2 },
      { id: "lapiz", name: "Lápiz", price: 4, hidden: false },
    ],
    sales: [],
    supplies: [],
    moves: [],
    ...extra,
  });
}
const S = () => useShop.getState();

test("deleteSale: devuelve exactamente lo descontado y anota el ajuste", () => {
  seed();
  const id = S().saveSale({ customerId: null, name: "", phone: "", lines: [{ goodId: "pluma", name: "Bolígrafo", qty: 4, price: 5 }, { goodId: "lapiz", name: "Lápiz", qty: 2, price: 4 }], paid: 0 });
  assert.equal(S().goods.find((g) => g.id === "pluma")?.stock, 6);
  assert.equal(S().sales[0].lines[0].took, 4);
  assert.equal(S().sales[0].lines[1].took, 0);
  assert.equal(S().deleteSale(id), true);
  assert.equal(S().sales.length, 0);
  assert.equal(S().goods.find((g) => g.id === "pluma")?.stock, 10);
  assert.equal(S().goods.find((g) => g.id === "lapiz")?.stock, undefined);
  assert.equal(S().moves[0].kind, "ajuste");
  assert.equal(S().moves[0].change, 4);
  assert.match(S().moves[0].reason, /Se borró la venta #1001/);
  // repetirlo no devuelve otra vez
  assert.equal(S().deleteSale(id), false);
  assert.equal(S().goods.find((g) => g.id === "pluma")?.stock, 10);
});

test("deleteSale: si faltaba existencia, solo devuelve lo que sí se descontó", () => {
  seed();
  const id = S().saveSale({ customerId: null, name: "", phone: "", lines: [{ goodId: "pluma", name: "Bolígrafo", qty: 15, price: 5 }], paid: 0 });
  assert.equal(S().goods.find((g) => g.id === "pluma")?.stock, 0);
  S().deleteSale(id);
  assert.equal(S().goods.find((g) => g.id === "pluma")?.stock, 10);
});

test("deleteSale: venta de snapshot viejo (sin took) se devuelve por el historial", () => {
  seed();
  const id = S().saveSale({ customerId: null, name: "", phone: "", lines: [{ goodId: "pluma", name: "Bolígrafo", qty: 3, price: 5 }], paid: 0 });
  // quita el dato nuevo para simular una venta guardada antes de este cambio
  useShop.setState((s) => ({ sales: s.sales.map((x) => ({ ...x, lines: x.lines.map(({ took: _t, ...l }) => l) })) }));
  S().deleteSale(id);
  assert.equal(S().goods.find((g) => g.id === "pluma")?.stock, 10);
});

test("deleteSale: no toca otras ventas ni lo vendido después", () => {
  seed();
  const a = S().saveSale({ customerId: null, name: "", phone: "", lines: [{ goodId: "pluma", name: "Bolígrafo", qty: 2, price: 5 }], paid: 0 });
  S().saveSale({ customerId: null, name: "", phone: "", lines: [{ goodId: "pluma", name: "Bolígrafo", qty: 3, price: 5 }], paid: 0 });
  S().deleteSale(a);
  assert.equal(S().sales.length, 1);
  assert.equal(S().goods.find((g) => g.id === "pluma")?.stock, 7);
});

test("deleteCustomer: rechaza con trabajos o ventas; quita al que no tiene nada", () => {
  seed();
  S().saveJob({ customerId: "c1", name: "Con trabajo", phone: "", typeId: "t", quantity: 1, due: "2026-11-01", notes: "", price: 100, paid: 50 });
  S().saveSale({ customerId: "c2", name: "Con venta", phone: "", lines: [{ goodId: "pluma", name: "Bolígrafo", qty: 1, price: 5 }], paid: 0 });
  assert.equal(S().deleteCustomer("c1"), false);
  assert.equal(S().deleteCustomer("c2"), false);
  assert.equal(S().customers.length, 3);
  assert.equal(S().deleteCustomer("c3"), true);
  assert.deepEqual(S().customers.map((c) => c.id), ["c1", "c2"]);
  assert.equal(S().deleteCustomer("c3"), false);
  // al borrar sus cosas ya se puede quitar
  S().deleteJob(S().jobs[0].id);
  assert.equal(S().deleteCustomer("c1"), true);
  S().deleteSale(S().sales[0].id);
  assert.equal(S().deleteCustomer("c2"), true);
  assert.equal(S().customers.length, 0);
});

test("deleteCustomer: limpia pagos huérfanos de un snapshot viejo", () => {
  seed({ payments: [{ id: "p", jobId: "ya-no-existe", customerId: "c3", amount: 10, at: "2026-10-01" }, { id: "q", jobId: "otro", customerId: "c1", amount: 5, at: "2026-10-01" }] });
  assert.equal(S().deleteCustomer("c3"), true);
  assert.deepEqual(S().payments.map((p) => p.id), ["q"]);
});

test("deleteJob: también quita los pagos del trabajo (y solo esos)", () => {
  seed();
  const j1 = S().saveJob({ customerId: "c1", name: "Con trabajo", phone: "", typeId: "t", quantity: 1, due: "2026-11-01", notes: "", price: 100, paid: 30 });
  const j2 = S().saveJob({ customerId: "c1", name: "Con trabajo", phone: "", typeId: "t", quantity: 1, due: "2026-11-01", notes: "", price: 100, paid: 20 });
  S().addPayment(j1, 10);
  assert.equal(S().payments.filter((p) => p.jobId === j1).length, 2);
  S().deleteJob(j1);
  assert.equal(S().jobs.length, 1);
  assert.deepEqual(S().payments.map((p) => p.jobId), [j2]);
});
