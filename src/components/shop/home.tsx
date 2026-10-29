import { Children, useRef, useState, type ReactNode } from "react";
import { ShoppingBag, ClipboardPlus, Search, Clock3, CircleCheck, Wallet, ReceiptText, ArrowRight, Repeat2, ListPlus, Boxes, TriangleAlert, Users, ChartNoAxesColumn, Download } from "lucide-react";
import { balanceOf, downloadSnapshot, parseSnapshot, saleBalance, toSnapshot, useShop, type Job, type Sale } from "@/lib/shop/store";
import { formatDay, formatMoney, norm, todayISO } from "@/lib/shop/format";
import { useInstallApp } from "@/lib/pwa";
import { useSyncStatus } from "@/lib/shop/sync-status";
import { alertsOf, qtyText } from "@/lib/shop/inventory";
import { Frame, Primary, Quiet } from "./ui";

function SyncBadge() {
  const { mode } = useSyncStatus();
  const problem =
    mode === "offline" ? "Sin internet. Sus cambios se guardarán al volver la conexión."
    : mode === "denied" ? "Esta cuenta no puede guardar. Avise a soporte."
    : mode === "conflict" ? "Hay datos distintos en la nube. Toque el aviso naranja de abajo para revisar."
    : "";
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
      {problem ? <span role="alert" className="rounded-lg bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-900">{problem}</span> : null}
    </div>
  );
}

type Place = "pendientes" | "listos" | "cobrar" | "papeleria";

export function Home({
  onNew,
  onSell,
  onOpen,
  onRepeat,
  onTypes,
  onInventory,
  onCustomers,
  onStats,
  onAdvance,
  onDeliver,
  onCharge,
  onChargeSale,
  onOpenSale,
}: {
  onNew: () => void;
  onSell: () => void;
  onOpen: (jobId: string) => void;
  onRepeat: () => void;
  onTypes: () => void;
  onInventory: (tab: "papeleria" | "insumos") => void;
  onCustomers: () => void;
  onStats: () => void;
  onAdvance: (job: Job) => void;
  onDeliver: (jobId: string) => void;
  onCharge: (customerId: string) => void;
  onChargeSale: (saleId: string) => void;
  onOpenSale: (saleId: string) => void;
}) {
  const jobs = useShop((s) => s.jobs);
  const sales = useShop((s) => s.sales);
  const customers = useShop((s) => s.customers);
  const goods = useShop((s) => s.goods);
  const supplies = useShop((s) => s.supplies);
  const replaceAll = useShop((s) => s.replaceAll);
  const fileRef = useRef<HTMLInputElement>(null);
  const installApp = useInstallApp();
  const [copyNote, setCopyNote] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [place, setPlace] = useState<Place>("pendientes");
  const [q, setQ] = useState("");
  const admin = new URLSearchParams(window.location.search).get("admin") === "1";

  const lowStock = alertsOf(goods, supplies);
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
      action={<SyncBadge />}
    >
      <header className="mb-7">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm font-bold uppercase tracking-[.14em] text-stamp">Buen día</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">¿Qué vamos a hacer?</h1>
            <p className="mt-2 text-base text-muted">Elija una opción para comenzar.</p>
          </div>
          <span className="rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold text-muted shadow-sm">{new Date().toLocaleDateString("es-MX", {day:"numeric", month:"long", year:"numeric"})}</span>
        </div>
      </header>
      <div className="mb-8 grid gap-3 md:grid-cols-2">
        <button type="button" onClick={onSell} className="group flex min-h-36 items-center gap-4 rounded-3xl bg-gradient-to-br from-blue-500 to-stamp-dark p-5 text-left text-white shadow-brand hover:brightness-105 sm:p-7">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/25"><ShoppingBag size={34} strokeWidth={2} /></span>
          <span className="flex-1">
            <span className="block text-2xl font-extrabold sm:text-3xl">Nueva venta</span>
            <span className="mt-1 block text-base text-white/90">Papelería, copias y artículos</span>
          </span>
          <ArrowRight className="hidden opacity-70 transition group-hover:translate-x-1 sm:block" size={25}/>
        </button>
        <button type="button" onClick={onNew} className="group flex min-h-36 items-center gap-4 rounded-3xl border border-line bg-card p-5 text-left shadow-ticket hover:border-stamp/40 hover:shadow-lift sm:p-7">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-tint text-stamp"><ClipboardPlus size={34} strokeWidth={2} /></span>
          <span className="flex-1">
            <span className="block text-2xl font-extrabold sm:text-3xl">Nuevo trabajo</span>
            <span className="mt-1 block text-base text-muted">Pedidos para la imprenta</span>
          </span>
          <ArrowRight className="hidden text-ink/40 transition group-hover:translate-x-1 sm:block" size={25}/>
        </button>
      </div>
      {lowStock.length > 0 ? (
        <button
          type="button"
          role="status"
          onClick={() => onInventory(lowStock[0].what === "supply" ? "insumos" : "papeleria")}
          className="mb-6 flex min-h-12 w-full items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2 text-left text-base text-amber-950"
        >
          <TriangleAlert size={20} className="shrink-0" />
          <span className="flex-1 font-semibold">
            {lowStock.length === 1 ? "1 cosa por acabarse" : `${lowStock.length} cosas por acabarse`}
            <span className="font-normal">: {lowStock.slice(0, 2).map((item) => item.name).join(", ")}{lowStock.length > 2 ? "…" : ""}</span>
          </span>
          <span className="shrink-0 font-bold underline underline-offset-4">Ver</span>
        </button>
      ) : null}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-extrabold tracking-tight">Así va el negocio</h2>
        <span className="text-sm text-muted">Estado actual de pedidos y caja de papelería</span>
      </div>
      <div className="relative mb-5">
        <Search size={21} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Buscar cliente, pedido o número"
          aria-label="Buscar clientes y pedidos"
          className="w-full min-h-14 rounded-2xl border border-line bg-card py-3 pl-12 pr-4 text-lg shadow-ticket"
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

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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
              <article key={sale.id} className="rounded-2xl border border-line/80 bg-card p-4 shadow-ticket">
                <p className="text-sm font-medium text-stamp">Papelería · saldo</p>
                <p className="mt-2 font-display text-4xl leading-none tabular-nums">{sale.number}</p>
                <p className="mt-3 text-xl font-medium">{sale.customerName}</p>
                <p className="mt-1 text-base text-muted">{sale.lines.map((line) => line.name).join(", ")}</p>
                <p className="mt-2 font-medium text-stamp tabular-nums">Debe {formatMoney(saleBalance(sale))}</p>
                <button
                  type="button"
                  onClick={() => onChargeSale(sale.id)}
                  className="mt-4 min-h-12 w-full rounded-xl bg-ink text-base font-bold text-band-fg hover:bg-slate-800"
                >
                  Cobrar
                </button>
                <button
                  type="button"
                  onClick={() => onOpenSale(sale.id)}
                  className="mt-2 min-h-12 w-full rounded-xl border border-line bg-card text-base font-semibold text-ink hover:bg-tint"
                >
                  Ver venta
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
              <article key={sale.id} className="rounded-2xl border border-line/80 bg-card p-4 shadow-ticket">
                <SaleRow sale={sale} onCharge={() => onChargeSale(sale.id)} onOpen={() => onOpenSale(sale.id)} />
              </article>
            ))}
          </Pile>
        ) : null}
      </section>

      <footer className="no-print mt-12 rounded-3xl border border-line/80 bg-card p-5 shadow-ticket">
        <h2 className="mb-3 text-lg font-bold">Consultas y otras herramientas</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Quiet onClick={() => onInventory("papeleria")}><Boxes size={19} className="mr-2"/> Inventario{lowStock.length > 0 ? ` (${lowStock.length} por acabarse)` : ""}</Quiet>
          <Quiet onClick={onCustomers}><Users size={19} className="mr-2"/> Clientes</Quiet>
          <Quiet onClick={onStats}><ChartNoAxesColumn size={19} className="mr-2"/> Estadísticas</Quiet>
          <Quiet onClick={onRepeat}><Repeat2 size={19} className="mr-2"/> Repetir pedido</Quiet>
          <Quiet onClick={onTypes}><ListPlus size={19} className="mr-2"/> Servicios de imprenta</Quiet>
          {installApp.canInstall ? <Quiet onClick={installApp.install}><Download size={19} className="mr-2"/> Instalar La Letra como app</Quiet> : null}
        </div>
        {admin ? (
          <div className="mt-5 border-t border-dashed border-line pt-4">
            <p className="mb-2 text-sm font-semibold text-muted">Administración (solo Marco)</p>
            <div className="flex flex-wrap items-center gap-3">
              <Quiet onClick={() => downloadSnapshot(toSnapshot(useShop.getState()))}>Descargar respaldo</Quiet>
              <Quiet onClick={() => fileRef.current?.click()}>Importar respaldo</Quiet>
            </div>
          </div>
        ) : null}
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
          <p className="text-base font-semibold">Esto reemplaza TODOS los datos actuales por los del archivo. ¿Seguro?</p>
          <Primary
            tone="stamp"
            onClick={() => {
              const snap = parseSnapshot(JSON.parse(pending));
              if (snap) replaceAll(snap);
              setPending(null);
            }}
          >
            Sí, reemplazar datos
          </Primary>
          <Quiet onClick={() => setPending(null)}>Cancelar</Quiet>
        </div>
      ) : null}
    </Frame>
  );
}

