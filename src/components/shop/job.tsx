import { useState, type ReactNode } from "react";
import { dueFromChoice, formatDay, formatMoney, parseMoney, todayISO, waLink, type DueChoice } from "@/lib/shop/format";
import { jobMessage } from "@/lib/shop/messages";
import { balanceOf, useShop, type Job, type JobStatus } from "@/lib/shop/store";
import { Chip, Field, Frame, Primary, Quiet, Stepper } from "./ui";

function openWhatsApp(phone: string, text: string) {
  window.open(waLink(phone, text), "_blank", "noopener,noreferrer");
}

function pathOf(job: Job): { id: JobStatus; label: string }[] {
  if (job.needsProof) {
    return [
      { id: "nuevo", label: "Recibido" },
      { id: "aprobado", label: "Aprobado" },
      { id: "listo", label: "Listo" },
      { id: "entregado", label: "Entregado" },
    ];
  }
  return [
    { id: "nuevo", label: "Recibido" },
    { id: "listo", label: "Listo" },
    { id: "entregado", label: "Entregado" },
  ];
}

function nextStep(job: Job): { label: string; status: JobStatus } | null {
  if (job.status === "entregado") return null;
  if (job.status === "listo") return { label: "Ya se lo llevó", status: "entregado" };
  if (job.status === "aprobado" || !job.needsProof) return { label: "Ya está listo", status: "listo" };
  return { label: "Ya lo aprobó", status: "aprobado" };
}

