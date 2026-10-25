import { useMemo, useState, type ReactNode } from "react";
import { Boxes, Search, Plus, Link2 } from "lucide-react";
import { norm } from "@/lib/shop/format";
import {
  alertsOf,
  fmtQty,
  parseQty,
  qtyText,
  stockState,
  UNITS,
  type StockState,
  type StockMove,
} from "@/lib/shop/inventory";
import { useShop, type Good, type Supply } from "@/lib/shop/store";
import { Chip, Field, Frame, Primary, Quiet } from "./ui";

export function StateBadge({ state, review }: { state: StockState; review?: boolean }) {
  if (state === "agotado")
    return <span className="rounded-lg bg-rose-100 px-2.5 py-1 text-sm font-bold text-rose-900">Se acabó</span>;
  if (state === "poco")
    return <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-sm font-bold text-amber-900">Por acabarse</span>;
  if (review)
    return <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-sm font-bold text-amber-900">Revisar</span>;
  return null;
}

function when(at: string) {
  const d = new Date(at);
  return `${d.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}, ${d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`;
}

function History({ moves }: { moves: StockMove[] }) {
  if (moves.length === 0) return <p className="text-base text-muted">Todavía no hay movimientos.</p>;
  return (
    <ul className="flex flex-col divide-y divide-line">
      {moves.slice(0, 10).map((move) => (
        <li key={move.id} className="flex items-start justify-between gap-3 py-2 text-base">
          <span>
            <span className="block">{move.reason}</span>
            <span className="text-sm text-muted">{when(move.at)}</span>
          </span>
          <span className="shrink-0 text-right tabular-nums">
            <span className={`block font-bold ${move.change < 0 ? "text-rose-800" : move.change > 0 ? "text-emerald-800" : "text-muted"}`}>
              {move.change > 0 ? "+" : ""}
              {fmtQty(move.change)}
            </span>
            <span className="text-sm text-muted">quedó {fmtQty(move.after)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

type Mode = "llego" | "ajustar" | "historial" | null;

function StockCard({
  name,
  big,
  state,
  review,
  note,
  controlled = true,
  moves,
  min,
  qty,
  onReceive,
  onAdjust,
  extra,
  danger,
}: {
  name: string;
  big: string;
  state: StockState;
  review?: boolean;
  note?: string;
  controlled?: boolean;
  moves: StockMove[];
  min: number;
  qty: number;
  onReceive: (amount: number) => void;
  onAdjust: (qty: number, min: number) => void;
  extra?: ReactNode;
  danger?: ReactNode;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [amount, setAmount] = useState("");
  const [real, setReal] = useState(controlled ? String(qty) : "");
  const [minimo, setMinimo] = useState(min > 0 ? String(min) : "");
  const toggle = (next: Mode) => {
    setMode((cur) => (cur === next ? null : next));
    setReal(controlled ? String(qty) : "");
    setMinimo(min > 0 ? String(min) : "");
    setAmount("");
  };
  const tone = !controlled
    ? "border-line/80 bg-card"
    : state === "agotado" ? "border-rose-300 bg-rose-50/60" : state === "poco" || review ? "border-amber-300 bg-amber-50/60" : "border-line/80 bg-card";
  return (
    <article className={`rounded-3xl border p-4 shadow-ticket sm:p-5 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xl font-bold leading-tight">{name}</h3>
          {controlled ? (
            <p className="mt-1 text-base text-muted">
              {min > 0 ? `Aviso cuando queden ${fmtQty(min)} o menos` : "Sin aviso de mínimo"}
            </p>
          ) : (
            <p className="mt-1 text-base text-muted">Todavía no se cuenta</p>
          )}
          {note ? <p className="mt-1 text-base text-muted">{note}</p> : null}
        </div>
        <div className="shrink-0 text-right">
          {controlled ? <p className="text-3xl font-extrabold leading-none tabular-nums">{big}</p> : null}
          <div className="mt-2 flex justify-end">
            <StateBadge state={controlled ? state : "ok"} review={review} />
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {controlled ? (
          <>
            <Quiet onClick={() => toggle("llego")}>Llegó</Quiet>
            <Quiet onClick={() => toggle("ajustar")}>Ajustar</Quiet>
            <Quiet onClick={() => toggle("historial")}>Historial</Quiet>
          </>
        ) : (
          <Quiet onClick={() => toggle("ajustar")}>Empezar a contar</Quiet>
        )}
        {extra}
      </div>
      {mode === "llego" ? (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-paper p-4">
          <Field label="¿Cuántos llegaron?" value={amount} inputMode="decimal" onChange={setAmount} placeholder="Por ejemplo, 10" />
          <Primary
            onClick={() => {
              const n = parseQty(amount);
              if (n <= 0) return;
              onReceive(n);
              setMode(null);
            }}
          >
            Sumar al inventario
          </Primary>
        </div>
      ) : null}
      {mode === "ajustar" ? (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-paper p-4">
          <Field label="¿Cuántos hay en realidad?" value={real} inputMode="decimal" onChange={setReal} placeholder="Cuente y escriba" />
          <Field label="Avisarme cuando queden (opcional)" value={minimo} inputMode="decimal" onChange={setMinimo} placeholder="Por ejemplo, 3" />
          <Primary
            onClick={() => {
              if (real.trim() === "") return;
              onAdjust(parseQty(real), parseQty(minimo));
              setMode(null);
            }}
          >
            Guardar
          </Primary>
          {danger}
        </div>
      ) : null}
      {mode === "historial" ? (
        <div className="mt-4 rounded-2xl bg-paper p-4">
          <History moves={moves} />
        </div>
      ) : null}
    </article>
  );
}

export function NuevoInsumo({
  onCreate,
  onCancel,
  compact,
}: {
  onCreate: (input: { name: string; unit: string; qty: number; min: number }) => void;
  onCancel: () => void;
  compact?: boolean;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<string>("pieza");
  const [qty, setQty] = useState("");
  const [min, setMin] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-line/80 bg-card p-4 shadow-ticket sm:p-5">
      <Field label="¿Cómo se llama el insumo?" value={name} onChange={setName} placeholder="Por ejemplo, Cajas de sellos" />
      <div>
        <p className="mb-2 text-base font-semibold">¿Cómo lo cuenta?</p>
        <div className="flex flex-wrap gap-2">
          {UNITS.map((item) => (
            <Chip key={item} selected={unit === item} onClick={() => setUnit(item)}>
              {item[0].toUpperCase() + item.slice(1)}
            </Chip>
          ))}
        </div>
      </div>
      <Field label="¿Cuántos hay ahorita?" value={qty} inputMode="decimal" onChange={setQty} placeholder="Si no sabe, déjelo vacío" />
      {compact ? null : (
        <Field label="Avisarme cuando queden (opcional)" value={min} inputMode="decimal" onChange={setMin} placeholder="Por ejemplo, 2" />
      )}
      {error ? <p className="text-base font-semibold text-rose-800">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Primary
          tone="stamp"
          onClick={() => {
            if (name.trim().length < 2) {
              setError("Escriba el nombre del insumo.");
              return;
            }
            onCreate({ name, unit, qty: parseQty(qty), min: parseQty(min) });
          }}
        >
          Guardar insumo
        </Primary>
        <Quiet onClick={onCancel}>Cancelar</Quiet>
      </div>
    </div>
  );
}

export function Inventario({
  initialTab = "papeleria",
  onBack,
  onLinkSupply,
}: {
  initialTab?: "papeleria" | "insumos";
  onBack: () => void;
  onLinkSupply: (supplyId: string) => void;
}) {
  const goods = useShop((s) => s.goods);
  const supplies = useShop((s) => s.supplies);
  const moves = useShop((s) => s.moves);
  const types = useShop((s) => s.types);
  const receiveStock = useShop((s) => s.receiveStock);
  const adjustStock = useShop((s) => s.adjustStock);
  const stopControlGood = useShop((s) => s.stopControlGood);
  const addSupply = useShop((s) => s.addSupply);
  const hideSupply = useShop((s) => s.hideSupply);
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState("");
  const hasControlled = goods.some((good) => good.stock !== undefined && !good.hidden);
  const [filter, setFilter] = useState<"control" | "todos">(hasControlled ? "control" : "todos");
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState<Supply | null>(null);
  const [confirmHide, setConfirmHide] = useState<string | null>(null);

  const alerts = alertsOf(goods, supplies);
  const alertCount = (what: "good" | "supply") => alerts.filter((item) => item.what === what).length;
  const q = norm(query.trim());

  const shownGoods = useMemo(() => {
    const rank = (good: Good) => {
      if (good.stock === undefined) return 3;
      const state = stockState(good.stock, good.min ?? 0);
      return state === "agotado" ? 0 : state === "poco" || good.review ? 1 : 2;
    };
    return goods
      .filter((good) => !good.hidden)
      .filter((good) => (filter === "todos" || q ? true : good.stock !== undefined))
      .filter((good) => !q || norm(good.name).includes(q))
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "es"));
  }, [goods, filter, q]);

  const shownSupplies = useMemo(() => {
    const rank = (s: Supply) => {
      const state = stockState(s.qty, s.min);
      return state === "agotado" ? 0 : state === "poco" || s.review ? 1 : 2;
    };
    return supplies
      .filter((s) => !s.hidden)
      .filter((s) => !q || norm(s.name).includes(q))
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "es"));
  }, [supplies, q]);

  const usedIn = (supplyId: string) =>
    types.filter((type) => !type.hidden && type.uses?.some((use) => use.supplyId === supplyId));

  return (
    <Frame narrow={false} onBack={onBack}>
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-tint text-stamp">
        <Boxes size={26} />
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Inventario</h1>
      <p className="mt-2 max-w-xl text-base text-muted">Aquí ve cuánto hay y qué se está acabando.</p>

      <div className="mt-6 grid grid-cols-2 gap-3" role="tablist">
        {(
          [
            { id: "papeleria", label: "Papelería", n: alertCount("good") },
            { id: "insumos", label: "Insumos", n: alertCount("supply") },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => {
              setTab(item.id);
              setQuery("");
              setAdding(false);
            }}
            className={`flex min-h-16 items-center justify-center gap-2 rounded-2xl border-2 px-4 text-xl font-extrabold ${tab === item.id ? "border-stamp bg-stamp text-white shadow-brand" : "border-line bg-card text-ink hover:border-stamp/50"}`}
          >
            {item.label}
            {item.n > 0 ? (
              <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${tab === item.id ? "bg-white text-stamp" : "bg-amber-100 text-amber-900"}`}>
                {item.n}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="relative mt-5">
        <Search size={21} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={tab === "papeleria" ? "Buscar un artículo" : "Buscar un insumo"}
          aria-label="Buscar en el inventario"
          className="w-full min-h-14 rounded-2xl border border-line bg-card py-3 pl-12 pr-4 text-lg shadow-ticket"
        />
      </div>

      {tab === "papeleria" ? (
        <section className="mt-5">
          <div className="mb-4 flex flex-wrap gap-2">
            <Chip selected={filter === "control"} onClick={() => setFilter("control")}>
              Los que cuento
            </Chip>
            <Chip selected={filter === "todos"} onClick={() => setFilter("todos")}>
              Todos
            </Chip>
          </div>
          <p className="mb-4 text-base text-muted">
            Cada venta de mostrador resta sola. Los artículos que no cuenta no marcan nada.
          </p>
          {shownGoods.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-card/70 px-5 py-8">
              <p className="text-lg">
                {q
                  ? "No hay artículos con ese nombre."
                  : "Todavía no cuenta ningún artículo. Toque «Todos» y elija uno para empezar a contarlo."}
              </p>
              {!q ? (
                <div className="mt-4">
                  <Quiet onClick={() => setFilter("todos")}>Ver todos los artículos</Quiet>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {shownGoods.map((good) => {
                const controlled = good.stock !== undefined;
                const stock = good.stock ?? 0;
                return (
                  <StockCard
                    key={good.id}
                    name={good.name}
                    big={fmtQty(stock)}
                    state={stockState(stock, good.min ?? 0)}
                    review={good.review}
                    controlled={controlled}
                    qty={stock}
                    min={good.min ?? 0}
                    moves={moves.filter((move) => move.what === "good" && move.itemId === good.id)}
                    onReceive={(n) => receiveStock("good", good.id, n)}
                    onAdjust={(n, min) => adjustStock("good", good.id, n, min)}
                    danger={
                      controlled ? (
                        <button type="button" onClick={() => stopControlGood(good.id)} className="min-h-11 text-left text-base font-semibold text-muted underline underline-offset-4">
                          Dejar de contar este artículo
                        </button>
                      ) : null
                    }
                  />
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="mt-5">
          <p className="mb-4 text-base text-muted">
            Insumos son los materiales que se gastan al hacer trabajos, como cajas de sellos, tinta o papel.
          </p>
          {justAdded ? (
            <div className="mb-4 rounded-3xl border border-stamp/30 bg-tint p-4 sm:p-5">
              <p className="text-lg font-bold">Listo, «{justAdded.name}» ya está en la lista.</p>
              <p className="mt-1 text-base text-muted">¿Qué servicio lo gasta? Así se descuenta solo cada vez que anote ese trabajo.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Primary tone="stamp" onClick={() => onLinkSupply(justAdded.id)}>
                  Ligar a un servicio
                </Primary>
                <Quiet onClick={() => setJustAdded(null)}>Después</Quiet>
              </div>
            </div>
          ) : null}
          {adding ? (
            <div className="mb-4">
              <NuevoInsumo
                onCancel={() => setAdding(false)}
                onCreate={(input) => {
                  const id = addSupply(input);
                  setAdding(false);
                  const made = useShop.getState().supplies.find((item) => item.id === id) ?? null;
                  setJustAdded(made);
                }}
              />
            </div>
          ) : (
            <div className="mb-4">
              <Primary tone="stamp" onClick={() => setAdding(true)}>
                <Plus size={22} className="mr-2" /> Agregar insumo
              </Primary>
            </div>
          )}
          {shownSupplies.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-card/70 px-5 py-8">
              <p className="text-lg">
                {q ? "No hay insumos con ese nombre." : "Todavía no hay insumos. Toque «Agregar insumo» y escriba el primero, por ejemplo las cajas de sellos."}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {shownSupplies.map((supply) => {
                const links = usedIn(supply.id);
                return (
                  <StockCard
                    key={supply.id}
                    name={supply.name}
                    big={qtyText(supply.qty, supply.unit)}
                    state={stockState(supply.qty, supply.min)}
                    review={supply.review}
                    qty={supply.qty}
                    min={supply.min}
                    note={
                      links.length > 0
                        ? `Se gasta en: ${links.map((type) => type.name).join(", ")}`
                        : "Todavía no está ligado a ningún servicio"
                    }
                    moves={moves.filter((move) => move.what === "supply" && move.itemId === supply.id)}
                    onReceive={(n) => receiveStock("supply", supply.id, n)}
                    onAdjust={(n, min) => adjustStock("supply", supply.id, n, min)}
                    extra={
                      <Quiet onClick={() => onLinkSupply(supply.id)}>
                        <Link2 size={19} className="mr-2" /> Ligar a un servicio
                      </Quiet>
                    }
                    danger={
                      confirmHide === supply.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold">¿Quitarlo de la lista?</span>
                          <Primary
                            tone="stamp"
                            onClick={() => {
                              hideSupply(supply.id);
                              setConfirmHide(null);
                            }}
                          >
                            Sí, quitar
                          </Primary>
                          <Quiet onClick={() => setConfirmHide(null)}>No</Quiet>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setConfirmHide(supply.id)} className="min-h-11 text-left text-base font-semibold text-muted underline underline-offset-4">
                          Quitar este insumo de la lista
                        </button>
                      )
                    }
                  />
                );
              })}
            </div>
          )}
        </section>
      )}
    </Frame>
  );
}
