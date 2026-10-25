import { useState } from "react";
import { Link2 } from "lucide-react";
import { norm } from "@/lib/shop/format";
import { parseQty, qtyText, unitLabel } from "@/lib/shop/inventory";
import { useShop, type SupplyUse } from "@/lib/shop/store";
import { Chip, Field, Frame, Primary, Quiet } from "./ui";
import { NuevoInsumo } from "./inventario";

type Row = { supplyId: string; per: string; by: "pieza" | "trabajo" };

export function Ligar({ typeId, onBack }: { typeId: string; onBack: () => void }) {
  const type = useShop((s) => s.types.find((item) => item.id === typeId));
  const supplies = useShop((s) => s.supplies).filter((item) => !item.hidden);
  const setTypeUses = useShop((s) => s.setTypeUses);
  const addSupply = useShop((s) => s.addSupply);
  const [rows, setRows] = useState<Row[]>(() =>
    (type?.uses ?? []).map((use) => ({ supplyId: use.supplyId, per: String(use.per), by: use.by })),
  );
  const [creating, setCreating] = useState(false);

  if (!type) {
    return (
      <Frame onBack={onBack}>
        <p className="text-xl">Ese servicio ya no está.</p>
      </Frame>
    );
  }

  const free = supplies.filter((item) => !rows.some((row) => row.supplyId === item.id));
  const update = (supplyId: string, patch: Partial<Row>) =>
    setRows((cur) => cur.map((row) => (row.supplyId === supplyId ? { ...row, ...patch } : row)));

  function save() {
    const uses: SupplyUse[] = rows
      .map((row) => ({ supplyId: row.supplyId, per: parseQty(row.per) || 1, by: row.by }))
      .filter((use) => use.per > 0);
    setTypeUses(typeId, uses);
    onBack();
  }

  return (
    <Frame onBack={onBack}>
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-tint text-stamp">
        <Link2 size={26} />
      </div>
      <p className="text-base text-muted">Servicio</p>
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{type.name}</h1>
      <p className="mt-3 max-w-lg text-lg text-muted">
        Elija qué insumos gasta este trabajo. Cada vez que lo anote, se descuenta solo del inventario.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-card/70 px-5 py-6 text-lg">
            Este servicio todavía no gasta ningún insumo.
          </p>
        ) : null}
        {rows.map((row) => {
          const supply = supplies.find((item) => item.id === row.supplyId);
          if (!supply) return null;
          const per = parseQty(row.per) || 1;
          return (
            <section key={row.supplyId} className="rounded-3xl border border-line/80 bg-card p-4 shadow-ticket sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{supply.name}</h2>
                  <p className="text-base text-muted">Hay {qtyText(supply.qty, supply.unit)}</p>
                </div>
                <button type="button" onClick={() => setRows((cur) => cur.filter((item) => item.supplyId !== row.supplyId))} className="min-h-11 px-1 text-base font-semibold text-rose-800">
                  Quitar
                </button>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <Field
                  label={`¿Cuántas ${unitLabel(2, supply.unit)} gasta?`}
                  value={row.per}
                  inputMode="decimal"
                  onChange={(value) => update(row.supplyId, { per: value })}
                />
                <div className="flex flex-wrap gap-2">
                  <Chip selected={row.by === "pieza"} onClick={() => update(row.supplyId, { by: "pieza" })}>
                    Por cada pieza del trabajo
                  </Chip>
                  <Chip selected={row.by === "trabajo"} onClick={() => update(row.supplyId, { by: "trabajo" })}>
                    Una vez por trabajo
                  </Chip>
                </div>
                <p className="rounded-xl bg-tint px-4 py-3 text-base">
                  {row.by === "pieza"
                    ? `Ejemplo: si anota 3 ${type.name.toLowerCase()}, se descuentan ${qtyText(per * 3, supply.unit)}.`
                    : `Sin importar cuántas piezas sean, se descuenta ${qtyText(per, supply.unit)} por trabajo.`}
                </p>
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-6 rounded-3xl border border-line/80 bg-card p-4 shadow-ticket sm:p-5">
        <h2 className="text-xl font-bold">Agregar un insumo a este servicio</h2>
        {free.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {free.map((item) => (
              <Chip key={item.id} onClick={() => setRows((cur) => [...cur, { supplyId: item.id, per: "1", by: "pieza" }])}>
                + {item.name}
              </Chip>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-base text-muted">
            {supplies.length === 0 ? "Todavía no hay insumos. Cree el primero aquí abajo." : "Ya agregó todos los insumos."}
          </p>
        )}
        {creating ? (
          <div className="mt-4">
            <NuevoInsumo
              compact
              onCancel={() => setCreating(false)}
              onCreate={(input) => {
                const id = addSupply(input);
                setRows((cur) => (cur.some((row) => row.supplyId === id) ? cur : [...cur, { supplyId: id, per: "1", by: "pieza" }]));
                setCreating(false);
              }}
            />
          </div>
        ) : (
          <div className="mt-4">
            <Quiet onClick={() => setCreating(true)}>El insumo no está: crear uno nuevo</Quiet>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Primary tone="stamp" onClick={save}>
          Guardar
        </Primary>
        <Quiet onClick={onBack}>Cancelar</Quiet>
      </div>
      <p className="mt-3 text-base text-muted">
        Los trabajos que ya anotó no cambian: esto aplica a los siguientes.
      </p>
    </Frame>
  );
}

export function ElegirServicio({
  supplyId,
  onPick,
  onBack,
}: {
  supplyId: string;
  onPick: (typeId: string) => void;
  onBack: () => void;
}) {
  const supply = useShop((s) => s.supplies.find((item) => item.id === supplyId));
  const drawers = useShop((s) => s.drawers);
  const types = useShop((s) => s.types).filter((type) => !type.hidden);
  const [query, setQuery] = useState("");
  const q = norm(query.trim());
  return (
    <Frame onBack={onBack}>
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">¿Qué servicio gasta esto?</h1>
      <p className="mt-3 max-w-lg text-lg text-muted">
        {supply ? `Elija el servicio que usa «${supply.name}».` : "Elija el servicio."} Puede ligar varios.
      </p>
      <div className="mt-5">
        <Field label="Buscar servicio" value={query} onChange={setQuery} placeholder="Por ejemplo, sello automático" />
      </div>
      <div className="mt-4 flex flex-col gap-5">
        {drawers.map((drawer) => {
          const list = types.filter((type) => type.drawerId === drawer.id && (!q || norm(type.name).includes(q)));
          if (list.length === 0) return null;
          return (
            <section key={drawer.id}>
              <h2 className="mb-2 text-lg font-bold text-muted">{drawer.name}</h2>
              <div className="flex flex-wrap gap-2">
                {list.map((type) => (
                  <Chip key={type.id} selected={!!type.uses?.some((use) => use.supplyId === supplyId)} onClick={() => onPick(type.id)}>
                    {type.name}
                  </Chip>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </Frame>
  );
}
