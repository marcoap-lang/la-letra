import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Phone, Search, UserPlus } from "lucide-react";
import { balanceOf, saleBalance, useShop, type Billing, type Customer, type JobStatus } from "@/lib/shop/store";
import {
  BILLING_FIELDS,
  billingText,
  canRemoveCustomer,
  customerUse,
  cleanRfc,
  cleanZip,
  emailHint,
  emptyBilling,
  findDuplicate,
  hasBilling,
  matchesCustomer,
  normalizeBilling,
  rfcHint,
  sortCustomers,
  statsByCustomer,
  zipHint,
} from "@/lib/shop/customers";
import { formatDay, formatMoney } from "@/lib/shop/format";
import { Field, Frame, Primary, Quiet } from "./ui";

const NAME_ERROR = "Escriba el nombre, mínimo 2 letras.";
const DUPLICATE_ERROR = "Ya hay un cliente con ese nombre y ese teléfono.";

const STATUS: Record<JobStatus, string> = {
  nuevo: "Recibido",
  aprobado: "Aprobado",
  listo: "Listo",
  entregado: "Entregado",
};

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const box = document.createElement("textarea");
    box.value = text;
    box.style.position = "fixed";
    box.style.opacity = "0";
    document.body.appendChild(box);
    box.select();
    const ok = document.execCommand("copy");
    box.remove();
    return ok;
  }
}

export function Clientes({ onBack, onOpen }: { onBack: () => void; onOpen: (customerId: string) => void }) {
  const customers = useShop((s) => s.customers);
  const jobs = useShop((s) => s.jobs);
  const sales = useShop((s) => s.sales);
  const addCustomer = useShop((s) => s.addCustomer);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [dupId, setDupId] = useState<string | null>(null);

  const stats = useMemo(() => statsByCustomer(jobs, sales), [jobs, sales]);
  const list = useMemo(
    () => sortCustomers(customers.filter((customer) => matchesCustomer(customer, q))),
    [customers, q],
  );

  function save() {
    if (name.trim().length < 2) {
      setError(NAME_ERROR);
      setDupId(null);
      return;
    }
    const dup = findDuplicate(customers, name, phone);
    if (dup) {
      setError(DUPLICATE_ERROR);
      setDupId(dup.id);
      return;
    }
    const id = addCustomer(name, phone);
    setAdding(false);
    setName("");
    setPhone("");
    setError("");
    setDupId(null);
    onOpen(id);
  }

  return (
    <Frame onBack={onBack}>
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Clientes</h1>
      <p className="mt-2 text-lg text-muted">Aquí puede corregir un teléfono o un nombre.</p>

      {adding ? (
        <section className="mt-6 rounded-3xl border border-line/80 bg-card p-5 shadow-ticket sm:p-6">
          <h2 className="text-xl font-bold">Agregar cliente</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Nombre"
              value={name}
              placeholder="Nombre del cliente"
              onChange={(v) => {
                setName(v);
                setError("");
                setDupId(null);
              }}
            />
            <Field
              label="Teléfono (si lo tiene)"
              value={phone}
              inputMode="tel"
              onChange={(v) => {
                setPhone(v);
                setError("");
                setDupId(null);
              }}
            />
          </div>
          {error ? (
            <p role="alert" className="mt-4 rounded-xl bg-amber-100 px-4 py-3 text-base font-semibold text-amber-900">
              {error}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Primary tone="stamp" onClick={save}>Guardar cliente</Primary>
            {dupId ? <Quiet onClick={() => onOpen(dupId)}>Ver a ese cliente</Quiet> : null}
            <Quiet
              onClick={() => {
                setAdding(false);
                setError("");
                setDupId(null);
              }}
            >
              Cancelar
            </Quiet>
          </div>
        </section>
      ) : (
        <div className="mt-6">
          <Primary tone="stamp" onClick={() => setAdding(true)}>
            <UserPlus size={22} className="mr-2" /> Agregar cliente
          </Primary>
        </div>
      )}

      <label className="mt-6 block">
        <span className="sr-only">Buscar un cliente</span>
        <span className="relative block">
          <Search aria-hidden="true" size={22} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Buscar por nombre o teléfono"
            aria-label="Buscar un cliente"
            className="min-h-13 w-full rounded-xl border border-line bg-card py-3 pl-12 pr-4 text-lg text-ink shadow-sm"
          />
        </span>
      </label>

      <div className="mt-5 flex flex-col gap-3">
        {customers.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-card/70 px-5 py-8 text-lg">
            Todavía no hay clientes. Se agregan solos al anotar un trabajo, o con el botón de arriba.
          </p>
        ) : list.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-card/70 px-5 py-8 text-lg">
            Nadie con ese nombre o teléfono.
          </p>
        ) : (
          list.map((customer) => {
            const s = stats.get(customer.id);
            const bits = [
              s && s.jobs > 0 ? (s.jobs === 1 ? "1 trabajo" : `${s.jobs} trabajos`) : "",
              s && s.sales > 0 ? (s.sales === 1 ? "1 venta" : `${s.sales} ventas`) : "",
            ].filter(Boolean);
            return (
              <button
                key={customer.id}
                type="button"
                onClick={() => onOpen(customer.id)}
                className="group flex min-h-20 items-center gap-3 rounded-3xl border border-line/80 bg-card px-5 py-3 text-left shadow-ticket hover:border-stamp/40 hover:shadow-lift"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xl font-bold">{customer.name}</span>
                  <span className="block text-lg text-ink">{customer.phone || <span className="text-muted">Sin teléfono</span>}</span>
                  {bits.length > 0 || (s && s.owed > 0) || hasBilling(customer) ? (
                    <span className="mt-0.5 block text-sm text-muted">
                      {bits.join(" · ")}
                      {s && s.owed > 0 ? (
                        <span className="font-semibold text-stamp">{bits.length > 0 ? " · " : ""}Debe {formatMoney(s.owed)}</span>
                      ) : null}
                      {hasBilling(customer) ? <span>{bits.length > 0 || (s && s.owed > 0) ? " · " : ""}Con datos de factura</span> : null}
                    </span>
                  ) : null}
                </span>
                <ChevronRight aria-hidden="true" className="shrink-0 text-ink/40 transition group-hover:translate-x-1" size={24} />
              </button>
            );
          })
        )}
      </div>
    </Frame>
  );
}

