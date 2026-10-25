export type GoodCategory = "Escritura" | "Papel y archivo" | "Útiles" | "Servicios rápidos" | "Otros";
// stock = cuántos hay (si no existe, el artículo no se controla). min = avisar cuando queden esos o menos.
// review = una venta pidió más de lo que había: se dejó en 0 y conviene contar.
export type Good = {
  id: string;
  name: string;
  price: number;
  hidden: boolean;
  category?: GoodCategory;
  stock?: number;
  min?: number;
  review?: boolean;
};
// Los artículos inician sin precio: el negocio lo captura una sola vez.
// Los IDs anteriores permanecen para conservar los datos existentes.
const items: [string, string, GoodCategory][] = [
  ["pluma", "Bolígrafo", "Escritura"],
  ["pluma-azul", "Bolígrafo azul", "Escritura"],
  ["pluma-negra", "Bolígrafo negro", "Escritura"],
  ["pluma-roja", "Bolígrafo rojo", "Escritura"],
  ["lapiz", "Lápiz", "Escritura"],
  ["goma", "Goma de borrar", "Escritura"],
  ["sacapuntas", "Sacapuntas", "Escritura"],
  ["corrector", "Corrector", "Escritura"],
  ["marcador", "Marcador permanente", "Escritura"],
  ["marcatextos", "Marcatextos", "Escritura"],
  ["resma-carta", "Resma carta", "Papel y archivo"],
  ["resma-oficio", "Resma oficio", "Papel y archivo"],
  ["hoja-carta", "Hoja blanca carta", "Papel y archivo"],
  ["hoja-color", "Hoja de color", "Papel y archivo"],
  ["folder", "Folder carta", "Papel y archivo"],
  ["folder-oficio", "Folder oficio", "Papel y archivo"],
  ["sobre-oficio", "Sobre oficio", "Papel y archivo"],
  ["sobre-manila", "Sobre manila", "Papel y archivo"],
  ["block", "Block rayado", "Papel y archivo"],
  ["cuaderno", "Cuaderno profesional", "Papel y archivo"],
  ["libreta", "Libreta", "Papel y archivo"],
  ["cartulina", "Cartulina", "Papel y archivo"],
  ["notas", "Notas adhesivas", "Papel y archivo"],
  ["cinta", "Cinta adhesiva", "Útiles"],
  ["pegamento-barra", "Pegamento en barra", "Útiles"],
  ["pegamento-liquido", "Pegamento líquido", "Útiles"],
  ["tijeras", "Tijeras", "Útiles"],
  ["regla", "Regla 30 cm", "Útiles"],
  ["clips", "Caja de clips", "Útiles"],
  ["engrapas", "Engrapas", "Útiles"],
  ["engrapadora", "Engrapadora", "Útiles"],
  ["copia-bn", "Copia blanco y negro", "Servicios rápidos"],
  ["copia-color", "Copia a color", "Servicios rápidos"],
  ["impresion-bn", "Impresión blanco y negro", "Servicios rápidos"],
  ["impresion-color", "Impresión a color", "Servicios rápidos"],
  ["enmicado", "Enmicado", "Servicios rápidos"],
  ["engargolado", "Engargolado", "Servicios rápidos"],
];
export const SEED_GOODS: Good[] = items.map(([id, name, category]) => ({id, name, category, price: 0, hidden: false}));
