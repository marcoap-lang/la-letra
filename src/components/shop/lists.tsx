import { useState } from "react";
import { balanceOf, saleBalance, useShop, type Job } from "@/lib/shop/store";
import { formatMoney, norm, parseMoney } from "@/lib/shop/format";
import type { Draft } from "./nav";
import { Field, Frame, Primary, Quiet } from "./ui";

export function Cobrar({
  customerId,
  saleId,
  onBack,
  onPick,
  onOpen,
}: {
  customerId?: string;
  saleId?: string;
  onBack: () => void;
  onPick: (customerId: string) => void;
  onOpen: (jobId: string) => void;
}) {
  const customers = useShop((s) => s.customers);
  const jobs = useShop((s) => s.jobs);
  const sales = useShop((s) => s.sales);
  if (saleId) return <PagarVenta saleId={saleId} onBack={onBack} />;

  const people = customers
    .map((customer) => ({
      customer,
      owed:
        jobs
          .filter((job) => job.customerId === customer.id)
          .reduce((sum, job) => sum + Math.max(0, balanceOf(job)), 0) +
        sales
          .filter((sale) => sale.customerId === customer.id)
          .reduce((sum, sale) => sum + Math.max(0, saleBalance(sale)), 0),
    }))
    .filter((row) => row.owed > 0)
    .sort((a, b) => b.owed - a.owed);
  const loose = sales.filter((sale) => !sale.customerId && saleBalance(sale) > 0);

  if (!customerId) {
    return (
      <Frame onBack={onBack}>
        <h1 className="font-display text-5xl leading-none">Cobrar</h1>
        <p className="mt-3 text-lg text-muted">Trabajos de imprenta y papelería que quedaron a deber.</p>
        <div className="mt-8 flex flex-col gap-2">
          {people.length === 0 && loose.length === 0 ? <p className="text-lg text-muted">Nadie debe.</p> : null}
          {people.map((row) => (
            <button
              key={row.customer.id}
              type="button"
              onClick={() => onPick(row.customer.id)}
              className="flex min-h-16 items-center justify-between rounded-3xl border border-line bg-card px-5 text-left"
            >
              <span className="text-xl">{row.customer.name}</span>
              <span className="text-lg tabular-nums text-stamp">{formatMoney(row.owed)}</span>
            </button>
          ))}
          {loose.map((sale) => (
            <button
              key={sale.id}
              type="button"
              onClick={() => onPick(`sale:${sale.id}`)}
              className="flex min-h-16 items-center justify-between rounded-3xl border border-line bg-card px-5 text-left"
            >
              <span className="text-xl">{sale.customerName} · papelería</span>
              <span className="text-lg tabular-nums text-stamp">{formatMoney(saleBalance(sale))}</span>
            </button>
          ))}
        </div>
      </Frame>
    );
  }

  return <Cobro customerId={customerId} onBack={onBack} onOpen={onOpen} />;
}

function Cobro({
  customerId,
  onBack,
  onOpen,
}: {
  customerId: string;
  onBack: () => void;
  onOpen: (jobId: string) => void;
}) {
  const customer = useShop((s) => s.customers.find((item) => item.id === customerId));
  const openJobs = useShop((s) => s.jobs.filter((job) => job.customerId === customerId && balanceOf(job) > 0));
  const openSales = useShop((s) => s.sales.filter((sale) => sale.customerId === customerId && saleBalance(sale) > 0));
  const addPayment = useShop((s) => s.addPayment);
  const paySale = useShop((s) => s.paySale);
  const firstJob = openJobs[0];
  const firstSale = openSales[0];
  const [pick, setPick] = useState(firstJob ? `job:${firstJob.id}` : firstSale ? `sale:${firstSale.id}` : "");
  const [amount, setAmount] = useState(
    firstJob ? String(balanceOf(firstJob)) : firstSale ? String(saleBalance(firstSale)) : "",
  );
  const [done, setDone] = useState(0);
  const selectedJob = openJobs.find((job) => pick === `job:${job.id}`);
  const selectedSale = openSales.find((sale) => pick === `sale:${sale.id}`);

  if (!customer) {
    return (
      <Frame onBack={onBack}>
        <p className="text-xl">No encontré a ese cliente.</p>
      </Frame>
    );
  }

  if (done > 0) {
    return (
      <Frame onBack={onBack}>
        <h1 className="font-display text-5xl leading-none">Quedó anotado</h1>
        <p className="mt-4 text-2xl">
          Entraron {formatMoney(done)} de {customer.name}.
        </p>
        <div className="mt-8">
          <Primary onClick={onBack}>Volver al taller</Primary>
        </div>
      </Frame>
    );
  }

  return (
    <Frame onBack={onBack}>
      <h1 className="font-display text-5xl leading-none">{customer.name}</h1>
      <div className="mt-8 flex flex-col gap-2">
        {openJobs.map((job) => (
          <button
            key={job.id}
            type="button"
            onClick={() => {
              setPick(`job:${job.id}`);
              setAmount(String(balanceOf(job)));
            }}
            className={`min-h-16 rounded-3xl border px-5 text-left text-lg ${pick === `job:${job.id}` ? "border-ink bg-ink text-band-fg" : "border-line bg-card"}`}
          >
            {job.number} · {job.typeName} · {formatMoney(balanceOf(job))}
          </button>
        ))}
        {openSales.map((sale) => (
          <button
            key={sale.id}
            type="button"
            onClick={() => {
              setPick(`sale:${sale.id}`);
              setAmount(String(saleBalance(sale)));
            }}
            className={`min-h-16 rounded-3xl border px-5 text-left text-lg ${pick === `sale:${sale.id}` ? "border-ink bg-ink text-band-fg" : "border-line bg-card"}`}
          >
            {sale.number} · Papelería · {formatMoney(saleBalance(sale))}
          </button>
        ))}
      </div>
      {selectedJob || selectedSale ? (
        <div className="mt-6 flex flex-col items-start gap-3">
          <Field label="¿Cuánto paga ahora?" value={amount} inputMode="decimal" onChange={setAmount} />
          <Primary
            tone="stamp"
            onClick={() => {
              const applied = selectedJob
                ? addPayment(selectedJob.id, parseMoney(amount))
                : selectedSale
                  ? paySale(selectedSale.id, parseMoney(amount))
                  : 0;
              if (applied > 0) setDone(applied);
            }}
          >
            Registrar pago
          </Primary>
          {selectedJob ? <Quiet onClick={() => onOpen(selectedJob.id)}>Ver el trabajo</Quiet> : null}
        </div>
      ) : (
        <p className="mt-6 text-lg text-muted">Este cliente no debe nada.</p>
      )}
    </Frame>
  );
}