export function Cliente({
  customerId,
  onBack,
  onOpenJob,
  onOpenSale,
  onCharge,
}: {
  customerId: string;
  onBack: () => void;
  onOpenJob: (jobId: string) => void;
  onOpenSale: (saleId: string) => void;
  onCharge: (customerId: string) => void;
}) {
  const customer = useShop((s) => s.customers.find((item) => item.id === customerId));
  const customers = useShop((s) => s.customers);
  const jobs = useShop((s) => s.jobs);
  const sales = useShop((s) => s.sales);
  const payments = useShop((s) => s.payments);
  const updateCustomer = useShop((s) => s.updateCustomer);
  const deleteCustomer = useShop((s) => s.deleteCustomer);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  if (!customer) {
    return (
      <Frame onBack={onBack} backLabel="Clientes">
        <p className="text-xl">No encontré a ese cliente.</p>
      </Frame>
    );
  }

  const mine = jobs.filter((job) => job.customerId === customer.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const mySales = sales.filter((sale) => sale.customerId === customer.id);
  const owed =
    mine.reduce((sum, job) => sum + Math.max(0, balanceOf(job)), 0) +
    mySales.reduce((sum, sale) => sum + Math.max(0, saleBalance(sale)), 0);

  function startEdit() {
    if (!customer) return;
    setName(customer.name);
    setPhone(customer.phone);
    setError("");
    setSaved("");
    setEditing(true);
  }

  function saveEdit() {
    if (!customer) return;
    if (name.trim().length < 2) {
      setError(NAME_ERROR);
      return;
    }
    if (findDuplicate(customers, name, phone, customer.id)) {
      setError(DUPLICATE_ERROR);
      return;
    }
    updateCustomer(customer.id, { name, phone });
    setEditing(false);
    setSaved("Listo, quedó el cambio.");
  }

  return (
    <Frame onBack={onBack} backLabel="Clientes">
      <p className="text-sm text-muted">Cliente</p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{customer.name}</h1>

      {editing ? (
        <section className="mt-6 rounded-3xl border border-line/80 bg-card p-5 shadow-ticket sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" value={name} onChange={(v) => { setName(v); setError(""); }} />
            <Field label="Teléfono" value={phone} inputMode="tel" onChange={(v) => { setPhone(v); setError(""); }} />
          </div>
          {error ? (
            <p role="alert" className="mt-4 rounded-xl bg-amber-100 px-4 py-3 text-base font-semibold text-amber-900">{error}</p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Primary tone="stamp" onClick={saveEdit}>Guardar</Primary>
            <Quiet onClick={() => setEditing(false)}>Cancelar</Quiet>
          </div>
        </section>
      ) : (
        <>
          <div className="mt-4">
            {customer.phone ? (
              <a
                href={`tel:${customer.phone}`}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-tint px-4 text-xl font-bold text-stamp"
              >
                <Phone size={22} aria-hidden="true" /> {customer.phone}
              </a>
            ) : (
              <p className="text-lg text-muted">Sin teléfono</p>
            )}
          </div>
          {owed > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="text-lg font-semibold text-stamp">Debe {formatMoney(owed)}</p>
              <Quiet onClick={() => onCharge(customer.id)}>Cobrar</Quiet>
            </div>
          ) : null}
          <div className="mt-5">
            <Primary tone="stamp" onClick={startEdit}>Cambiar nombre o teléfono</Primary>
          </div>
          {saved ? <p role="status" className="mt-3 text-base font-semibold text-emerald-800">{saved}</p> : null}
        </>
      )}

      <BillingBox key={customer.id} customer={customer} onSave={(billing) => updateCustomer(customer.id, { billing })} />

      <section className="mt-8">
        <h2 className="text-2xl font-extrabold tracking-tight">Trabajos</h2>
        {mine.length === 0 ? (
          <p className="mt-3 text-lg text-muted">Todavía no tiene trabajos.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {mine.slice(0, 6).map((job) => {
              const left = balanceOf(job);
              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => onOpenJob(job.id)}
                  className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-line/80 bg-card px-4 py-3 text-left shadow-ticket hover:border-stamp/40"
                >
                  <span className="min-w-0">
                    <span className="block text-lg font-bold">
                      {job.number} · {job.typeName}
                    </span>
                    <span className="block text-sm text-muted">
                      {STATUS[job.status]} · {formatDay(job.due)}
                    </span>
                  </span>
                  <span className={`shrink-0 text-base tabular-nums ${left > 0 ? "font-semibold text-stamp" : "text-muted"}`}>
                    {left > 0 ? `Debe ${formatMoney(left)}` : job.price > 0 ? "Pagado" : ""}
                  </span>
                </button>
              );
            })}
            {mine.length > 6 ? <p className="text-base text-muted">Y {mine.length - 6} más antiguos.</p> : null}
          </div>
        )}
      </section>

      {mySales.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-2xl font-extrabold tracking-tight">Papelería</h2>
          <div className="mt-3 flex flex-col gap-2">
            {mySales.slice(0, 5).map((sale) => {
              const left = saleBalance(sale);
              return (
                <button
                  key={sale.id}
                  type="button"
                  onClick={() => onOpenSale(sale.id)}
                  className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-line/80 bg-card px-4 py-3 text-left shadow-ticket hover:border-stamp/40"
                >
                  <span className="min-w-0">
                    <span className="block text-base font-semibold">{sale.lines.map((line) => `${line.qty} ${line.name}`).join(", ")}</span>
                    <span className="block text-sm text-muted">{formatDay(sale.createdAt.slice(0, 10))}</span>
                  </span>
                  <span className={`shrink-0 text-base tabular-nums ${left > 0 ? "font-semibold text-stamp" : "text-muted"}`}>
                    {left > 0 ? `Debe ${formatMoney(left)}` : formatMoney(sale.total)}
                  </span>
                </button>
              );
            })}
            {mySales.length > 5 ? <p className="text-base text-muted">Y {mySales.length - 5} más antiguas.</p> : null}
          </div>
        </section>
      ) : null}

      <section className="mt-10 border-t border-line/70 pt-5">
        {canRemoveCustomer(customerUse(customer.id, jobs, sales, payments)) ? (
          confirmRemove ? (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-card p-4">
              <p className="w-full text-lg font-semibold">¿Seguro? Se quita a {customer.name} de la lista de clientes.</p>
              <Primary
                tone="stamp"
                onClick={() => {
                  if (deleteCustomer(customer.id)) onBack();
                }}
              >
                Sí, quitar
              </Primary>
              <Quiet onClick={() => setConfirmRemove(false)}>No</Quiet>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmRemove(true)} className="min-h-11 text-base text-stamp">
              Quitar este cliente
            </button>
          )
        ) : (
          <p className="text-base text-muted">Tiene trabajos o ventas, primero bórrelos.</p>
        )}
      </section>
    </Frame>
  );
}

