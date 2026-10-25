import assert from "node:assert/strict";
import { test } from "node:test";
import {
  collectedItems,
  computeStats,
  dayKey,
  localDay,
  moneyBar,
  monthlyResults,
  rangeOf,
  rangeText,
  receivableOf,
  type StatsData,
} from "./stats.ts";

// Hora de México (sin horario de verano desde 2022). Las pruebas se corren con TZ=America/Mexico_City.
process.env.TZ = "America/Mexico_City";

// Domingo 25 de octubre de 2026, 5:05 pm hora de México.
const NOW = new Date("2026-10-25T23:05:00Z");

const job = (id: string, over: Record<string, unknown> = {}) =>
  ({
    id, number: 1, customerId: "c1", typeId: "sellos", typeName: "Sello automático", needsProof: false,
    quantity: 1, due: "2026-10-30", notes: "", price: 100, paid: 0, status: "nuevo",
    createdAt: "2026-10-25T20:00:00Z", updatedAt: "2026-10-25T20:00:00Z", ...over,
  }) as StatsData["jobs"][number];
const sale = (id: string, over: Record<string, unknown> = {}) =>
  ({
    id, number: 2, customerId: null, customerName: "Mostrador",
    lines: [{ goodId: "cuaderno", name: "Cuaderno", qty: 2, price: 30 }],
    total: 60, paid: 60, createdAt: "2026-10-25T20:00:00Z", ...over,
  }) as StatsData["sales"][number];
const pay = (id: string, jobId: string, amount: number, at: string) =>
  ({ id, jobId, customerId: "c1", amount, at }) as StatsData["payments"][number];

const empty: StatsData = { jobs: [], payments: [], sales: [], customers: [], goods: [], supplies: [] };
const customers = [
  { id: "c1", name: "Ana", phone: "" },
  { id: "c2", name: "Beto", phone: "" },
];

test("la prueba corre en hora de México", () => {
  assert.equal(new Date("2026-10-26T03:30:00Z").getDate(), 25);
});

test("día local: las 9:30 pm del 25 en México (03:30 UTC del 26) siguen siendo 25", () => {
  assert.equal(localDay("2026-10-26T03:30:00Z"), "2026-10-25");
  assert.equal(localDay("2026-10-25T06:00:00Z"), "2026-10-25");
  assert.equal(localDay("2026-10-25T05:59:00Z"), "2026-10-24");
  assert.equal(localDay("2026-10-25"), "2026-10-25");
  assert.equal(localDay("basura"), null);
  assert.equal(localDay(""), null);
  assert.equal(dayKey(NOW), "2026-10-25");
});

test("periodos: hoy, semana (lunes a domingo), mes y año", () => {
  assert.deepEqual(rangeOf("hoy", NOW), { id: "hoy", start: "2026-10-25", end: "2026-10-25" });
  // 25/oct/2026 es domingo: la semana va del lunes 19 al domingo 25.
  assert.deepEqual(rangeOf("semana", NOW), { id: "semana", start: "2026-10-19", end: "2026-10-25" });
  assert.deepEqual(rangeOf("mes", NOW), { id: "mes", start: "2026-10-01", end: "2026-10-31" });
  assert.deepEqual(rangeOf("anio", NOW), { id: "anio", start: "2026-01-01", end: "2026-12-31" });
  // Lunes 26: la semana empieza ese mismo día; cruza de mes.
  assert.deepEqual(rangeOf("semana", new Date("2026-10-28T18:00:00Z")), { id: "semana", start: "2026-10-26", end: "2026-11-01" });
  assert.equal(rangeText(rangeOf("semana", new Date("2026-10-28T18:00:00Z"))), "del 26 de octubre al 1 de noviembre");
  assert.equal(rangeText(rangeOf("semana", NOW)), "del 19 al 25 de octubre");
  assert.equal(rangeText(rangeOf("hoy", NOW)), "domingo 25 de octubre");
  assert.equal(rangeText(rangeOf("mes", NOW)), "octubre 2026");
  assert.equal(rangeText(rangeOf("anio", NOW)), "2026");
});

