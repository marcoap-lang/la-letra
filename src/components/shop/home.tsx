import { Children, useRef, useState, type ReactNode } from "react";
import { balanceOf, downloadSnapshot, parseSnapshot, saleBalance, toSnapshot, useShop, type Job, type Sale } from "@/lib/shop/store";
import { formatDay, formatMoney, norm, todayISO } from "@/lib/shop/format";
import { Frame, Primary, Quiet } from "./ui";

type Place = "pendientes" | "listos" | "cobrar" | "papeleria";

export function Home({
  onNew,
  onSell,
  onOpen,
  onRepeat,
  onTypes,
  onAdvance,
  onDeliver,
  onCharge,
  onChargeSale,
}: {
  onNew: () => void;
  onSell: () => void;
  onOpen: (jobId: string) => void;
  onRepeat: () => void;
  onTypes: () => void;
  onAdvance: (job: Job) => void;
  onDeliver: (jobId: string) => void;
  onCharge: (customerId: string) => void;
  onChargeSale: (saleId: string) => void;
}) {
  const jobs = useShop((s) => s.jobs);
  const sales = useShop((s) => s.sales);
  const customers = useShop((s) => s.customers);
  const replaceAll = useShop((s) => s.replaceAll);
  const fileRef = useRef<HTMLInputElement>(null);
  const [copyNote, setCopyNote] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [place, setPlace] = useState<Place>("pendientes");
  const [q, setQ] = useState("");

  const nameOf = (id: string) => customers.find((customer) => customer.id === id)?.name ?? "Sin nombre";
  const taller = jobs.filter((job) => job.status === "nuevo" || job.status === "aprobado");
  const listos = jobs.filter((job) => job.status === "listo");
  const debtJobs = jobs.filter((job) => balanceOf(job) > 0);
  const debtSales = sales.filter((sale) => saleBalance(sale) > 0);
  const today = todayISO();
  const soldToday = sales.filter((sale) => sale.createdAt.slice(0, 10) === today);
  const caja = soldToday.reduce((sum, sale) => sum + sale.paid, 0);
  const query = norm(q.trim());
  const jobHit = (job: Job) =>
    !query || norm(`${nameOf(job.customerId)} ${job.typeName} ${job.number} ${job.notes}`).includes(query);
  const saleHit = (sale: Sale) =>
    !query ||
    norm(`${sale.customerName} ${sale.number} ${sale.lines.map((line) => line.name).join(" ")}`).includes(query);
  const pendientes = taller.filter(jobHit);
  const listosVis = listos.filter(jobHit);
  const cobrarJobs = debtJobs.filter(jobHit);
  const cobrarSales = debtSales.filter(saleHit);
  const papeleriaVis = soldToday.filter(saleHit);
  const elsewhere = (
    [
      { id: "pendientes", label: "Pendientes", n: pendientes.length },
      { id: "listos", label: "Listos", n: listosVis.length },
      { id: "cobrar", label: "Por cobrar", n: cobrarJobs.length + cobrarSales.length },
      { id: "papeleria", label: "Papelería", n: papeleriaVis.length },
    ] as const
  ).filter((item) => item.id !== place && item.n > 0);

  return (
    <Frame
      narrow={false}
      action={
        <div className="flex flex-col gap-2">
          <Primary tone="stamp" onClick={onNew}>
            Anotar trabajo
          </Primary>
          <button
            type="button"
            onClick={onSell}
            className="min-h-14 rounded-2xl border border-band-fg/20 px-5 text-lg font-medium text-band-fg"
          >
            Vender papelería
          </button>
        </div>
      }
    >
      <header className="mb-6">
        <p className="text-sm font-medium text-muted">Mostrador</p>
        <h1 className="mt-1 text-4xl font-medium tracking-tight">Dónde está cada cosa</h1>
        <p className="mt-2 max-w-2xl text-lg text-muted">
          Pendientes es lo que falta por hacer. Listos ya se pueden entregar. Por cobrar es el dinero. Papelería es la caja, no el taller.
        </p>
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Buscar cliente, trabajo o número"
          className="mt-4 w-full rounded-2xl border border-line bg-card px-4 py-3 text-lg"
        />
        {query && elsewhere.length > 0 ? (
          <p className="mt-3 text-base text-muted">
            También aparece en{" "}
            {elsewhere.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPlace(item.id)}
                className="mr-3 font-medium text-ink underline decoration-line underline-offset-4"
              >
                {item.label} ({item.n})
              </button>
            ))}
          </p>
        ) : null}
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <PlaceCard
          active={place === "pendientes"}
          title="Pendientes"
          hint="Falta hacerlos"
          value={String(taller.length)}
          onClick={() => setPlace("pendientes")}
        />
        <PlaceCard
          active={place === "listos"}
          title="Listos"
          hint="Para entregar"
          value={String(listos.length)}
          onClick={() => setPlace("listos")}
        />
        <PlaceCard
          active={place === "cobrar"}
          title="Por cobrar"
          hint="Dinero pendiente"
          value={String(debtJobs.length + debtSales.length)}
          onClick={() => setPlace("cobrar")}
        />
        <PlaceCard
          active={place === "papeleria"}
          title="Papelería"
          hint="Caja de hoy"
          value={formatMoney(caja)}
          onClick={() => setPlace("papeleria")}
        />
      </div>

      <section className="mt-6">
        {place === "pendientes" ? (
          <Pile
            title="Pendientes"
            hint="Estos trabajos están en el taller."
            empty={query ? "Nada con ese nombre en pendientes." : "No hay pendientes. Cuando anote un trabajo, aparece aquí."}
            action="Anotar trabajo"
            onAction={onNew}
          >
            {pendientes.map((job) => (
              <Ticket
                key={job.id}
                job={job}
                who={nameOf(job.customerId)}
                where={job.needsProof && job.status === "nuevo" ? "Esperando el arte" : "En el taller"}
                onOpen={() => onOpen(job.id)}
                action={job.needsProof && job.status === "nuevo" ? "Ya lo aprobó" : "Ya está listo"}
                onAction={() => onAdvance(job)}
              />
            ))}
          </Pile>
        ) : null}
        {place === "listos" ? (
          <Pile title="Listos" hint="Ya se pueden entregar." empty={query ? "Nada con ese nombre en listos." : "Nada listo para entregar."}>
            {listosVis.map((job) => (
              <Ticket
                key={job.id}
                job={job}
                who={nameOf(job.customerId)}
                where="Listo en el mostrador"
                onOpen={() => onOpen(job.id)}
                action="Ya se lo llevó"
                onAction={() => onDeliver(job.id)}
              />
            ))}
          </Pile>
        ) : null}
        {place === "cobrar" ? (
          <Pile title="Por cobrar" hint="Trabajos y papelería que todavía deben." empty={query ? "Nadie con ese nombre debe." : "Nadie debe."}>
            {cobrarJobs.map((job) => (
              <Ticket
                key={job.id}
                job={job}
                who={nameOf(job.customerId)}
                where="Saldo pendiente"
                onOpen={() => onOpen(job.id)}
                action="Cobrar"
                onAction={() => onCharge(job.customerId)}
              />
            ))}
            {cobrarSales.map((sale) => (
              <article key={sale.id} className="rounded-2xl border border-line bg-card p-4 shadow-ticket">
                <p className="text-sm font-medium text-stamp">Papelería · saldo</p>
                <p className="mt-2 font-display text-4xl leading-none tabular-nums">{sale.number}</p>
                <p className="mt-3 text-xl font-medium">{sale.customerName}</p>
                <p className="mt-1 text-base text-muted">{sale.lines.map((line) => line.name).join(", ")}</p>
                <p className="mt-2 font-medium text-stamp tabular-nums">Debe {formatMoney(saleBalance(sale))}</p>
                <button
                  type="button"
                  onClick={() => onChargeSale(sale.id)}
                  className="mt-4 min-h-12 w-full rounded-xl bg-ink text-base font-medium text-band-fg"
                >
                  Cobrar
                </button>
              </article>
            ))}
          </Pile>
        ) : null}
        {place === "papeleria" ? (
          <Pile
            title="Papelería de hoy"
            hint="Ventas del mostrador. No entran al taller."
            empty={query ? "Hoy no hay una venta con ese nombre." : "Hoy no ha vendido papelería."}
            action="Vender papelería"
            onAction={onSell}
          >
            {papeleriaVis.map((sale) => (
              <article key={sale.id} className="rounded-2xl border border-line bg-card p-4 shadow-ticket">
                <SaleRow sale={sale} onCharge={() => onChargeSale(sale.id)} />
              </article>
            ))}
          </Pile>
        ) : null}
      </section>

      <footer className="no-print mt-12 flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <Quiet onClick={onRepeat}>Repetir un pedido</Quiet>
        <Quiet onClick={onTypes}>Trabajos de imprenta</Quiet>
        <Quiet onClick={() => downloadSnapshot(toSnapshot(useShop.getState()))}>Guardar copia</Quiet>
        <Quiet onClick={() => fileRef.current?.click()}>Traer copia</Quiet>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              try {
                const snap = parseSnapshot(JSON.parse(String(reader.result)));
                if (!snap) {
                  setCopyNote("Ese archivo no es de La Letra.");
                  return;
                }
                setCopyNote("");
                setPending(JSON.stringify(snap));
              } catch {
                setCopyNote("No se pudo leer el archivo.");
              }
            };
            reader.readAsText(file);
          }}
        />
      </footer>
      {copyNote ? <p className="mt-3 text-base text-stamp">{copyNote}</p> : null}
      {pending ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-3xl border border-line bg-card p-4">
          <p className="text-base">Esto reemplaza lo que hay en este aparato.</p>
          <Primary
            tone="stamp"
            onClick={() => {
              const snap = parseSnapshot(JSON.parse(pending));
              if (snap) replaceAll(snap);
              setPending(null);
            }}
          >
            Traer la copia
          </Primary>
          <Quiet onClick={() => setPending(null)}>Cancelar</Quiet>
        </div>
      ) : null}
    </Frame>
  );
}

