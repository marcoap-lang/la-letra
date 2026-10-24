export type Good = {
  id: string;
  name: string;
  price: number;
  hidden: boolean;
};

export const SEED_GOODS: Good[] = [
  { id: "resma-carta", name: "Resma carta", price: 189, hidden: false },
  { id: "resma-oficio", name: "Resma oficio", price: 219, hidden: false },
  { id: "folder", name: "Folder carta", price: 12, hidden: false },
  { id: "sobre-oficio", name: "Sobre oficio", price: 4, hidden: false },
  { id: "sobre-manila", name: "Sobre manila", price: 6, hidden: false },
  { id: "pluma", name: "Pluma", price: 15, hidden: false },
  { id: "lapiz", name: "Lápiz", price: 8, hidden: false },
  { id: "corrector", name: "Corrector", price: 28, hidden: false },
  { id: "cinta", name: "Cinta adhesiva", price: 35, hidden: false },
  { id: "block", name: "Block rayado", price: 42, hidden: false },
  { id: "cartulina", name: "Cartulina", price: 18, hidden: false },
  { id: "notas", name: "Notas adhesivas", price: 32, hidden: false },
  { id: "clips", name: "Caja de clips", price: 29, hidden: false },
  { id: "engrapas", name: "Engrapas", price: 22, hidden: false },
];
