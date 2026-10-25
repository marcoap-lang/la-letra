import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Tags, ShoppingBasket, ScanBarcode, X, Plus, ReceiptText } from "lucide-react";
import { formatMoney, norm, parseMoney } from "@/lib/shop/format";
import { useShop, type Good, type GoodCategory, type SaleLine } from "@/lib/shop/store";
import { Field, Frame, Primary, Quiet } from "./ui";

const CATEGORIES: GoodCategory[] = ["Escritura", "Papel y archivo", "Útiles", "Servicios rápidos", "Otros"];

export function Papeleria({ onBack, onSaved }: { onBack: () => void; onSaved: () => void }) {
  const goods = useShop((s) => s.goods);
  const sales = useShop((s) => s.sales);
  const customers = useShop((s) => s.customers);
  const saveSale = useShop((s) => s.saveSale);
  const addGood = useShop((s) => s.addGood);
  const setGoodPrice = useShop((s) => s.setGoodPrice);
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [paid, setPaid] = useState("");
  const [touchedPaid, setTouchedPaid] = useState(false);
  const [error, setError] = useState("");
  const [prices, setPrices] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCategory, setNewCategory] = useState<GoodCategory>("Otros");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Frecuentes");
  const [pricingId, setPricingId] = useState<string | null>(null);
  const [pendingPrice, setPendingPrice] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function shortcuts(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  }, []);

  // Start with a compact counter view; frequently sold custom items join it over time.
  const defaultFrequent = new Set([
    "pluma", "lapiz", "folder", "resma-carta", "hoja-carta",
    "cartulina", "cuaderno", "copia-bn", "copia-color",
    "impresion-bn", "impresion-color", "engargolado",
  ]);
  const usage = new Map<string, number>();
  for (const sale of sales) {
    for (const line of sale.lines) {
      usage.set(line.goodId, (usage.get(line.goodId) ?? 0) + line.qty);
    }
  }
  const soldFrequently = [...usage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => id);
  const frequentIds = new Set([...defaultFrequent, ...soldFrequently]);
  const visible = goods.filter(
    (good) =>
      !good.hidden &&
      (category === "Todos" || (category === "Frecuentes" ? frequentIds.has(good.id) : (good.category ?? "Otros") === category)) &&
      (!query.trim() || norm(good.name).includes(norm(query.trim()))),
  );
  const selectedUnpriced = goods.find((good) => good.id === pricingId);
  const exactMatch = goods.some((good) => norm(good.name) === norm(query.trim()));
  const total = useMemo(
    () => lines.reduce((sum, line) => sum + line.qty * line.price, 0),
    [lines],
  );
  const paidValue = touchedPaid ? parseMoney(paid) : total;
  const left = Math.max(0, total - Math.min(paidValue, total));
  const matches = norm(name)
    ? customers.filter((customer) => norm(customer.name).includes(norm(name))).slice(0, 4)
    : [];

  function add(goodId: string, label: string, price: number) {
    setError("");
    setLines((current) => {
      const found = current.find((line) => line.goodId === goodId);
      if (!found) return [...current, { goodId, name: label, qty: 1, price }];
      return current.map((line) => (line.goodId === goodId ? { ...line, qty: line.qty + 1 } : line));
    });
  }

  function pick(good: Good) {
    if (good.price <= 0) {
      setPricingId(good.id);
      setPendingPrice("");
      setError("");
      return;
    }
    setPricingId(null);
    add(good.id, good.name, good.price);
  }

  function confirmPrice() {
    if (!selectedUnpriced) return;
    const amount = parseMoney(pendingPrice);
    if (amount <= 0) {
      setError("Escriba un precio mayor a cero.");
      return;
    }
    setGoodPrice(selectedUnpriced.id, amount);
    add(selectedUnpriced.id, selectedUnpriced.name, amount);
    setPricingId(null);
    setError("");
  }

  function setQty(goodId: string, qty: number) {
    setLines((current) =>
      qty <= 0 ? current.filter((line) => line.goodId !== goodId) : current.map((line) => (line.goodId === goodId ? { ...line, qty } : line)),
    );
  }

  function save() {
    if (lines.length === 0) {
      setError("Toque lo que se lleva.");
      return;
    }
    if (left > 0 && name.trim().length < 2) {
      setError("Si no paga todo, anote quién debe.");
      return;
    }
    const id = saveSale({
      customerId,
      name: name.trim() || "Mostrador",
      phone,
      lines,
      paid: paidValue,
    });
    if (!id) {
      setError("No se pudo guardar.");
      return;
    }
    onSaved();
  }

  return (
    <Frame
      narrow={false}
      onBack={onBack}
      action={
        <Primary tone="stamp" onClick={save}>
          Guardar venta
        </Primary>
      }
    >
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-tint text-stamp">
            <ShoppingBasket size={26}/>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Nueva venta</h1>
          <p className="mt-2 max-w-xl text-base text-muted">
            Elija los artículos. La cuenta se calcula automáticamente.
          </p>
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-line/80 bg-card p-4 shadow-ticket">
            <label className="block">
              <span className="mb-2 block text-base font-bold text-ink">Buscar producto o servicio</span>
              <div className="relative">
                <Search size={21} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"/>
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); setCategory("Todos"); }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") { setQuery(""); setCategory("Frecuentes"); }
                    if (event.key === "Enter" && visible.length === 1) { event.preventDefault(); pick(visible[0]); }
                  }}
                  placeholder="Pluma, cartulina, copias..."
                  aria-label="Buscar un producto"
                  className="w-full min-h-14 rounded-xl border border-line bg-paper py-3 pl-12 pr-4 text-lg"
                />
              </div>
              <span className="mt-2 hidden text-xs text-muted sm:block">Atajo: Ctrl + K para buscar · Enter si hay un solo resultado</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {["Frecuentes", "Todos", ...CATEGORIES].map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => setCategory(item)}
                  className={"min-h-11 rounded-full border px-4 text-base font-medium " + (category === item ? "border-ink bg-ink text-band-fg" : "border-line bg-card text-ink")}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          {query.trim() && !exactMatch ? (
            <button
              type="button"
              onClick={() => { setPrices(true); setNewName(query.trim()); setNewCategory("Otros"); }}
              className="mt-3 min-h-12 w-full rounded-xl border border-dashed border-line bg-card px-4 text-left font-medium"
            >
              + Agregar «{query.trim()}» al catálogo
            </button>
          ) : null}
          <div className="mt-4 flex items-center justify-between gap-2"><h2 className="text-lg font-extrabold">Artículos</h2><span className="text-sm text-muted">{visible.length} opciones</span></div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {visible.map((good) => {
              const qty = lines.find((line) => line.goodId === good.id)?.qty ?? 0;
              return (
                <button
                  key={good.id}
                  type="button"
                  onClick={() => pick(good)}
                  className={`min-h-28 rounded-2xl border-2 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${qty > 0 ? "border-stamp bg-tint text-ink" : "border-line bg-card hover:border-stamp/60"}`}
                >
                  <span className="block text-lg font-medium leading-tight">{good.name}</span>
                  <span className={`mt-2 block tabular-nums ${qty > 0 ? "text-stamp" : "text-muted"}`}>
                    {good.price > 0 ? formatMoney(good.price) : "Asignar precio"}
                  </span>
                  {good.stock !== undefined && (good.stock <= 0 || (good.min ?? 0) > 0 && good.stock <= (good.min ?? 0)) ? (
                    <span className="mt-1 block text-sm font-semibold text-amber-800">{good.stock <= 0 ? "Se acabó" : `Quedan ${good.stock}`}</span>
                  ) : null}
                  {qty > 0 ? <span className="mt-3 inline-block rounded-lg bg-stamp px-2 py-1 text-sm font-semibold text-white">En cuenta: {qty}</span> : null}
                </button>
              );
            })}
          </div>
          {selectedUnpriced ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div role="dialog" aria-modal="true" aria-label="Asignar precio" className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl">
                <h2 className="text-2xl font-semibold">{selectedUnpriced.name}</h2>
                <p className="mt-2 text-base text-muted">¿Cuánto cuesta? Guardaremos el precio para las siguientes ventas.</p>
                <label className="mt-5 block">
                  <span className="mb-2 block text-base font-medium">Precio en pesos</span>
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    step="0.01"
                    value={pendingPrice}
                    onChange={(event) => setPendingPrice(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") confirmPrice(); }}
                    className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-2xl"
                  />
                </label>
                {error ? <p className="mt-3 text-base text-stamp">{error}</p> : null}
                <div className="mt-5 flex flex-wrap gap-3">
                  <Primary onClick={confirmPrice}>Guardar y agregar</Primary>
                  <Quiet onClick={() => { setPricingId(null); setError(""); }}>Cancelar</Quiet>
                </div>
              </div>
            </div>
          ) : null}
          <button type="button" onClick={() => setPrices((open) => !open)} className="mt-5 inline-flex min-h-12 items-center rounded-xl border border-line bg-card px-4 text-base font-semibold text-stamp shadow-sm transition hover:bg-tint">
            <Tags size={19} className="mr-2" />
            {prices ? "Cerrar catálogo" : "Agregar productos o editar precios"}
          </button>
          {prices ? (
            <div className="mt-3 flex flex-col gap-3 rounded-3xl border border-line/80 bg-card shadow-ticket p-4">
              {goods.map((good) => (
                <label key={good.id} className="grid grid-cols-[1fr_7rem] items-center gap-3">
                  <span>{good.name}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={good.price > 0 ? String(good.price) : ""}
                    placeholder="Precio"
                    onBlur={(event) => setGoodPrice(good.id, parseMoney(event.target.value))}
                    onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                    className="rounded-xl border border-line bg-paper px-3 py-2 text-right tabular-nums"
                  />
                </label>
              ))}
              <div className="grid gap-3 border-t border-line pt-3 sm:grid-cols-[1fr_8rem_auto]">
                <div>
                  <Field label="Producto nuevo" value={newName} onChange={setNewName} placeholder="Por ejemplo, folder oficio" />
                  <select
                    value={newCategory}
                    onChange={(event) => setNewCategory(event.target.value as GoodCategory)}
                    aria-label="Categoría"
                    className="mt-2 min-h-11 w-full rounded-xl border border-line bg-paper px-3"
                  >
                    {CATEGORIES.map((item) => <option value={item} key={item}>{item}</option>)}
                  </select>
                </div>
                <Field label="Precio (puede quedar pendiente)" value={newPrice} inputMode="decimal" onChange={setNewPrice} />
                <div className="self-end">
                  <Quiet
                    onClick={() => {
                      if (newName.trim().length < 2) return;
                      const amount = parseMoney(newPrice);
                      const id = addGood(newName, amount, newCategory);
                      if (amount > 0) add(id, newName.trim(), amount);
                      setNewName("");
                      setNewPrice("");
                      setQuery("");
                      setCategory("Todos");
                    }}
                  >
                    Agregar
                  </Quiet>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="rounded-2xl bg-ink p-5 text-band-fg shadow-xl lg:sticky lg:top-6">
          <div className="flex items-center gap-2"><ReceiptText size={22}/><p className="text-lg font-bold">Cuenta actual</p></div>
          {lines.length === 0 ? <p className="mt-4 text-lg text-band-fg/70">Todavía no elige nada.</p> : null}
          <ul className="mt-3 flex flex-col gap-3">
            {lines.map((line) => (
              <li key={line.goodId} className="flex items-center justify-between gap-3">
                <span>
                  <span className="block font-medium">{line.name}</span>
                  <span className="text-sm text-band-fg/60 tabular-nums">{formatMoney(line.qty * line.price)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <button type="button" onClick={() => setQty(line.goodId, line.qty - 1)} className="size-9 rounded-lg border border-band-fg/20" aria-label="Quitar uno">
                    −
                  </button>
                  <span className="w-6 text-center tabular-nums">{line.qty}</span>
                  <button type="button" onClick={() => setQty(line.goodId, line.qty + 1)} className="size-9 rounded-lg border border-band-fg/20" aria-label="Agregar uno">
                    +
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-5xl font-extrabold leading-none tabular-nums">{formatMoney(total)}</p>
          <label className="mt-5 block">
            <span className="mb-2 block text-sm text-band-fg/60">Pagó</span>
            <input
              value={touchedPaid ? paid : total ? String(total) : ""}
              inputMode="decimal"
              onChange={(event) => {
                setTouchedPaid(true);
                setPaid(event.target.value);
              }}
              className="w-full rounded-xl bg-band-fg px-4 py-3 text-xl text-ink tabular-nums"
            />
          </label>
          <p className="mt-2 text-base text-band-fg/70">{left > 0 ? `Queda a deber ${formatMoney(left)}` : "Pagado de contado"}</p>
          <label className="mt-4 block">
            <span className="mb-2 block text-sm text-band-fg/60">Cliente</span>
            <input
              value={name}
              placeholder="Mostrador, si no da nombre"
              onChange={(event) => {
                setName(event.target.value);
                setCustomerId(null);
              }}
              className="w-full rounded-xl bg-band-fg px-4 py-3 text-lg text-ink"
            />
          </label>
          {matches.length > 0 && !customerId ? (
            <div className="mt-2 flex flex-col gap-1">
              {matches.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => {
                    setCustomerId(customer.id);
                    setName(customer.name);
                    setPhone(customer.phone);
                  }}
                  className="min-h-10 text-left text-base text-band-fg/80"
                >
                  {customer.name}
                </button>
              ))}
            </div>
          ) : null}
          {error ? <p className="mt-3 text-base text-stamp-fg">{error}</p> : null}
          <button type="button" onClick={save} className="mt-5 min-h-14 w-full rounded-2xl bg-stamp text-lg font-medium text-stamp-fg">
            {left > 0 ? "Guardar con saldo" : "Guardar venta"}
          </button>
        </aside>
      </div>
    </Frame>
  );
}