export function Trabajo({
  jobId,
  onBack,
  onEdit,
  onCharge,
}: {
  jobId: string;
  onBack: () => void;
  onEdit: () => void;
  onCharge: (customerId: string) => void;
}) {
  const job = useShop((s) => s.jobs.find((item) => item.id === jobId));
  const customer = useShop((s) => s.customers.find((item) => item.id === job?.customerId));
  const setStatus = useShop((s) => s.setStatus);
  const deleteJob = useShop((s) => s.deleteJob);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!job || !customer) {
    return (
      <Frame onBack={onBack}>
        <p className="text-xl">Ese trabajo ya no está.</p>
      </Frame>
    );
  }

  const left = balanceOf(job);
  const late = job.status !== "entregado" && job.due < todayISO();
  const step = nextStep(job);
  const message = jobMessage(job, customer);
  const path = pathOf(job);
  const here = path.findIndex((item) => item.id === job.status);

  return (
    <Frame onBack={onBack}>
      <p className="text-sm text-muted">Trabajo</p>
      <div className="mt-1 flex items-end justify-between gap-4">
        <h1 className="font-display text-6xl leading-none tabular-nums">{job.number}</h1>
        <p className="pb-1 text-lg text-muted">{formatDay(job.due)}</p>
      </div>

      <ol className="mt-8 flex">
        {path.map((item, index) => {
          const done = index <= here;
          return (
            <li key={item.id} className="min-w-0 flex-1">
              <div className="flex items-center">
                <span className={`size-3 shrink-0 rounded-full ${done ? "bg-ink" : "border border-line bg-card"}`} />
                {index < path.length - 1 ? (
                  <span className={`h-px flex-1 ${index < here ? "bg-ink" : "bg-line"}`} />
                ) : null}
              </div>
              <p className={`mt-2 pr-2 text-sm ${index === here ? "font-medium text-ink" : "text-muted"}`}>{item.label}</p>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-base text-muted">El botón de abajo avanza un paso. Nada se imprime sin pasar por aquí.</p>

      <dl className="mt-8 grid gap-x-8 gap-y-4 border-t border-ink pt-6 sm:grid-cols-2">
        <Row k="Cliente" v={customer.name} />
        <Row
          k="Teléfono"
          v={
            customer.phone ? (
              <a href={`tel:${customer.phone}`} className="underline decoration-line underline-offset-4">
                {customer.phone}
              </a>
            ) : (
              "Sin teléfono"
            )
          }
        />
        <Row k="Trabajo" v={job.typeName} />
        <Row k="Cantidad" v={String(job.quantity)} />
        <Row k="Precio" v={job.price > 0 ? formatMoney(job.price) : "Sin anotar"} />
        <Row k="Saldo" v={left > 0 ? formatMoney(left) : "Pagado"} accent={left > 0} />
      </dl>
      {late ? <p className="mt-4 text-base font-medium text-stamp">Se pasó la fecha.</p> : null}
      {job.notes ? <p className="mt-4 rounded-lg bg-card px-4 py-3 text-lg">{job.notes}</p> : null}

      <div className="mt-8 flex flex-col items-start gap-3">
        {step ? (
          <Primary tone="stamp" onClick={() => setStatus(job.id, step.status)}>
            {step.label}
          </Primary>
        ) : (
          <p className="text-lg">Ya se entregó.</p>
        )}
        {job.status === "nuevo" && job.needsProof ? (
          <button type="button" onClick={() => setStatus(job.id, "listo")} className="min-h-11 text-base text-muted">
            Si no ocupa arte, márquelo listo
          </button>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <Quiet onClick={() => openWhatsApp(customer.phone, message)}>Avisar por WhatsApp</Quiet>
          <Quiet
            onClick={() => {
              void navigator.clipboard.writeText(message).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              });
            }}
          >
            {copied ? "Copiado" : "Copiar mensaje"}
          </Quiet>
          {left > 0 ? <Quiet onClick={() => onCharge(customer.id)}>Cobrar</Quiet> : null}
          <Quiet onClick={onEdit}>Cambiar datos</Quiet>
        </div>
        <p className="max-w-prose text-base whitespace-pre-wrap text-muted">{message}</p>
        {confirmDelete ? (
          <div className="flex flex-wrap gap-2">
            <Primary
              tone="stamp"
              onClick={() => {
                deleteJob(job.id);
                onBack();
              }}
            >
              Sí, borrar
            </Primary>
            <Quiet onClick={() => setConfirmDelete(false)}>No</Quiet>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="min-h-11 text-base text-stamp">
            Borrar este trabajo
          </button>
        )}
      </div>
    </Frame>
  );
}

function Row({ k, v, accent }: { k: string; v: ReactNode; accent?: boolean }) {
  return (
    <div>
      <dt className="text-sm text-muted">{k}</dt>
      <dd className={`text-xl ${accent ? "font-medium text-stamp" : ""}`}>{v}</dd>
    </div>
  );
}

const DUE: { id: DueChoice; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "manana", label: "Mañana" },
  { id: "tres", label: "En 3 días" },
  { id: "semana", label: "La otra semana" },
  { id: "fecha", label: "Otra fecha" },
];

export function Editar({ jobId, onBack }: { jobId: string; onBack: () => void }) {
  const job = useShop((s) => s.jobs.find((item) => item.id === jobId));
  const customer = useShop((s) => s.customers.find((item) => item.id === job?.customerId));
  const updateJob = useShop((s) => s.updateJob);
  const updateCustomer = useShop((s) => s.updateCustomer);
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [quantity, setQuantity] = useState(job?.quantity ?? 1);
  const [dueChoice, setDueChoice] = useState<DueChoice>(job?.due === todayISO() ? "hoy" : "fecha");
  const [dueDate, setDueDate] = useState(job && job.due !== todayISO() ? job.due : "");
  const [price, setPrice] = useState(job?.price ? String(job.price) : "");
  const [paid, setPaid] = useState(job?.paid ? String(job.paid) : "");
  const [notes, setNotes] = useState(job?.notes ?? "");

  if (!job || !customer) {
    return (
      <Frame onBack={onBack}>
        <p className="text-xl">Ese trabajo ya no está.</p>
      </Frame>
    );
  }

  return (
    <Frame onBack={onBack}>
      <h1 className="font-display text-4xl leading-none">Cambiar {job.number}</h1>
      <div className="mt-8 flex flex-col gap-4">
        <Field label="Nombre" value={name} onChange={setName} />
        <Field label="Teléfono" value={phone} inputMode="tel" onChange={setPhone} />
        <Stepper value={quantity} onChange={setQuantity} />
        <div className="flex flex-wrap gap-2">
          {DUE.map((choice) => (
            <Chip key={choice.id} selected={dueChoice === choice.id} onClick={() => setDueChoice(choice.id)}>
              {choice.label}
            </Chip>
          ))}
        </div>
        {dueChoice === "fecha" ? <Field label="Fecha" type="date" value={dueDate} onChange={setDueDate} /> : null}
        <Field label="Precio" value={price} inputMode="decimal" onChange={setPrice} />
        <Field label="Ya pagó" value={paid} inputMode="decimal" onChange={setPaid} />
        <label className="block">
          <span className="mb-2 block text-base text-muted">Nota</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-24 w-full rounded-lg border border-line bg-card px-4 py-3 text-lg"
          />
        </label>
        <Primary
          onClick={() => {
            if (name.trim().length < 2) return;
            updateCustomer(customer.id, { name, phone });
            updateJob(job.id, {
              quantity,
              due: dueFromChoice(dueChoice, dueDate),
              notes,
              price: parseMoney(price),
              paid: parseMoney(paid),
            });
            onBack();
          }}
        >
          Guardar cambios
        </Primary>
      </div>
    </Frame>
  );
}