function SaleRow({ sale, onCharge }: { sale: Sale; onCharge: () => void }) {
  const left = saleBalance(sale);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p>
        <span className="font-medium">{sale.customerName}</span>
        <span className="text-muted"> · {sale.lines.map((line) => `${line.qty} ${line.name}`).join(", ")}</span>
      </p>
      {left > 0 ? (
        <button type="button" onClick={onCharge} className="font-medium text-stamp tabular-nums">
          Debe {formatMoney(left)}
        </button>
      ) : (
        <span className="text-muted tabular-nums">{formatMoney(sale.total)}</span>
      )}
    </div>
  );
}

function PlaceCard({
  active,
  title,
  hint,
  value,
  onClick,
}: {
  active: boolean;
  title: string;
  hint: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-4 py-4 text-left ${active ? "bg-ink text-band-fg" : "border border-line bg-card text-ink shadow-ticket"}`}
    >
      <span className={`block text-sm font-medium ${active ? "text-band-fg/65" : "text-muted"}`}>{hint}</span>
      <span className="mt-3 block font-display text-4xl leading-none tabular-nums">{value}</span>
      <span className="mt-2 block text-lg font-medium">{title}</span>
    </button>
  );
}

function Pile({
  title,
  hint,
  empty,
  action,
  onAction,
  children,
}: {
  title: string;
  hint: string;
  empty: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  const count = Children.count(children);
  return (
    <div>
      <h2 className="text-2xl font-medium tracking-tight">{title}</h2>
      <p className="mt-1 text-base text-muted">{hint}</p>
      {count === 0 ? (
        <div className="mt-4 rounded-2xl border border-line bg-card px-5 py-8">
          <p className="text-lg">{empty}</p>
          {action && onAction ? (
            <button type="button" onClick={onAction} className="mt-4 min-h-12 text-lg font-medium text-stamp">
              {action}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{children}</div>
      )}
    </div>
  );
}

function Ticket({
  job,
  who,
  where,
  action,
  onOpen,
  onAction,
}: {
  job: Job;
  who: string;
  where: string;
  action: string;
  onOpen: () => void;
  onAction: () => void;
}) {
  const left = balanceOf(job);
  const late = job.status !== "entregado" && job.due < todayISO();
  return (
    <article className="rounded-2xl border border-line bg-card p-4 shadow-ticket">
      <button type="button" onClick={onOpen} className="w-full text-left">
        <span className="text-sm font-medium text-muted">{where}</span>
        <span className="mt-2 flex items-baseline justify-between gap-3">
          <span className="font-display text-4xl leading-none tabular-nums">{job.number}</span>
          <span className="text-sm text-muted">{formatDay(job.due)}</span>
        </span>
        <span className="mt-3 block text-xl font-medium leading-tight">{who}</span>
        <span className="mt-1 block text-base text-muted">
          {job.typeName}
          {job.quantity > 1 ? ` · ${job.quantity}` : ""}
          {late ? <span className="text-stamp"> · Atrasado</span> : null}
        </span>
        <span className={`mt-2 block text-base tabular-nums ${left > 0 ? "font-medium text-stamp" : "text-muted"}`}>
          {left > 0 ? `Debe ${formatMoney(left)}` : job.price > 0 ? "Pagado" : "Sin precio"}
        </span>
      </button>
      <button
        type="button"
        onClick={onAction}
        className="mt-4 min-h-12 w-full rounded-xl bg-ink text-base font-medium text-band-fg"
      >
        {action}
      </button>
    </article>
  );
}