function SaleRow({ sale, onCharge, onOpen }: { sale: Sale; onCharge: () => void; onOpen: () => void }) {
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
      <button
        type="button"
        onClick={onOpen}
        className="min-h-12 rounded-xl border border-line bg-card px-4 text-base font-semibold text-ink hover:bg-tint"
      >
        Ver venta
      </button>
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
      aria-pressed={active}
      className={`flex min-h-36 flex-col rounded-3xl border px-4 py-4 text-left sm:px-5 ${active ? "border-stamp bg-tint text-ink shadow-lift ring-2 ring-stamp/30" : "border-line/80 bg-card text-ink shadow-ticket hover:border-stamp/40 hover:shadow-lift"}`}
    >
      <span className="flex items-center justify-between gap-2 text-sm font-semibold text-muted">
        <span>{hint}</span>
        <span className={`flex size-10 items-center justify-center rounded-full ${active ? "bg-stamp text-white" : "bg-tint text-stamp"}`}>{icon}</span>
      </span>
      <span className="mt-auto block pt-3 text-3xl font-extrabold leading-none tabular-nums sm:text-4xl">{value}</span>
      <span className="mt-1.5 block text-lg font-bold">{title}</span>
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
      <h2 className="text-2xl font-extrabold tracking-tight">{title}</h2>
      <p className="mt-1 text-base text-muted">{hint}</p>
      {count === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-line bg-card/70 px-5 py-8">
          <p className="text-lg">{empty}</p>
          {action && onAction ? (
            <button type="button" onClick={onAction} className="mt-4 min-h-12 text-lg font-bold text-stamp">
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
    <article className="rounded-2xl border border-line/80 bg-card p-4 shadow-ticket">
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
        className="mt-4 min-h-12 w-full rounded-xl bg-ink text-base font-bold text-band-fg hover:bg-slate-800"
      >
        {action}
      </button>
    </article>
  );
}