test("límites de 'hoy': 23:59 local entra, 00:00 local del día siguiente no", () => {
  // "ahora" = 25 oct 11:59 pm México (05:59 UTC del 26).
  const late = new Date("2026-10-26T05:59:00Z");
  const data: StatsData = {
    ...empty,
    jobs: [
      job("a", { createdAt: "2026-10-26T05:58:00Z", price: 10 }), // 25 oct 11:58 pm → hoy
      job("b", { createdAt: "2026-10-26T06:00:00Z", price: 1000 }), // 26 oct 12:00 am → mañana
      job("c", { createdAt: "2026-10-25T05:59:00Z", price: 500 }), // 24 oct 11:59 pm → ayer
      job("d", { createdAt: "2026-10-25T06:00:00Z", price: 5 }), // 25 oct 12:00 am → hoy
    ],
  };
  const s = computeStats(data, "hoy", late);
  assert.equal(s.sold, 15);
  assert.equal(s.jobsCount, 2);
});

test("Vendido = trabajos + ventas por fecha de creación; fuera del periodo no cuenta", () => {
  const data: StatsData = {
    ...empty,
    customers,
    jobs: [job("a", { price: 200 }), job("b", { price: 300, createdAt: "2026-10-03T18:00:00Z" }), job("c", { price: 999, createdAt: "2026-09-30T18:00:00Z" })],
    sales: [sale("s1", { total: 60 }), sale("s2", { total: 40, createdAt: "2026-10-10T18:00:00Z" }), sale("s3", { total: 500, createdAt: "2025-10-10T18:00:00Z" })],
  };
  assert.equal(computeStats(data, "hoy", NOW).sold, 260);
  assert.equal(computeStats(data, "semana", NOW).sold, 260);
  assert.equal(computeStats(data, "mes", NOW).sold, 600);
  assert.equal(computeStats(data, "anio", NOW).sold, 600 + 999);
});

test("Cobrado: pagos de trabajos por su fecha; ventas por la fecha de la venta; sin duplicar", () => {
  const data: StatsData = {
    ...empty,
    // Trabajo creado en septiembre con anticipo ese día y un pago hoy.
    jobs: [job("a", { price: 500, paid: 300, createdAt: "2026-09-20T18:00:00Z" })],
    payments: [
      pay("p1", "a", 100, "2026-09-20T18:00:00Z"),
      pay("p2", "a", 200, "2026-10-25T20:00:00Z"),
      pay("huerfano", "borrado", 999, "2026-10-25T20:00:00Z"),
    ],
    sales: [sale("s1", { total: 60, paid: 40 })],
  };
  assert.equal(computeStats(data, "hoy", NOW).collected, 240);
  assert.equal(computeStats(data, "mes", NOW).collected, 240);
  const sept = computeStats(data, "mes", new Date("2026-09-30T18:00:00Z"));
  assert.equal(sept.collected, 100);
  assert.equal(collectedItems(data).length, 3);
});

test("Por cobrar: saldo de hoy de trabajos y ventas, sin depender del periodo", () => {
  const data: StatsData = {
    ...empty,
    jobs: [job("a", { price: 500, paid: 300, createdAt: "2025-01-05T18:00:00Z" }), job("b", { price: 100, paid: 100 })],
    sales: [sale("s1", { total: 60, paid: 40 })],
  };
  assert.equal(receivableOf(data), 220);
  for (const id of ["hoy", "semana", "mes", "anio"] as const) assert.equal(computeStats(data, id, NOW).receivable, 220);
});

