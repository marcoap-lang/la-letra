import { useState } from "react";
import { useShop } from "@/lib/shop/store";
import { Field, Frame, Primary, Quiet } from "./ui";

export function Tipos({ onBack }: { onBack: () => void }) {
  const drawers = useShop((s) => s.drawers);
  const types = useShop((s) => s.types);
  const addDrawer = useShop((s) => s.addDrawer);
  const addType = useShop((s) => s.addType);
  const setTypeHidden = useShop((s) => s.setTypeHidden);
  const [open, setOpen] = useState(drawers[0]?.id ?? "");
  const [drawerName, setDrawerName] = useState("");
  const [addingIn, setAddingIn] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [proof, setProof] = useState(true);

  return (
    <Frame onBack={onBack}>
      <h1 className="font-display text-5xl leading-none">Qué se hace</h1>
      <p className="mt-3 max-w-lg text-lg text-muted">
        Esto es el catálogo de la orden. Oculte lo que no maneja, o agregue lo que falte.
      </p>
      <div className="mt-8 flex flex-col">
        {drawers.map((drawer) => {
          const items = types.filter((type) => type.drawerId === drawer.id);
          const opened = open === drawer.id;
          return (
            <section key={drawer.id} className="border-t border-line py-4">
              <button type="button" onClick={() => setOpen(opened ? "" : drawer.id)} className="flex w-full items-baseline justify-between text-left">
                <span className="text-2xl font-medium">{drawer.name}</span>
                <span className="text-base text-muted">{opened ? "Cerrar" : "Ver"}</span>
              </button>
              {opened ? (
                <ul className="mt-4 flex flex-col gap-3">
                  {items.map((type) => (
                    <li key={type.id} className="flex items-center justify-between gap-3">
                      <span className={type.hidden ? "text-muted" : "text-lg"}>
                        {type.name}
                        {type.hidden ? " · oculto" : ""}
                      </span>
                      <Quiet onClick={() => setTypeHidden(type.id, !type.hidden)}>{type.hidden ? "Mostrar" : "Ocultar"}</Quiet>
                    </li>
                  ))}
                  {addingIn === drawer.id ? (
                    <div className="flex flex-col gap-3 pt-2">
                      <Field label="Trabajo nuevo" value={newName} onChange={setNewName} />
                      <div className="flex flex-wrap gap-2">
                        <Quiet onClick={() => setProof(true)}>Primero el arte</Quiet>
                        <Quiet onClick={() => setProof(false)}>De una vez</Quiet>
                      </div>
                      <Primary
                        onClick={() => {
                          if (newName.trim().length < 2) return;
                          addType({ drawerId: drawer.id, name: newName, needsProof: proof });
                          setNewName("");
                          setAddingIn(null);
                        }}
                      >
                        Agregar
                      </Primary>
                    </div>
                  ) : (
                    <Quiet
                      onClick={() => {
                        setAddingIn(drawer.id);
                        setProof(drawer.id !== "mostrador");
                      }}
                    >
                      Agregar en {drawer.name}
                    </Quiet>
                  )}
                </ul>
              ) : null}
            </section>
          );
        })}
      </div>
      <div className="mt-6 flex flex-col gap-3 border-t border-ink pt-6">
        <Field label="Cajón nuevo" value={drawerName} onChange={setDrawerName} placeholder="Por ejemplo, Fotografía" />
        <Primary
          onClick={() => {
            if (drawerName.trim().length < 2) return;
            const id = addDrawer(drawerName);
            setDrawerName("");
            setOpen(id);
          }}
        >
          Agregar cajón
        </Primary>
      </div>
    </Frame>
  );
}
