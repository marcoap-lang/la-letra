import { Children, useRef, useState, type ReactNode } from "react";
import { ShoppingBag, ClipboardPlus, Search, Clock3, CircleCheck, Wallet, ReceiptText, ArrowRight, Repeat2, ListPlus } from "lucide-react";
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
      action={<button type="button" onClick={() => downloadSnapshot(toSnapshot(useShop.getState()))} title="Los datos todavía se guardan en este dispositivo. Descargar copia de seguridad." className="flex min-h-11 items-center rounded-xl border border-line bg-paper px-3 text-sm font-semibold text-muted hover:bg-blue-50">Datos en este equipo · Guardar copia</button>}
    >
      <header className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.12em] text-stamp">Buen día</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">¿Qué vamos a hacer?</h1>
            <p className="mt-2 text-base text-muted">Elija una opción para comenzar.</p>
          </div>
          <span className="rounded-xl border border-line bg-card px-3 py-2 text-sm font-semibold text-muted">{new Date().toLocaleDateString("es-MX", {day:"numeric", month:"long", year:"numeric"})}</span>
        </div>
      </header>
      <div className="mb-8 grid gap-3 md:grid-cols-2">
        <button type="button" onClick={onSell} className="group flex min-h-36 items-center gap-4 rounded-2xl bg-stamp p-5 text-left text-white shadow-[0_10px_30px_rgba(23,105,212,.18)] transition hover:bg-blue-700 sm:p-6">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white/20"><ShoppingBag size={34} strokeWidth={2} /></span>
          <span className="flex-1">
            <span className="block text-2xl font-extrabold sm:text-3xl">Nueva venta</span>
            <span className="mt-1 block text-base text-white/90">Papelería, copias y artículos</span>
          </span>
          <ArrowRight className="hidden opacity-70 transition group-hover:translate-x-1 sm:block" size={25}/>
        </button>
        <button type="button" onClick={onNew} className="group flex min-h-36 items-center gap-4 rounded-2xl border-2 border-ink bg-card p-5 text-left shadow-ticket transition hover:bg-blue-50 sm:p-6">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-stamp"><ClipboardPlus size={34} strokeWidth={2} /></span>
          <span className="flex-1">
            <span className="block text-2xl font-extrabold sm:text-3xl">Nuevo trabajo</span>
            <span className="mt-1 block text-base text-muted">Pedidos para la imprenta</span>
          </span>
          <ArrowRight className="hidden text-ink/50 transition group-hover:translate-x-1 sm:block" size={25}/>
        </button>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-extrabold">Así va el negocio</h2>
        <span className="text-sm text-muted">Estado actual de pedidos y caja de papelería</span>
      </div>
      <div className="relative mb-5">
        <Search size={21} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Buscar cliente, pedido o número"
          aria-label="Buscar clientes y pedidos"
          className="w-full min-h-14 rounded-2xl border border-line bg-card py-3 pl-12 pr-4 text-lg shadow-sm transition focus:border-stamp"
        />
      </div>
      {query && elsewhere.length > 0 ? (
        <p className="mb-4 text-base text-muted">
          También aparece en{" "}
          {elsewhere.map((item) => (
            <button key={item.id} type="button" onClick={() => setPlace(item.id)} className="mr-3 font-bold text-stamp underline underline-offset-4">
              {item.label} ({item.n})
            </button>
          ))}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <PlaceCard
          active={place === "pendientes"}
          title="Pendientes"
          hint="Falta hacerlos"
          value={String(taller.length)}
          icon={<Clock3 size={23}/>}
          onClick={() => setPlace("pendientes")}
        />
        <PlaceCard
          active={place === "listos"}
          title="Listos"
          hint="Para entregar"
          value={String(listos.length)}
          icon={<CircleCheck size={23}/>}
          onClick={() => setPlace("listos")}
        />
        <PlaceCard
          active={place === "cobrar"}
          title="Por cobrar"
          hint="Dinero pendiente"
          value={String(debtJobs.length + debtSales.length)}
          icon={<Wallet size={23}/>}
          onClick={() => setPlace("cobrar")}
        />
        <PlaceCard
          active={place === "papeleria"}
          title="Papelería"
          hint="Caja de hoy"
          value={formatMoney(caja)}
          icon={<ReceiptText size={23}/>}
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

      <footer className="no-print mt-12 rounded-2xl border border-line bg-card p-5">
        <h2 className="mb-3 text-lg font-bold">Otras herramientas</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Quiet onClick={onRepeat}><Repeat2 size={19} className="mr-2"/> Repetir pedido</Quiet>
          <Quiet onClick={onTypes}><ListPlus size={19} className="mr-2"/> Servicios de imprenta</Quiet>
          <Quiet onClick={() => downloadSnapshot(toSnapshot(useShop.getState()))}>Descargar respaldo</Quiet>
          <Quiet onClick={() => fileRef.current?.click()}>Importar respaldo</Quiet>
        </div>
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
  icon,
  onClick,
}: {
  active: boolean;
  title: string;
  hint: string;
  value: string;
  icon?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-36 rounded-2xl border-2 px-4 py-4 text-left transition sm:px-5 ${active ? "border-stamp bg-blue-50 text-ink shadow-sm" : "border-line bg-card text-ink shadow-ticket hover:border-stamp/40"}`}
    >
      <span className="flex items-center justify-between gap-2 text-sm font-semibold text-muted">
        {hint}<span className={active ? "text-stamp" : "text-muted"}>{icon}</span>
      </span>
      <span className="mt-2 block text-3xl font-extrabold leading-none tabular-nums sm:text-4xl">{value}</span>
      <span className="mt-3 block text-lg font-bold">{title}</span>
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
        <div className="mt-4 grid gap-3 md:grid-cols-2">{children}</div>
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