test("Trabajos: hechos (listo o entregado) y pendientes del periodo", () => {
  const data: StatsData = {
    ...empty,
    jobs: [
      job("a", { status: "nuevo" }),
      job("b", { status: "aprobado" }),
      job("c", { status: "listo" }),
      job("d", { status: "entregado" }),
      job("e", { status: "entregado", createdAt: "2026-01-02T18:00:00Z" }),
    ],
  };
  const s = computeStats(data, "mes", NOW);
  assert.deepEqual([s.jobsCount, s.jobsDone, s.jobsPending], [4, 2, 2]);
});

test("Listas de los 5 principales", () => {
  const types = ["A", "B", "C", "D", "E", "F"];
  const jobs = types.flatMap((t, i) => Array.from({ length: 6 - i }, (_, n) => job(`${t}${n}`, { typeId: t, typeName: `Tipo ${t}`, price: 10 })));
  const sales = [
    sale("s1", { customerId: "c2", lines: [{ goodId: "g1", name: "Cuaderno", qty: 5, price: 10 }, { goodId: "g2", name: "Lápiz", qty: 1, price: 4 }], total: 54 }),
    sale("s2", { customerId: null, lines: [{ goodId: "g1", name: "Cuaderno", qty: 2, price: 10 }], total: 20 }),
  ];
  const s = computeStats({ ...empty, customers, jobs, sales }, "mes", NOW);
  assert.equal(s.topTypes.length, 5);
  assert.deepEqual(s.topTypes.map((r) => [r.name, r.count]), [["Tipo A", 6], ["Tipo B", 5], ["Tipo C", 4], ["Tipo D", 3], ["Tipo E", 2]]);
  assert.deepEqual(s.topGoods.map((r) => [r.name, r.count, r.amount]), [["Cuaderno", 7, 70], ["Lápiz", 1, 4]]);
  // Ana: 21 trabajos de 10 = 210; Beto: una venta de 54. Mostrador no sale en clientes.
  assert.deepEqual(s.topCustomers.map((r) => [r.name, r.amount]), [["Ana", 210], ["Beto", 54]]);
});

test("Ventas por día: semana (7 días, lunes a domingo), mes (todos los días) y año (por mes)", () => {
  const data: StatsData = {
    ...empty,
    jobs: [job("a", { price: 100 }), job("b", { price: 50, createdAt: "2026-10-20T18:00:00Z" }), job("c", { price: 7, createdAt: "2026-03-05T18:00:00Z" })],
    sales: [sale("s1", { total: 60 })],
  };
  const w = computeStats(data, "semana", NOW);
  assert.equal(w.barsBy, "dia");
  assert.deepEqual(w.bars.map((b) => b.label), ["L", "M", "M", "J", "V", "S", "D"]);
  assert.deepEqual(w.bars.map((b) => b.value), [0, 50, 0, 0, 0, 0, 160]);
  assert.equal(w.bars[6].current, true);
  assert.equal(w.bestBar?.key, "2026-10-25");
  const m = computeStats(data, "mes", NOW);
  assert.equal(m.bars.length, 31);
  assert.equal(m.bars[24].value, 160);
  assert.equal(m.bars[25].future, true);
  const y = computeStats(data, "anio", NOW);
  assert.equal(y.barsBy, "mes");
  assert.equal(y.bars.length, 12);
  assert.equal(y.bars[2].value, 7);
  assert.equal(y.bars[9].value, 210);
  assert.equal(y.bars[9].current, true);
  assert.equal(y.bars[10].future, true);
});

