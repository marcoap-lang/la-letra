import assert from "node:assert/strict";
import { test } from "node:test";
import { alertsOf, applyAdjust, applyChange, applyJobUse, releaseJobUse, stockState, type Ledger } from "./inventory.ts";

let n = 0;
const newId = () => `m${++n}`;
const at = "2026-10-24T12:00:00.000Z";
const ctx = { label: "Trabajo #1001 (Sello automático)", at, newId };

function base(): Ledger {
  return {
    goods: [
      { id: "pluma", name: "Bolígrafo", price: 5, hidden: false, stock: 10, min: 4 },
      { id: "lapiz", name: "Lápiz", price: 4, hidden: false },
    ],
    supplies: [{ id: "caja-sellos", name: "Cajas de sellos", unit: "caja", qty: 3, min: 1 }],
    moves: [],
  };
}
const uses = [{ supplyId: "caja-sellos", per: 1, by: "pieza" as const }];

test("venta descuenta y los artículos sin control no marcan error", () => {
  let l = base();
  l = applyChange(l, { what: "good", id: "pluma", delta: -3, kind: "venta", reason: "Venta #1", at, moveId: newId() }).ledger;
  assert.equal(l.goods[0].stock, 7);
  const r = applyChange(l, { what: "good", id: "lapiz", delta: -2, kind: "venta", reason: "Venta #2", at, moveId: newId() });
  assert.equal(r.ledger, l); // sin cambios
  assert.equal(l.moves.length, 1);
});

test("nunca baja de 0: deja 0, marca revisar y anota lo que faltó", () => {
  const r = applyChange(base(), { what: "good", id: "pluma", delta: -15, kind: "venta", reason: "Venta #3", at, moveId: newId() });
  assert.equal(r.ledger.goods[0].stock, 0);
  assert.equal(r.ledger.goods[0].review, true);
  assert.equal(r.short, 5);
  assert.equal(r.ledger.moves[0].change, -10);
  // "Llegó" limpia el aviso de revisar
  const l2 = applyChange(r.ledger, { what: "good", id: "pluma", delta: 20, kind: "entrada", reason: "Llegó", at, moveId: newId(), clearReview: true }).ledger;
  assert.equal(l2.goods[0].stock, 20);
  assert.equal(l2.goods[0].review, false);
});

test("trabajo: descuenta por pieza una sola vez y guarda lo gastado", () => {
  const r = applyJobUse(base(), undefined, uses, 2, ctx);
  assert.equal(r.ledger.supplies[0].qty, 1);
  assert.deepEqual(r.used.map((u) => [u.want, u.took]), [[2, 2]]);
  // repetir con el mismo tamaño no descuenta otra vez
  const again = applyJobUse(r.ledger, r.used, r.used, 2, ctx);
  assert.equal(again.ledger.supplies[0].qty, 1);
  assert.equal(again.ledger.moves.length, r.ledger.moves.length);
});

test("modo 'todo el trabajo' ignora la cantidad", () => {
  const r = applyJobUse(base(), undefined, [{ supplyId: "caja-sellos", per: 1, by: "trabajo" }], 50, ctx);
  assert.equal(r.ledger.supplies[0].qty, 2);
});

test("editar cantidad: solo mueve la diferencia (sube y baja)", () => {
  const first = applyJobUse(base(), undefined, uses, 1, ctx);
  const up = applyJobUse(first.ledger, first.used, first.used, 3, ctx);
  assert.equal(up.ledger.supplies[0].qty, 0); // 3 - 3
  assert.equal(up.used[0].took, 3);
  const down = applyJobUse(up.ledger, up.used, up.used, 2, ctx);
  assert.equal(down.ledger.supplies[0].qty, 1);
  assert.equal(down.used[0].took, 2);
});

test("si faltó insumo, al bajar la cantidad solo se devuelve lo que de verdad se descontó", () => {
  const l = base(); // hay 3
  const first = applyJobUse(l, undefined, uses, 5, ctx); // piden 5, solo 3
  assert.equal(first.ledger.supplies[0].qty, 0);
  assert.equal(first.ledger.supplies[0].review, true);
  assert.equal(first.used[0].took, 3);
  const down = applyJobUse(first.ledger, first.used, first.used, 4, ctx); // quita 1 pero no devuelve de más
  assert.equal(down.ledger.supplies[0].qty, 1);
  assert.equal(down.used[0].took, 2);
  assert.equal(down.used[0].want, 4);
});

test("borrar el trabajo devuelve lo gastado (no más)", () => {
  const first = applyJobUse(base(), undefined, uses, 5, ctx);
  const back = releaseJobUse(first.ledger, first.used, ctx);
  assert.equal(back.supplies[0].qty, 3); // vuelve a lo que había
  // trabajos viejos sin 'used' no cambian nada
  assert.equal(releaseJobUse(back, undefined, ctx), back);
});

test("ajustar pone la cantidad real, guarda la diferencia y limpia revisar", () => {
  const r = applyChange(base(), { what: "supply", id: "caja-sellos", delta: -9, kind: "trabajo", reason: "x", at, moveId: newId() });
  const adj = applyAdjust(r.ledger, { what: "supply", id: "caja-sellos", qty: 6, min: 2, reason: "conteo", at, moveId: newId() });
  assert.equal(adj.supplies[0].qty, 6);
  assert.equal(adj.supplies[0].min, 2);
  assert.equal(adj.supplies[0].review, false);
  assert.equal(adj.moves[0].change, 6);
  assert.equal(adj.moves[0].kind, "ajuste");
});

test("avisos: solo en o debajo del mínimo, agotados primero, nada si todo está bien", () => {
  assert.deepEqual(alertsOf(base().goods, base().supplies), []);
  const l = base();
  l.goods[0].stock = 4; // = mínimo
  l.supplies[0].qty = 0;
  const a = alertsOf(l.goods, l.supplies);
  assert.deepEqual(a.map((x) => [x.name, x.state]), [["Cajas de sellos", "agotado"], ["Bolígrafo", "poco"]]);
  assert.equal(stockState(5, 0), "ok");
  assert.equal(stockState(0, 0), "agotado");
});
