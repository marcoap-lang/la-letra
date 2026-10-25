import { useMemo, useState } from "react";
import { Boxes } from "lucide-react";
import { useShop } from "@/lib/shop/store";
import { formatMoney } from "@/lib/shop/format";
import {
  PERIODS,
  computeStats,
  dayText,
  moneyBar,
  monthText,
  monthlyResults,
  rangeText,
  type Bar,
  type PeriodId,
  type Ranked,
} from "@/lib/shop/stats";
import { Frame, Primary } from "./ui";

const SOLD = "bg-stamp";
const COLLECTED = "bg-emerald-600";

function bigMoney(value: number) {
  return value >= 1_000_000 ? moneyBar(value) : formatMoney(value);
}

function Card({ title, value, note, tone }: { title: string; value: string; note: string; tone?: "warn" }) {
  return (
    <div className="min-w-0 rounded-3xl border border-line/80 bg-card p-4 shadow-ticket sm:p-5">
      <p className="text-base font-bold text-muted">{title}</p>
      <p className={`mt-1 break-words text-2xl font-extrabold tabular-nums sm:text-3xl ${tone === "warn" ? "text-amber-800" : "text-ink"}`}>{value}</p>
      <p className="mt-1 text-sm text-muted sm:text-base">{note}</p>
    </div>
  );
}