function PagarVenta({ saleId, onBack }: { saleId: string; onBack: () => void }) {
  const sale = useShop((s) => s.sales.find((item) => item.id === saleId));
  const paySale = useShop((s) => s.paySale);
  const [amount, setAmount] = useState(sale ? String(saleBalance(sale)) : "");
  const [done, setDone] = useState(0);
  if (!sale) {
    return (
      <Frame onBack={onBack}>
        <p className="text-xl">Esa venta ya no está.</p>
      </Frame>
    );
  }
  if (done > 0) {
    return (
      <Frame onBack={onBack}>
        <h1 className="font-display text-5xl leading-none">Quedó anotado</h1>
        <p className="mt-4 text-2xl">Entraron {formatMoney(done)}.</p>
        <div className="mt-8">
          <Primary onClick={onBack}>Volver al mostrador</Primary>
        </div>
      </Frame>
    );
  }
  const left = saleBalance(sale);
  return (
    <Frame onBack={onBack}>
      <h1 className="font-display text-5xl leading-none">{sale.customerName}</h1>
      <p className="mt-3 text-lg text-muted">{sale.lines.map((line) => `${line.qty} ${line.name}`).join(", ")}</p>
      <p className="mt-2 text-2xl text-stamp tabular-nums">Debe {formatMoney(left)}</p>
      {left > 0 ? (
        <div className="mt-6 flex flex-col items-start gap-3">
          <Field label="¿Cuánto paga ahora?" value={amount} inputMode="decimal" onChange={setAmount} />
          <Primary
            tone="stamp"
            onClick={() => {
              const applied = paySale(sale.id, parseMoney(amount));
              if (applied > 0) setDone(applied);
            }}
          >
            Registrar pago
          </Primary>
        </div>
      ) : (
        <p className="mt-6 text-lg">Esta papelería ya está pagada.</p>
      )}
    </Frame>
  );
}

export function Repetir({
  onBack,
  onUse,
}: {
  onBack: () => void;
  onUse: (draft: Draft, who: string) => void;
}) {
  const jobs = useShop((s) => s.jobs);
  const customers = useShop((s) => s.customers);
  const types = useShop((s) => s.types);
  const [q, setQ] = useState("");
  const query = norm(q);
  const shown = [...jobs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((job) => {
      const person = customers.find((customer) => customer.id === job.customerId);
      return norm(`${person?.name ?? ""} ${job.typeName}`).includes(query);
    });

  return (
    <Frame onBack={onBack}>
      <h1 className="font-display text-5xl leading-none">Repetir</h1>
      <p className="mt-3 text-lg text-muted">Se abre la misma hoja, con los datos de la vez pasada.</p>
      <div className="mt-6">
        <Field label="Buscar" value={q} onChange={setQ} placeholder="Nombre o trabajo" />
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {shown.length === 0 ? <p className="text-lg text-muted">Todavía no hay pedidos.</p> : null}
        {shown.map((job) => {
          const person = customers.find((customer) => customer.id === job.customerId);
          return (
            <button
              key={job.id}
              type="button"
              onClick={() => person && onUse(draftFrom(job, person, types), person.name)}
              className="min-h-16 rounded-3xl border border-line bg-card px-5 text-left"
            >
              <span className="block text-xl">{person?.name ?? "Sin nombre"}</span>
              <span className="text-base text-muted">
                {job.typeName}
                {job.price > 0 ? ` · ${formatMoney(job.price)}` : ""}
              </span>
            </button>
          );
        })}
      </div>
    </Frame>
  );
}

function draftFrom(
  job: Job,
  person: { id: string; name: string; phone: string },
  types: { id: string; drawerId: string }[],
): Draft {
  const type = types.find((item) => item.id === job.typeId);
  return {
    customerId: person.id,
    name: person.name,
    phone: person.phone,
    typeId: job.typeId,
    drawerId: type?.drawerId ?? null,
    quantity: job.quantity,
    dueChoice: "hoy",
    dueDate: "",
    notes: job.notes,
    price: job.price ? String(job.price) : "",
    paid: "",
  };
}
