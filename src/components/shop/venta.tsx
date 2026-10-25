import { useState } from "react";
import { saleReturns, qtyText } from "@/lib/shop/inventory";
import { formatDay, formatMoney } from "@/lib/shop/format";
import { saleBalance, useShop } from "@/lib/shop/store";
import { Frame, Primary, Quiet } from "./ui";

export function Venta({
  saleId,
  onBack,
  onCharge,
}: {
  saleId: string;
  onBack: () => void;
  onCharge: (saleId: string) => void;
}) {
  const sale = useShop((s) => s.sales.find((item) => item.id === saleId));
  const goods = useShop((s) => s.goods);
  const moves = useShop((s) => s.moves);
  const deleteSale = useShop((s) => s.deleteSale);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removed, setRemoved] = useState<number | null>(null);

  if (removed !== null) {
    return (
      <Frame onBack={onBack} backLabel="Volver">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Listo</h1>
        <p className="mt-4 text-2xl">Se borró la venta {removed}.</p>
        <div className="mt-8">
          <Primary onClick={onBack}>Volver</Primary>
        </div>
      </Frame>
    );
  }

  if (!sale) {
    return (
      <Frame onBack={onBack} backLabel="Volver">
        <p className="text-xl">Esa venta ya no está.</p>
      </Frame>
    );
  }

  const left = saleBalance(sale);
  // Solo se avisa de lo que de verdad volvería al inventario (artículos que se están contando).
  const back = saleReturns(sale, moves)
    .map((r) => {
      const good = goods.find((item) => item.id === r.goodId);
      return good && good.stock !== undefined ? `${qtyText(r.qty, "")} ${good.name}` : "";
    })
    .filter(Boolean);

  return (
    <Frame onBack={onBack} backLabel="Volver">
      <p className="text-sm text-muted">Venta de papelería</p>
      <div className="mt-1 flex items-end justify-between gap-4">
        <h1 className="font-display text-6xl leading-none tabular-nums">{sale.number}</h1>
        <p className="pb-1 text-lg text-muted">{formatDay(sale.createdAt.slice(0, 10))}</p>
      </div>

      <dl className="mt-8 grid gap-x-8 gap-y-4 border-t border-ink pt-6 sm:grid-cols-2">
        <Row k="Cliente" v={sale.customerName} />
        <Row k="Total" v={formatMoney(sale.total)} />
        <Row k="Pagado" v={formatMoney(sale.paid)} />
        <Row k="Saldo" v={left > 0 ? formatMoney(left) : "Pagado"} accent={left > 0} />
      </dl>

      <h2 className="mt-8 text-2xl font-extrabold tracking-tight">Lo que se vendió</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {sale.lines.map((line, index) => (
          <li
            key={`${line.goodId}-${index}`}
            className="flex items-center justify-between gap-3 rounded-2xl border border-line/80 bg-card px-4 py-3 shadow-ticket"
          >
            <span className="min-w-0 text-lg font-semibold">
              {line.qty} {line.name}
            </span>
            <span className="shrink-0 text-base tabular-nums text-muted">{formatMoney(line.qty * line.price)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col items-start gap-3">
        {left > 0 ? <Primary tone="stamp" onClick={() => onCharge(sale.id)}>Cobrar</Primary> : null}
        {confirmDelete ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-card p-4">
            <p className="w-full text-lg font-semibold">
              ¿Seguro? Se quita del registro{back.length > 0 ? " y se devuelve la papelería al inventario" : ""}.
            </p>
            {back.length > 0 ? <p className="w-full text-base text-muted">Se devolverá: {back.join(", ")}.</p> : null}
            <Primary
              tone="stamp"
              onClick={() => {
                const number = sale.number;
                if (deleteSale(sale.id)) setRemoved(number);
              }}
            >
              Sí, borrar
            </Primary>
            <Quiet onClick={() => setConfirmDelete(false)}>No</Quiet>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="min-h-11 text-base text-stamp">
            Borrar esta venta
          </button>
        )}
      </div>
    </Frame>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div>
      <dt className="text-sm text-muted">{k}</dt>
      <dd className={`text-xl ${accent ? "font-medium text-stamp" : ""}`}>{v}</dd>
    </div>
  );
}
