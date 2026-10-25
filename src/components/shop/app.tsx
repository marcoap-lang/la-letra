import { useEffect, useState } from "react";
import { dueFromChoice, parseMoney } from "@/lib/shop/format";
import { useShop, type Job } from "@/lib/shop/store";
import { Home } from "./home";
import { Editar, Trabajo } from "./job";
import { Cobrar, Repetir } from "./lists";
import { emptyDraft, type Draft, type Screen } from "./nav";
import { Orden } from "./orden";
import { Tipos } from "./tipos";
import { Papeleria } from "./papeleria";
import { Inventario } from "./inventario";
import { ElegirServicio, Ligar } from "./ligar";

export function ShopApp() {
  const [stack, setStack] = useState<Screen[]>([{ name: "home" }]);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [notice, setNotice] = useState<string | null>(null);
  const saveJob = useShop((s) => s.saveJob);
  const setStatus = useShop((s) => s.setStatus);
  const setTypeUses = useShop((s) => s.setTypeUses);

  useEffect(() => {
    void Promise.resolve(useShop.persist.rehydrate());
  }, []);

  const screen = stack[stack.length - 1] ?? { name: "home" };
  const go = (next: Screen) => setStack((current) => [...current, next]);
  const replace = (next: Screen) => setStack((current) => [...current.slice(0, -1), next]);
  const back = () => setStack((current) => (current.length > 1 ? current.slice(0, -1) : current));
  const home = () => {
    setDraft(emptyDraft());
    setNotice(null);
    setStack([{ name: "home" }]);
  };
  const patch = (partial: Partial<Draft>) => setDraft((current) => ({ ...current, ...partial }));

  function startNew() {
    setDraft(emptyDraft());
    setNotice(null);
    go({ name: "orden" });
  }

  function advance(job: Job) {
    if (job.needsProof && job.status === "nuevo") setStatus(job.id, "aprobado");
    else setStatus(job.id, "listo");
  }

  if (screen.name === "home") {
    return (
      <Home
        onNew={startNew}
        onSell={() => go({ name: "papeleria" })}
        onOpen={(jobId) => go({ name: "trabajo", jobId })}
        onRepeat={() => go({ name: "repetir" })}
        onTypes={() => go({ name: "tipos" })}
        onInventory={(tab) => go({ name: "inventario", tab })}
        onAdvance={advance}
        onDeliver={(jobId) => setStatus(jobId, "entregado")}
        onCharge={(customerId) => go({ name: "cobrar", customerId })}
        onChargeSale={(saleId) => go({ name: "cobrar", saleId })}
      />
    );
  }
  if (screen.name === "orden") {
    return (
      <Orden
        draft={draft}
        patch={patch}
        notice={notice}
        onBack={home}
        onSave={() => {
          if (!draft.typeId || draft.name.trim().length < 2) return;
          const jobId = saveJob({
            customerId: draft.customerId,
            name: draft.name,
            phone: draft.phone,
            typeId: draft.typeId,
            quantity: draft.quantity,
            due: dueFromChoice(draft.dueChoice, draft.dueDate),
            notes: draft.notes,
            price: parseMoney(draft.price),
            paid: parseMoney(draft.paid),
          });
          setDraft(emptyDraft());
          setNotice(null);
          setStack([{ name: "home" }, { name: "trabajo", jobId }]);
        }}
      />
    );
  }
  if (screen.name === "trabajo") {
    return (
      <Trabajo
        jobId={screen.jobId}
        onBack={back}
        onEdit={() => go({ name: "editar", jobId: screen.jobId })}
        onCharge={(customerId) => go({ name: "cobrar", customerId })}
      />
    );
  }
  if (screen.name === "editar") return <Editar jobId={screen.jobId} onBack={back} />;
  if (screen.name === "cobrar") {
    return (
      <Cobrar
        customerId={screen.customerId}
        saleId={screen.saleId}
        onBack={back}
        onPick={(token) => {
          if (token.startsWith("sale:")) go({ name: "cobrar", saleId: token.slice("sale:".length) });
          else go({ name: "cobrar", customerId: token });
        }}
        onOpen={(jobId) => go({ name: "trabajo", jobId })}
      />
    );
  }
  if (screen.name === "repetir") {
    return (
      <Repetir
        onBack={back}
        onUse={(next, who) => {
          setDraft(next);
          setNotice(`Repitiendo el pedido de ${who}. Cambie la fecha o el precio si hace falta, y guarde.`);
          go({ name: "orden" });
        }}
      />
    );
  }
  if (screen.name === "papeleria") return <Papeleria onBack={back} onSaved={home} />;
  if (screen.name === "inventario") {
    return (
      <Inventario
        initialTab={screen.tab}
        onBack={back}
        onLinkSupply={(supplyId) => go({ name: "elegirServicio", supplyId })}
      />
    );
  }
  if (screen.name === "elegirServicio") {
    return (
      <ElegirServicio
        supplyId={screen.supplyId}
        onBack={back}
        onPick={(typeId) => {
          // Deja la liga lista (1 por pieza) y abre la pantalla para ajustarla.
          const type = useShop.getState().types.find((item) => item.id === typeId);
          const uses = type?.uses ?? [];
          if (!uses.some((use) => use.supplyId === screen.supplyId)) {
            setTypeUses(typeId, [...uses, { supplyId: screen.supplyId, per: 1, by: "pieza" }]);
          }
          replace({ name: "ligar", typeId });
        }}
      />
    );
  }
  if (screen.name === "ligar") return <Ligar typeId={screen.typeId} onBack={back} />;
  return <Tipos onBack={back} onLink={(typeId) => go({ name: "ligar", typeId })} />;
}