test("Resultados por mes: 12 meses con el actual primero, cambio de año y meses en 0", () => {
  const now = new Date("2026-02-10T18:00:00Z");
  const data: StatsData = {
    ...empty,
    jobs: [
      job("a", { price: 100, paid: 100, createdAt: "2026-02-03T18:00:00Z" }),
      job("b", { price: 400, paid: 150, createdAt: "2025-12-31T23:00:00Z" }), // 31 dic 5 pm México
      job("c", { price: 900, createdAt: "2025-01-15T18:00:00Z" }), // hace más de 12 meses
      job("d", { price: 25, createdAt: "2025-03-01T18:00:00Z" }), // el mes más viejo
    ],
    payments: [
      pay("p1", "a", 100, "2026-02-03T18:00:00Z"),
      pay("p2", "b", 50, "2025-12-31T23:00:00Z"),
      pay("p3", "b", 100, "2026-01-02T18:00:00Z"),
    ],
    sales: [sale("s1", { total: 60, paid: 60, createdAt: "2026-02-04T18:00:00Z" })],
  };
  const rows = monthlyResults(data, now);
  assert.equal(rows.length, 12);
  assert.deepEqual(rows.map((r) => `${r.month}${r.year}`), [
    "feb2026", "ene2026", "dic2025", "nov2025", "oct2025", "sep2025", "ago2025", "jul2025", "jun2025", "may2025", "abr2025", "mar2025",
  ]);
  assert.equal(rows[0].current, true);
  assert.equal(rows.filter((r) => r.current).length, 1);
  assert.deepEqual([rows[0].sold, rows[0].collected], [160, 160]);
  assert.deepEqual([rows[1].sold, rows[1].collected], [0, 100]);
  assert.deepEqual([rows[2].sold, rows[2].collected], [400, 50]);
  assert.deepEqual([rows[3].sold, rows[3].collected], [0, 0]);
  assert.deepEqual([rows[11].sold, rows[11].collected], [25, 0]);
  // ene 2025 queda fuera de los 12 meses.
  assert.equal(rows.reduce((t, r) => t + r.sold, 0), 585);
});

test("Resultados por mes no dependen del periodo y son independientes de la hora UTC", () => {
  const data: StatsData = { ...empty, jobs: [job("a", { price: 100, createdAt: "2026-11-01T05:30:00Z" })] }; // 31 oct 11:30 pm México
  const oct = monthlyResults(data, NOW);
  assert.equal(oct[0].sold, 100);
});

test("Datos vacíos: todo en 0, sin avisar de datos", () => {
  const s = computeStats(empty, "mes", NOW);
  assert.deepEqual([s.sold, s.collected, s.receivable, s.jobsCount, s.jobsDone, s.jobsPending, s.lowStock], [0, 0, 0, 0, 0, 0, 0]);
  assert.equal(s.hasData, false);
  assert.deepEqual([s.topTypes, s.topGoods, s.topCustomers], [[], [], []]);
  assert.equal(s.bestBar, null);
  assert.ok(s.bars.every((b) => b.value === 0));
  const rows = monthlyResults(empty, NOW);
  assert.equal(rows.length, 12);
  assert.ok(rows.every((r) => r.sold === 0 && r.collected === 0));
});

test("Por acabarse usa el inventario existente", () => {
  const s = computeStats(
    { ...empty, goods: [{ id: "g", name: "Cuaderno", price: 1, hidden: false, stock: 1, min: 2 }], supplies: [{ id: "i", name: "Tinta", unit: "frasco", qty: 0, min: 1 }] },
    "mes",
    NOW,
  );
  assert.equal(s.lowStock, 2);
});

test("hasData: solo un cobro en el periodo ya cuenta como dato", () => {
  const data: StatsData = {
    ...empty,
    jobs: [job("a", { createdAt: "2026-01-05T18:00:00Z", price: 100, paid: 100 })],
    payments: [pay("p", "a", 100, "2026-10-25T20:00:00Z")],
  };
  const s = computeStats(data, "hoy", NOW);
  assert.equal(s.hasData, true);
  assert.equal(s.sold, 0);
  assert.equal(s.collected, 100);
});

test("pesos en barras: enteros y 'millones' desde un millón", () => {
  assert.equal(moneyBar(0), "$0");
  assert.equal(moneyBar(1234.56).replace(/\s/g, ""), "$1,235");
  assert.equal(moneyBar(99999).replace(/\s/g, ""), "$99,999");
  assert.equal(moneyBar(1_250_000), "$1.3 millones");
  assert.equal(moneyBar(1_000_000), "$1 millón");
});
