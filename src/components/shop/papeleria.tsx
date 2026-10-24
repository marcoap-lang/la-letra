import { useMemo, useState } from "react";
import { formatMoney, norm, parseMoney } from "@/lib/shop/format";
import { useShop, type SaleLine } from "@/lib/shop/store";
import { Field, Frame, Primary, Quiet } from "./ui";

export function Papeleria({ onBack, onSaved }: { onBack: () => void; onSaved: () => void }) {
  const goods = useShop((s) => s.goods);
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

  const visible = goods.filter((good) => !good.hidden);
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
          Cobrar papelería
        </Primary>
      }
    >
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <p className="text-sm font-medium text-muted">Caja</p>
          <h1 className="mt-1 font-display text-5xl leading-none tracking-tight">Papelería</h1>
          <p className="mt-3 max-w-xl text-lg text-muted">
            Esto no entra al taller. Toque el producto, cobre, y queda en el día.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visible.map((good) => {
              const qty = lines.find((line) => line.goodId === good.id)?.qty ?? 0;
              return (
                <button
                  key={good.id}
                  type="button"
                  onClick={() => add(good.id, good.name, good.price)}
                  className={`min-h-28 rounded-3xl border p-4 text-left ${qty > 0 ? "border-ink bg-ink text-band-fg" : "border-line bg-card"}`}
                >
                  <span className="block text-lg font-medium leading-tight">{good.name}</span>
                  <span className={`mt-2 block tabular-nums ${qty > 0 ? "text-band-fg/70" : "text-muted"}`}>
                    {formatMoney(good.price)}
                  </span>
                  {qty > 0 ? <span className="mt-3 block text-sm">Lleva {qty}</span> : null}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => setPrices((open) => !open)} className="mt-5 min-h-11 text-base text-muted">
            {prices ? "Ocultar precios" : "Cambiar precios o agregar"}
          </button>
          {prices ? (
            <div className="mt-3 flex flex-col gap-3 rounded-3xl border border-line bg-card p-4">
              {goods.map((good) => (
                <label key={good.id} className="grid grid-cols-[1fr_7rem] items-center gap-3">
                  <span>{good.name}</span>
                  <input
                    value={String(good.price)}
                    inputMode="decimal"
                    onChange={(event) => setGoodPrice(good.id, parseMoney(event.target.value))}
                    className="rounded-xl border border-line bg-paper px-3 py-2 text-right tabular-nums"
                  />
                </label>
              ))}
              <div className="grid gap-3 border-t border-line pt-3 sm:grid-cols-[1fr_8rem_auto]">
                <Field label="Producto nuevo" value={newName} onChange={setNewName} placeholder="Por ejemplo, folder oficio" />
                <Field label="Precio" value={newPrice} inputMode="decimal" onChange={setNewPrice} />
                <div className="self-end">
                  <Quiet
                    onClick={() => {
                      if (newName.trim().length < 2) return;
                      addGood(newName, parseMoney(newPrice));
                      setNewName("");
                      setNewPrice("");
                    }}
                  >
                    Agregar
                  </Quiet>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="rounded-3xl bg-ink p-5 text-band-fg lg:sticky lg:top-6">
          <p className="text-sm text-band-fg/60">Cuenta</p>
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
          <p className="mt-5 font-display text-5xl leading-none tabular-nums">{formatMoney(total)}</p>
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
            {left > 0 ? "Anotar y dejar saldo" : "Cobrar y listo"}
          </button>
        </aside>
      </div>
    </Frame>
  );
}
