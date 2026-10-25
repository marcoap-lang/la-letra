import type { DueChoice } from "@/lib/shop/format";

export type Screen =
  | { name: "home" }
  | { name: "orden" }
  | { name: "trabajo"; jobId: string }
  | { name: "editar"; jobId: string }
  | { name: "cobrar"; customerId?: string; saleId?: string }
  | { name: "repetir" }
  | { name: "tipos" }
  | { name: "papeleria" }
  | { name: "inventario"; tab?: "papeleria" | "insumos" }
  | { name: "venta"; saleId: string }
  | { name: "clientes" }
  | { name: "cliente"; customerId: string }
  | { name: "ligar"; typeId: string }
  | { name: "elegirServicio"; supplyId: string };

export type Draft = {
  customerId: string | null;
  name: string;
  phone: string;
  typeId: string | null;
  drawerId: string | null;
  quantity: number;
  dueChoice: DueChoice;
  dueDate: string;
  notes: string;
  price: string;
  paid: string;
};

export function emptyDraft(): Draft {
  return {
    customerId: null,
    name: "",
    phone: "",
    typeId: null,
    drawerId: null,
    quantity: 1,
    dueChoice: "hoy",
    dueDate: "",
    notes: "",
    price: "",
    paid: "",
  };
}
