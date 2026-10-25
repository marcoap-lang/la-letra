import { useState } from "react";
import { dueFromChoice, formatDay, formatMoney, norm, parseMoney, type DueChoice } from "@/lib/shop/format";
import { useShop } from "@/lib/shop/store";
import type { Draft } from "./nav";
import { Chip, Field, Frame, Primary, Quiet, Section, Stepper } from "./ui";

const DUE: { id: DueChoice; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "manana", label: "Mañana" },
  { id: "tres", label: "En 3 días" },
  { id: "semana", label: "La otra semana" },
  { id: "fecha", label: "Otra fecha" },
];

const HINTS: Record<string, string> = {
  sellos: "Automáticos, madera, fechador",
  talonarios: "Facturas, notas, recibos",
  invitaciones: "XV, boda, bautizo, misa",
  empresa: "Tarjetas, volantes, membretadas",
  mostrador: "Copias, enmicado, engargolado",
  encargos: "Lonas, playeras, tazas",
};

export function Orden({
  draft,
  patch,
  notice,
  onBack,
  onSave,
}: {
  draft: Draft;
  patch: (partial: Partial<Draft>) => void;
  notice?: string | null;
  onBack: () => void;
  onSave: () => void;
}) {
  const customers = useShop((s) => s.customers);
  const jobs = useShop((s) => s.jobs);
  const drawers = useShop((s) => s.drawers);
  const types = useShop((s) => s.types);
  const addType = useShop((s) => s.addType);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [proof, setProof] = useState(true);
  const [error, setError] = useState("");

  const query = norm(draft.name);
  const matches = query
    ? customers.filter((customer) => norm(customer.name).includes(query)).slice(0, 4)
    : recent(customers, jobs);
  const chosen = types.find((type) => type.id === draft.typeId);
  const drawer = drawers.find((item) => item.id === draft.drawerId);
  const visible = types.filter((type) => type.drawerId === draft.drawerId && !type.hidden);
  const price = parseMoney(draft.price);
  const paid = Math.min(parseMoney(draft.paid), price);
  const left = Math.max(0, price - paid);
  const due = dueFromChoice(draft.dueChoice, draft.dueDate);
  const missing = !draft.name.trim() ? "Falta el nombre" : !draft.typeId ? "Falta elegir el trabajo" : "";

  return (
    <Frame
      onBack={onBack}
      action={
        <Primary
          tone="stamp"
          onClick={() => {
            if (missing) {
              setError(missing);
              return;
            }
            onSave();
          }}
        >
          Guardar
        </Primary>
      }
    >
      <p className="text-3xl font-extrabold tracking-tight sm:text-4xl">Nuevo trabajo de imprenta</p>
      <p className="mt-3 max-w-lg text-lg text-muted">
        Capture lo que necesita el cliente. Al guardar aparecerá en trabajos pendientes.
      </p>
      {notice ? <p className="mt-4 rounded-lg bg-card px-4 py-3 text-base">{notice}</p> : null}

      <div className="mt-8 flex flex-col gap-8">
        <Section n="1" title="Datos del cliente" hint="Si ya es cliente, selecciónelo de la lista.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Nombre"
              value={draft.name}
              placeholder="Nombre del cliente"
              onChange={(name) => {
                setError("");
                patch({ name, customerId: null });
              }}
            />
            <Field
              label="Teléfono"
              value={draft.phone}
              inputMode="tel"
              placeholder="Si lo tiene"
              onChange={(phone) => patch({ phone })}
            />
          </div>
          {matches.length > 0 && !draft.customerId ? (
            <div className="flex flex-wrap gap-2">
              {matches.map((customer) => (
                <Chip
                  key={customer.id}
                  onClick={() => patch({ customerId: customer.id, name: customer.name, phone: customer.phone })}
                >
                  {customer.name}
                </Chip>
              ))}
            </div>
          ) : null}
        </Section>

        <Section n="2" title="Servicio solicitado" hint="Elija un grupo y después el trabajo.">
          {chosen ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-2xl font-medium">{chosen.name}</p>
              <Quiet
                onClick={() => {
                  patch({ typeId: null, drawerId: chosen.drawerId });
                }}
              >
                Cambiar
              </Quiet>
            </div>
          ) : !drawer ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {drawers.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setError("");
                    patch({ drawerId: item.id });
                    setProof(item.id !== "mostrador");
                  }}
                  className="rounded-3xl border border-line/80 bg-card shadow-ticket p-4 text-left"
                >
                  <span className="block text-xl font-medium">{item.name}</span>
                  <span className="mt-1 block text-base text-muted">{HINTS[item.id] ?? "Trabajos de este cajón"}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {visible.map((type) => (
                  <Chip key={type.id} onClick={() => patch({ typeId: type.id })}>
                    {type.name}
                  </Chip>
                ))}
              </div>
              {adding ? (
                <div className="flex flex-col gap-3 rounded-3xl border border-line/80 bg-card shadow-ticket p-4">
                  <Field label="Nombre del trabajo nuevo" value={newName} onChange={setNewName} />
                  <div className="flex flex-wrap gap-2">
                    <Chip selected={proof} onClick={() => setProof(true)}>
                      Primero el arte
                    </Chip>
                    <Chip selected={!proof} onClick={() => setProof(false)}>
                      Se hace de una vez
                    </Chip>
                  </div>
                  <Primary
                    onClick={() => {
                      if (newName.trim().length < 2) return;
                      const typeId = addType({ drawerId: drawer.id, name: newName, needsProof: proof });
                      patch({ typeId });
                      setAdding(false);
                      setNewName("");
                    }}
                  >
                    Usar este
                  </Primary>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Quiet onClick={() => setAdding(true)}>Agregar otro</Quiet>
                  <Quiet onClick={() => patch({ drawerId: null })}>Otro cajón</Quiet>
                </div>
              )}
            </div>
          )}
        </Section>

        <Section n="3" title="Fecha de entrega y cobro" hint="Puede anotar el anticipo y dejar el saldo pendiente.">
          <div>
            <p className="mb-2 text-base text-muted">Cantidad</p>
            <Stepper value={draft.quantity} onChange={(quantity) => patch({ quantity })} />
          </div>
          <div className="flex flex-wrap gap-2">
            {DUE.map((choice) => (
              <Chip
                key={choice.id}
                selected={draft.dueChoice === choice.id}
                onClick={() => patch({ dueChoice: choice.id })}
              >
                {choice.label}
              </Chip>
            ))}
          </div>
          {draft.dueChoice === "fecha" ? (
            <Field label="Fecha" type="date" value={draft.dueDate} onChange={(dueDate) => patch({ dueDate })} />
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Precio total" value={draft.price} inputMode="decimal" placeholder="0" onChange={(price) => patch({ price })} />
            <Field label="Anticipo recibido" value={draft.paid} inputMode="decimal" placeholder="0" onChange={(paid) => patch({ paid })} />
          </div>
          <Quiet onClick={() => patch({ paid: draft.price || "0" })}>Marcar como pagado</Quiet>
          <label className="block">
            <span className="mb-2 block text-base text-muted">Nota</span>
            <textarea
              value={draft.notes}
              onChange={(event) => patch({ notes: event.target.value })}
              placeholder="Texto del sello, papel, copias…"
              className="min-h-24 w-full rounded-lg border border-line bg-card px-4 py-3 text-lg"
            />
          </label>
        </Section>
      </div>

      <div className="mt-8 border-t border-line py-4">
        <p className="mb-3 text-base text-muted">
          {draft.name || "Sin nombre"}
          {chosen ? ` · ${chosen.name}` : ""}
          {` · ${formatDay(due)}`}
          {price > 0 ? ` · ${left > 0 ? `debe ${formatMoney(left)}` : "pagado"}` : ""}
        </p>
        {error ? <p className="mb-3 text-base font-medium text-stamp">{error}</p> : null}
        <Primary
          tone="stamp"
          onClick={() => {
            if (missing) {
              setError(missing);
              return;
            }
            onSave();
          }}
        >
          {missing || "Guardar trabajo"}
        </Primary>
      </div>
    </Frame>
  );
}

function recent(
  customers: { id: string; name: string; phone: string }[],
  jobs: { customerId: string; createdAt: string }[],
) {
  const ordered = [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const seen = new Set<string>();
  const out = [];
  for (const job of ordered) {
    if (seen.has(job.customerId)) continue;
    seen.add(job.customerId);
    const customer = customers.find((item) => item.id === job.customerId);
    if (customer) out.push(customer);
    if (out.length >= 5) break;
  }
  return out;
}
