export type Drawer = { id: string; name: string };

export type JobType = {
  id: string;
  drawerId: string;
  name: string;
  needsProof: boolean;
  hidden: boolean;
};

export const SEED_DRAWERS: Drawer[] = [
  { id: "sellos", name: "Sellos" },
  { id: "talonarios", name: "Talonarios" },
  { id: "invitaciones", name: "Invitaciones" },
  { id: "empresa", name: "Papelería de empresa" },
  { id: "mostrador", name: "Mostrador" },
  { id: "encargos", name: "Encargos" },
];

function slug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function t(drawerId: string, name: string, needsProof: boolean): JobType {
  return {
    id: `${drawerId}-${slug(name)}`,
    drawerId,
    name,
    needsProof,
    hidden: false,
  };
}

export const SEED_TYPES: JobType[] = [
  t("sellos", "Sello automático", true),
  t("sellos", "Sello de madera", true),
  t("sellos", "Fechador", true),
  t("sellos", "Sello seco", true),
  t("sellos", "Sello lineal", true),
  t("sellos", "Sello de ropa", true),

  t("talonarios", "Facturas", true),
  t("talonarios", "Notas de venta", true),
  t("talonarios", "Remisiones", true),
  t("talonarios", "Recibos", true),
  t("talonarios", "Boletos", true),

  t("invitaciones", "XV años", true),
  t("invitaciones", "Boda", true),
  t("invitaciones", "Bautizo", true),
  t("invitaciones", "Primera comunión", true),
  t("invitaciones", "Presentación", true),
  t("invitaciones", "Confirmación", true),
  t("invitaciones", "Graduación", true),
  t("invitaciones", "Recordatorio de misa", true),

  t("empresa", "Tarjetas de presentación", true),
  t("empresa", "Hojas membretadas", true),
  t("empresa", "Sobres", true),
  t("empresa", "Folders", true),
  t("empresa", "Volantes", true),
  t("empresa", "Dípticos", true),
  t("empresa", "Trípticos", true),
  t("empresa", "Carteles", true),
  t("empresa", "Etiquetas", true),
  t("empresa", "Recetarios", true),
  t("empresa", "Credenciales", true),
  t("empresa", "Diplomas y reconocimientos", true),
  t("empresa", "Calendarios", true),

  t("mostrador", "Copias", false),
  t("mostrador", "Impresiones a color", false),
  t("mostrador", "Impresiones en blanco y negro", false),
  t("mostrador", "Escaneo", false),
  t("mostrador", "Enmicado", false),
  t("mostrador", "Engargolado", false),
  t("mostrador", "Encuadernado", false),

  t("encargos", "Lonas", true),
  t("encargos", "Vinil", true),
  t("encargos", "Letreros", true),
  t("encargos", "Playeras", true),
  t("encargos", "Tazas", true),
  t("encargos", "Plumas y promocionales", true),
  t("encargos", "Diseño", true),
];
