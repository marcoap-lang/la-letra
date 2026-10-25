import assert from "node:assert/strict";
import { test } from "node:test";
import {
  billingText,
  cleanRfc,
  findDuplicate,
  matchesCustomer,
  normalizeBilling,
  normalizeCustomer,
  rfcHint,
  sortCustomers,
  statsByCustomer,
  type Customer,
} from "./customers.ts";

const people: Customer[] = [
  { id: "1", name: "María López", phone: "951 555 0101" },
  { id: "2", name: "Álvaro Díaz", phone: "" },
  { id: "3", name: "Zoila", phone: "9515550103" },
];

test("RFC: mayúsculas, sin espacios; aviso suave solo si el largo no cuadra", () => {
  assert.equal(cleanRfc(" abc-010203 xy1 "), "ABC010203XY1");
  assert.equal(rfcHint("ABC010203XY1"), "");
  assert.equal(rfcHint("ABC010203XY"), "El RFC normalmente tiene 12 o 13 letras y números. Revíselo; igual lo puede guardar.");
  assert.equal(rfcHint(""), "");
  assert.equal(rfcHint("XAXX010101000"), "");
  assert.equal(cleanRfc("ñandú&co"), "ÑAND&CO");
});

test("normalizeBilling: todo vacío = sin datos; limpia campos", () => {
  assert.equal(normalizeBilling(undefined), undefined);
  assert.equal(normalizeBilling({ rfc: " ", name: "", zip: "" }), undefined);
  const b = normalizeBilling({ rfc: "abc010203xy1", name: "  Mi Empresa SA ", zip: "68 300x", extra: 5 });
  assert.deepEqual(b, { rfc: "ABC010203XY1", name: "Mi Empresa SA", email: "", zip: "68300", regime: "", cfdiUse: "" });
});

test("snapshots viejos (sin billing) pasan igual; billing dañado se descarta", () => {
  const old = normalizeCustomer({ id: "1", name: "A", phone: "" });
  assert.deepEqual(old, { id: "1", name: "A", phone: "" });
  assert.equal("billing" in old, false);
  const bad = normalizeCustomer({ id: "1", name: "A", phone: "", billing: "x" as never });
  assert.equal("billing" in bad, false);
  const ok = normalizeCustomer({ id: "1", name: "A", phone: "", billing: { rfc: "abc010203xy1" } as never });
  assert.equal(ok.billing?.rfc, "ABC010203XY1");
});

test("texto para copiar solo trae lo capturado", () => {
  assert.equal(billingText({ name: "A", billing: undefined }), "");
  const text = billingText({
    name: "María López",
    billing: { rfc: "LOMM800101AB1", name: "María López Pérez", email: "", zip: "68300", regime: "Persona física", cfdiUse: "" },
  });
  assert.equal(
    text,
    "Datos para factura\nCliente: María López\nRFC: LOMM800101AB1\nRazón social: María López Pérez\nCódigo postal fiscal: 68300\nRégimen fiscal: Persona física",
  );
});

test("duplicado: mismo nombre sin acentos/mayúsculas y mismo teléfono (solo dígitos)", () => {
  assert.equal(findDuplicate(people, "maria lopez", "9515550101")?.id, "1");
  assert.equal(findDuplicate(people, "maria lopez", "9515550999"), undefined);
  assert.equal(findDuplicate(people, "ALVARO DIAZ", "")?.id, "2");
  assert.equal(findDuplicate(people, "maria lopez", "9515550101", "1"), undefined);
});

test("buscador y orden alfabético", () => {
  assert.equal(matchesCustomer(people[0], "lopez"), true);
  assert.equal(matchesCustomer(people[1], "alvaro"), true);
  assert.equal(matchesCustomer(people[0], "555 0101"), true);
  assert.equal(matchesCustomer(people[0], "0199"), false);
  assert.deepEqual(sortCustomers(people).map((c) => c.id), ["2", "1", "3"]);
});

test("conteo de trabajos, ventas y saldo", () => {
  const stats = statsByCustomer(
    [
      { customerId: "1", price: 100, paid: 40 },
      { customerId: "1", price: 50, paid: 50 },
    ],
    [
      { customerId: "1", total: 30, paid: 10 },
      { customerId: null, total: 99, paid: 0 },
      { customerId: "3", total: 10, paid: 10 },
    ],
  );
  assert.deepEqual(stats.get("1"), { jobs: 2, sales: 1, owed: 80 });
  assert.deepEqual(stats.get("3"), { jobs: 0, sales: 1, owed: 0 });
  assert.equal(stats.get("2"), undefined);
});

import { canRemoveCustomer, customerUse } from "./customers.ts";

test("cliente sin nada ligado se puede quitar; con trabajos, ventas o pagos de un trabajo vivo no", () => {
  const jobs = [{ id: "j1", customerId: "a" }];
  const sales = [{ customerId: "b" }, { customerId: null }];
  const payments = [{ jobId: "j1", customerId: "a" }, { jobId: "borrado", customerId: "c" }];
  assert.deepEqual(customerUse("a", jobs, sales, payments), { jobs: 1, sales: 0, payments: 1 });
  assert.equal(canRemoveCustomer(customerUse("a", jobs, sales, payments)), false);
  assert.equal(canRemoveCustomer(customerUse("b", jobs, sales, payments)), false);
  assert.equal(canRemoveCustomer(customerUse("z", jobs, sales, payments)), true);
  // pago huérfano (su trabajo ya no existe): no bloquea
  assert.equal(canRemoveCustomer(customerUse("c", jobs, sales, payments)), true);
});
