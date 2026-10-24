import { balanceOf, type Customer, type Job } from "./store";
import { formatDay, formatMoney } from "./format";

const SHOP = "Imprenta La Letra";
const WHERE = "5 de Mayo 357, centro de Tuxtepec.";

function piece(job: Job) {
  return job.quantity > 1 ? `${job.typeName}, ${job.quantity} piezas` : job.typeName;
}

export function jobMessage(job: Job, customer: Customer) {
  const saldo = balanceOf(job);
  if (job.status === "listo" || job.status === "entregado") {
    const lines = [
      `Hola ${customer.name}. Le hablamos de ${SHOP}.`,
      `Su trabajo ya está listo: ${piece(job)}.`,
      saldo > 0 ? `Saldo por pagar: ${formatMoney(saldo)}.` : "Ya está pagado.",
      `Lo esperamos en ${WHERE}`,
    ];
    return lines.join("\n");
  }
  const lines = [
    `Hola ${customer.name}. En ${SHOP} anotamos su trabajo: ${piece(job)}.`,
    `Queda para ${formatDay(job.due).toLowerCase()}.`,
  ];
  if (saldo > 0) lines.push(`Saldo: ${formatMoney(saldo)}.`);
  lines.push(WHERE);
  return lines.join("\n");
}