function Block({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line/80 bg-card p-4 shadow-ticket sm:p-6">
      <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h2>
      {hint ? <p className="mt-1 text-base text-muted">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TopList({ rows, detail }: { rows: Ranked[]; detail: (row: Ranked) => string }) {
  const max = Math.max(1, ...rows.map((row) => row.count || row.amount));
  return (
    <ol className="flex flex-col gap-4">
      {rows.map((row, index) => (
        <li key={row.key} className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-tint text-lg font-extrabold text-stamp">{index + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="min-w-0 break-words text-lg font-semibold">{row.name}</span>
              <span className="shrink-0 text-base font-bold tabular-nums text-ink">{detail(row)}</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-paper">
              <div className={`h-2 rounded-full ${SOLD}`} style={{ width: `${Math.max(4, ((row.count || row.amount) / max) * 100)}%` }} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Columns({ bars, by }: { bars: Bar[]; by: "dia" | "mes" }) {
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  const dense = bars.length > 12;
  const showAmount = bars.length <= 7;
  const showLabel = (bar: Bar, i: number) => !dense || i === 0 || (i + 1) % 5 === 0 || bar.current;
  return (
    <div role="img" aria-label="Ventas por día" className={`flex ${dense ? "gap-0.5" : "gap-1"}`}>
      {bars.map((bar, i) => (
        <div key={bar.key} className="flex min-w-0 flex-1 flex-col items-center" title={`${bar.label}: ${moneyBar(bar.value)}`}>
          <span className="h-5 max-w-full whitespace-nowrap text-[11px] font-semibold tabular-nums text-muted sm:text-xs">
            {showAmount && bar.value > 0 ? moneyBar(bar.value).replace("$", "") : ""}
          </span>
          <div className="flex h-36 w-full items-end sm:h-44">
            <div
              className={`w-full rounded-t-md ${bar.future ? "bg-line/60" : bar.current ? "bg-stamp-dark" : "bg-stamp/80"}`}
              style={{ height: bar.value > 0 ? `${Math.max(3, (bar.value / max) * 100)}%` : "3px", opacity: bar.value > 0 || bar.future ? 1 : 0.35 }}
            />
          </div>
          <span className={`mt-1 h-5 text-xs sm:text-sm ${bar.current ? "font-extrabold text-stamp" : "font-semibold text-muted"}`}>
            {showLabel(bar, i) ? bar.label : ""}
          </span>
        </div>
      ))}
      <span className="sr-only">{by === "mes" ? "por mes" : "por día"}</span>
    </div>
  );
}

function Legend() {
  return (
    <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-base font-semibold">
      <span className="inline-flex items-center gap-2"><span className={`size-4 rounded ${SOLD}`} /> Vendido</span>
      <span className="inline-flex items-center gap-2"><span className={`size-4 rounded ${COLLECTED}`} /> Cobrado</span>
    </div>
  );
}

export function Estadisticas({ onBack, onInventory }: { onBack: () => void; onInventory: () => void }) {
  const jobs = useShop((s) => s.jobs);
  const payments = useShop((s) => s.payments);
  const sales = useShop((s) => s.sales);
  const customers = useShop((s) => s.customers);
  const goods = useShop((s) => s.goods);
  const supplies = useShop((s) => s.supplies);
  const [period, setPeriod] = useState<PeriodId>("mes");

  const data = useMemo(() => {
    const now = new Date();
    const all = { jobs, payments, sales, customers, goods, supplies };
    return { stats: computeStats(all, period, now), months: monthlyResults(all, now) };
  }, [jobs, payments, sales, customers, goods, supplies, period]);
  const { stats: s, months } = data;
  const maxMonth = Math.max(1, ...months.map((row) => Math.max(row.sold, row.collected)));
  const width = (value: number) => (value > 0 ? `${Math.max(2, (value / maxMonth) * 100)}%` : "0%");
  const pesos = (n: number) => `${n} ${n === 1 ? "pieza" : "piezas"}`;

  return (
    <Frame onBack={onBack} narrow={false}>
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Estadísticas</h1>
      <p className="mt-1 text-lg text-muted">{rangeText(s.range)}</p>

      <div role="group" aria-label="Periodo" className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PERIODS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={period === item.id}
            onClick={() => setPeriod(item.id)}
            className={`min-h-14 rounded-2xl border px-3 text-lg font-bold ${period === item.id ? "border-stamp bg-stamp text-white shadow-sm" : "border-line bg-card text-ink hover:border-stamp/50 hover:bg-tint"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card title="Vendido" value={bigMoney(s.sold)} note="Trabajos y papelería" />
        <Card title="Cobrado" value={bigMoney(s.collected)} note="Dinero que entró" />
        <Card title="Por cobrar" value={bigMoney(s.receivable)} note="Lo que le deben hoy" tone={s.receivable > 0 ? "warn" : undefined} />
        <Card
          title="Trabajos"
          value={String(s.jobsCount)}
          note={s.jobsCount === 0 ? "Ninguno en este periodo" : `${s.jobsDone} ${s.jobsDone === 1 ? "hecho" : "hechos"} · ${s.jobsPending} ${s.jobsPending === 1 ? "pendiente" : "pendientes"}`}
        />
      </div>
      <p className="mt-2 text-sm text-muted">
        Lo cobrado de papelería se cuenta el día de la venta. "Por cobrar" es lo de hoy, sin importar el periodo.
      </p>

      <div className="mt-6 flex flex-col gap-5">
        {!s.hasData ? (
          <section className="rounded-3xl border border-line/80 bg-card p-6 text-center shadow-ticket">
            <p className="text-xl font-bold">Todavía no hay datos en este periodo</p>
            <p className="mt-1 text-base text-muted">Cuando haya ventas o trabajos, aquí aparecerán.</p>
          </section>
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-2">
              <Block title="Lo que más se hace" hint="Trabajos de imprenta">
                {s.topTypes.length > 0 ? (
                  <TopList rows={s.topTypes} detail={(row) => `${row.count} ${row.count === 1 ? "trabajo" : "trabajos"}`} />
                ) : (
                  <p className="text-base text-muted">Todavía no hay datos en este periodo</p>
                )}
              </Block>
              <Block title="Lo que más se vende" hint="Artículos de papelería">
                {s.topGoods.length > 0 ? (
                  <TopList rows={s.topGoods} detail={(row) => pesos(row.count)} />
                ) : (
                  <p className="text-base text-muted">Todavía no hay datos en este periodo</p>
                )}
              </Block>
              <Block title="Mejores clientes" hint="Los que más compraron">
                {s.topCustomers.length > 0 ? (
                  <TopList rows={s.topCustomers} detail={(row) => formatMoney(row.amount)} />
                ) : (
                  <p className="text-base text-muted">Todavía no hay datos en este periodo</p>
                )}
              </Block>
              {s.range.id !== "hoy" ? (
                <Block title={s.barsBy === "mes" ? "Ventas por mes" : "Ventas por día"} hint={s.bestBar ? `${s.barsBy === "mes" ? "Mejor mes" : "Mejor día"}: ${s.barsBy === "mes" ? monthText(s.bestBar.key).split(" ")[0] : dayText(s.bestBar.key)}, ${formatMoney(s.bestBar.value)}` : undefined}>
                  <Columns bars={s.bars} by={s.barsBy} />
                </Block>
              ) : null}
            </div>
          </>
        )}

        <Block title="Resultados por mes" hint="Los últimos 12 meses. No cambia con el periodo de arriba.">
          <Legend />
          <ul className="flex flex-col gap-2">
            {months.map((row) => (
              <li
                key={row.key}
                className={`rounded-2xl border px-3 py-3 sm:px-4 ${row.current ? "border-stamp bg-tint" : "border-line/70 bg-card"}`}
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-extrabold capitalize">{row.month}</span>
                  <span className="text-base text-muted">{row.year}</span>
                  {row.current ? <span className="rounded-full bg-stamp px-2.5 py-0.5 text-sm font-bold text-white">Este mes</span> : null}
                </div>
                {([
                  ["Vendido", row.sold, SOLD],
                  ["Cobrado", row.collected, COLLECTED],
                ] as const).map(([label, value, color]) => (
                  <div key={label} className="mt-1.5 flex items-center gap-2">
                    <span className="w-[4.25rem] shrink-0 text-sm font-semibold text-muted sm:w-20 sm:text-base">{label}</span>
                    <div className="h-4 min-w-0 flex-1 rounded-full bg-paper sm:h-5">
                      <div className={`h-full rounded-full ${color}`} style={{ width: width(value) }} />
                    </div>
                    <span className="w-24 shrink-0 text-right text-base font-bold tabular-nums sm:w-28">{moneyBar(value)}</span>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </Block>

        <button
          type="button"
          onClick={onInventory}
          className="flex min-h-16 items-center gap-4 rounded-3xl border border-line bg-card p-4 text-left shadow-ticket hover:border-stamp/40 hover:shadow-lift"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-tint text-stamp"><Boxes size={26} /></span>
          <span className="flex-1">
            <span className="block text-lg font-extrabold">Inventario</span>
            <span className={`block text-base ${s.lowStock > 0 ? "font-semibold text-amber-800" : "text-muted"}`}>
              {s.lowStock === 0 ? "Nada por acabarse" : s.lowStock === 1 ? "1 por acabarse" : `${s.lowStock} por acabarse`}
            </span>
          </span>
          <span className="text-base font-bold text-stamp">Ver</span>
        </button>
        <div>
          <Primary onClick={onBack}>Volver al inicio</Primary>
        </div>
      </div>
    </Frame>
  );
}