function BillingBox({ customer, onSave }: { customer: Customer; onSave: (billing: Billing) => void }) {
  const current = normalizeBilling(customer.billing);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Billing>(current ?? emptyBilling());
  const [copied, setCopied] = useState<"" | "si" | "no">("");

  const set = (key: keyof Billing, value: string) =>
    setForm((f) => ({ ...f, [key]: key === "rfc" ? cleanRfc(value) : key === "zip" ? cleanZip(value) : value }));
  const hints = [rfcHint(form.rfc), zipHint(form.zip), emailHint(form.email)].filter(Boolean);

  return (
    <section className="mt-8 rounded-3xl border border-line/80 bg-card shadow-ticket">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-16 w-full items-center justify-between gap-3 px-5 py-3 text-left"
      >
        <span>
          <span className="block text-xl font-bold">Datos para factura</span>
          <span className="block text-sm text-muted">{current ? "Ya tiene datos capturados" : "Opcional. Solo si el cliente pide factura."}</span>
        </span>
        <ChevronDown aria-hidden="true" size={26} className={`shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="border-t border-line/70 px-5 pb-5 pt-4">
          {editing ? (
            <>
              <p className="mb-4 text-base text-muted">Llene solo lo que tenga. Todo es opcional.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {BILLING_FIELDS.map((field) => (
                  <Field
                    key={field.key}
                    label={field.label}
                    value={form[field.key]}
                    inputMode={field.key === "zip" ? "numeric" : undefined}
                    type={field.key === "email" ? "email" : "text"}
                    onChange={(v) => set(field.key, v)}
                  />
                ))}
              </div>
              {hints.map((hint) => (
                <p key={hint} role="status" className="mt-3 rounded-xl bg-amber-50 px-4 py-2 text-base text-amber-900">{hint}</p>
              ))}
              <div className="mt-5 flex flex-wrap gap-3">
                <Primary
                  tone="stamp"
                  onClick={() => {
                    onSave(form);
                    setForm(normalizeBilling(form) ?? emptyBilling());
                    setEditing(false);
                  }}
                >
                  Guardar
                </Primary>
                <Quiet
                  onClick={() => {
                    setForm(current ?? emptyBilling());
                    setEditing(false);
                  }}
                >
                  Cancelar
                </Quiet>
              </div>
            </>
          ) : (
            <>
              {current ? (
                <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                  {BILLING_FIELDS.filter((field) => current[field.key]).map((field) => (
                    <div key={field.key}>
                      <dt className="text-sm text-muted">{field.label}</dt>
                      <dd className="break-words text-lg font-semibold">{current[field.key]}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-lg text-muted">Todavía no hay datos para factura.</p>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                <Quiet
                  onClick={() => {
                    setForm(current ?? emptyBilling());
                    setEditing(true);
                  }}
                >
                  {current ? "Cambiar datos para factura" : "Agregar datos para factura"}
                </Quiet>
                {current ? (
                  <Quiet
                    onClick={() => {
                      void copyText(billingText(customer)).then((ok) => {
                        setCopied(ok ? "si" : "no");
                        window.setTimeout(() => setCopied(""), 2200);
                      });
                    }}
                  >
                    {copied === "si" ? "Copiado" : "Copiar datos para factura"}
                  </Quiet>
                ) : null}
              </div>
              {copied === "no" ? <p role="alert" className="mt-3 text-base text-amber-900">No se pudo copiar. Seleccione los datos y cópielos a mano.</p> : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
