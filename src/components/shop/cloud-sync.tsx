import { useCallback, useEffect, useRef, useState } from "react";
import { doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { signOut, type User } from "firebase/auth";
import { AlertTriangle, Cloud, CloudUpload, Download, LockKeyhole, LogOut, X } from "lucide-react";
import { auth, db, SHOP_COLLECTION, SHOP_DOC_ID } from "@/lib/firebase/client";
import { downloadSnapshot, parseSnapshot, toSnapshot, useShop, type Snapshot } from "@/lib/shop/store";
import { useSyncStatus } from "@/lib/shop/sync-status";

type Mode = "checking" | "ready" | "saving" | "offline" | "conflict" | "denied";
type Remote = { revision: number; snapshot: Snapshot | null };

const REVISION_KEY = "la-letra-cloud-revision";
const DIRTY_KEY = "la-letra-cloud-dirty";
const MAX_BYTES = 900_000; // Firestore limita cada documento a 1 MiB.
const shopRef = () => doc(db, SHOP_COLLECTION, SHOP_DOC_ID);

class ConflictError extends Error {}
class TooBigError extends Error {}

function hasTransactions(s: Snapshot): boolean {
  return s.jobs.length > 0 || (s.sales?.length ?? 0) > 0 || s.customers.length > 0 || (s.goods ?? []).some((g) => g.price > 0);
}
function readRevision(): number {
  const n = Number(localStorage.getItem(REVISION_KEY));
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}
function setRevision(n: number) {
  localStorage.setItem(REVISION_KEY, String(n));
}

export function CloudSync({ user }: { user: User }) {
  const [mode, setMode] = useState<Mode>("checking");
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState("");
  const [remote, setRemote] = useState<Remote | null>(null);
  const modeRef = useRef<Mode>("checking");
  const revision = useRef(0);
  const dirty = useRef(false);
  const writing = useRef(false);
  const applying = useRef(false);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const changeMode = (m: Mode) => { modeRef.current = m; setMode(m); useSyncStatus.setState({ mode: m }); };
  const markDirty = (v: boolean) => {
    dirty.current = v;
    useSyncStatus.setState({ dirty: v });
    if (v) localStorage.setItem(DIRTY_KEY, "1"); else localStorage.removeItem(DIRTY_KEY);
  };

  const importRemote = useCallback((data: Remote, backupLocal = false) => {
    const parsed = parseSnapshot(data.snapshot);
    if (!parsed) return;
    const local = toSnapshot(useShop.getState());
    if (backupLocal && hasTransactions(local)) downloadSnapshot(local);
    applying.current = true;
    useShop.getState().replaceAll(parsed);
    applying.current = false;
    revision.current = data.revision;
    setRevision(data.revision);
    markDirty(false);
    generation.current += 1;
    setRemote(data);
    setMessage("Datos al día con la nube.");
    changeMode("ready");
  }, []);

  const upload = useCallback(async () => {
    if (writing.current || !dirty.current) return;
    if (modeRef.current === "conflict" || modeRef.current === "denied" || modeRef.current === "checking") return;
    writing.current = true;
    const started = generation.current;
    changeMode("saving");
    try {
      const snap = JSON.parse(JSON.stringify(toSnapshot(useShop.getState()))) as Snapshot;
      if (JSON.stringify(snap).length > MAX_BYTES) throw new TooBigError();
      const expected = revision.current;
      const next = await runTransaction(db, async (tx) => {
        const current = await tx.get(shopRef());
        const currentRev = current.exists() ? Number(current.data().revision) || 0 : 0;
        if (currentRev !== expected) throw new ConflictError();
        tx.set(shopRef(), {
          revision: currentRev + 1,
          updatedAt: serverTimestamp(),
          updatedBy: (user.email ?? "").toLowerCase(),
          snapshot: snap,
        });
        return currentRev + 1;
      });
      revision.current = next;
      setRevision(next);
      markDirty(generation.current !== started);
      setMessage("Guardado en la nube.");
      changeMode("ready");
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      if (err instanceof ConflictError) {
        changeMode("conflict");
        setMessage("Otro equipo guardó datos más recientes. No se sobrescribió nada.");
      } else if (err instanceof TooBigError) {
        changeMode("offline");
        setMessage("Los datos ya son muy grandes para un solo documento. Avise a soporte.");
      } else if (code === "permission-denied") {
        changeMode("denied");
        setMessage("Esta cuenta no tiene permiso para guardar. Los datos siguen en este equipo.");
      } else {
        changeMode("offline");
        setMessage("Sin conexión. Los datos siguen en este equipo y se subirán solos.");
      }
    } finally {
      writing.current = false;
    }
  }, [user]);

  // Arranque + escucha en tiempo real del documento del negocio.
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let alive = true;
    void (async () => {
      await useShop.persist.rehydrate();
      if (!alive) return;
      revision.current = readRevision();
      dirty.current = localStorage.getItem(DIRTY_KEY) === "1";
      useSyncStatus.setState({ dirty: dirty.current });
      unsub = onSnapshot(
        shopRef(),
        { includeMetadataChanges: false },
        (snap) => {
          if (snap.metadata.fromCache && !snap.exists()) return; // aún sin servidor
          const data = snap.data();
          const rev = snap.exists() ? Number(data?.revision) || 0 : 0;
          const incoming: Remote = { revision: rev, snapshot: snap.exists() ? (data?.snapshot as Snapshot) : null };
          setRemote(incoming);
          if (rev === revision.current) {
            if (modeRef.current === "checking" || modeRef.current === "offline") {
              changeMode("ready");
              setMessage("Su información está protegida en la nube.");
            }
            if (dirty.current) void upload();
            return;
          }
          if (rev === 0) { // nube vacía: se sube lo de este equipo cuando haya algo
            revision.current = 0;
            if (hasTransactions(toSnapshot(useShop.getState()))) markDirty(true);
            changeMode("ready");
            setMessage("Nube lista. Los datos de este equipo se guardarán aquí.");
            if (dirty.current) void upload();
            return;
          }
          if (rev < revision.current || writing.current) return;
          const local = toSnapshot(useShop.getState());
          if (!dirty.current && (revision.current > 0 || !hasTransactions(local))) {
            importRemote(incoming);
            return;
          }
          changeMode("conflict");
          setMessage("Hay datos distintos en este equipo y en la nube. Revise antes de reemplazar.");
        },
        (err) => {
          if ((err as { code?: string }).code === "permission-denied") {
            changeMode("denied");
            setMessage("Esta cuenta no está autorizada. Entre con otra cuenta de Google.");
          } else {
            changeMode("offline");
            setMessage("Sin conexión. Los datos siguen guardados en este equipo.");
          }
        },
      );
    })();
    return () => { alive = false; unsub?.(); };
  }, [importRemote, upload]);

  // Guardado automático al cambiar datos + reintento si falló.
  useEffect(() => {
    const unsubscribe = useShop.subscribe(() => {
      if (applying.current || modeRef.current === "checking" || modeRef.current === "denied") return;
      markDirty(true);
      generation.current += 1;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { void upload(); }, 2500);
    });
    const retry = setInterval(() => {
      if (dirty.current && modeRef.current === "offline") void upload();
    }, 30000);
    const online = () => { if (dirty.current && modeRef.current === "offline") void upload(); };
    window.addEventListener("online", online);
    return () => {
      unsubscribe();
      clearInterval(retry);
      window.removeEventListener("online", online);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [upload]);

  function restore() {
    if (!remote?.snapshot) return;
    if (!window.confirm("¿Recuperar los datos de la nube? Primero se descargará un respaldo de los datos de este equipo para no perderlos.")) return;
    importRemote(remote, true);
  }

  const warn = mode === "conflict" || mode === "offline" || mode === "denied";
  return (
    <div className="no-print fixed bottom-4 right-4 z-40 max-w-[calc(100vw-2rem)]">
      {!expanded ? (
        warn ? (
          <button type="button" onClick={() => setExpanded(true)}
            className="flex min-h-12 items-center gap-2 rounded-2xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 shadow-lift">
            <AlertTriangle size={21}/>
            {mode === "conflict" ? "Revisar datos" : mode === "offline" ? "Sin internet" : "Sin permiso"}
          </button>
        ) : (
          <button type="button" onClick={() => setExpanded(true)} aria-label="Cuenta y nube"
            className="flex size-11 items-center justify-center rounded-full border border-line bg-card/80 text-muted opacity-70 shadow-sm hover:opacity-100">
            <Cloud size={20}/>
          </button>
        )
      ) : (
        <section aria-label="Nube" className="w-[390px] max-w-full rounded-2xl border border-line bg-card p-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><LockKeyhole size={22} className="text-stamp"/><h2 className="text-lg font-extrabold">Datos en la nube</h2></div>
            <button type="button" onClick={() => setExpanded(false)} aria-label="Cerrar" className="rounded-lg p-2 hover:bg-paper"><X size={20}/></button>
          </div>
          <p className="mt-2 text-sm text-muted">{message || "Los datos de este equipo siempre se conservan."}</p>
          <p className="mt-1 text-xs text-muted">Cuenta: {user.email}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => { markDirty(true); void upload(); }} disabled={mode === "conflict" || mode === "denied" || mode === "checking"}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-stamp px-3 text-sm font-bold text-white disabled:opacity-50"><CloudUpload size={18}/> Guardar ahora</button>
            {remote?.snapshot ? (
              <button type="button" onClick={restore}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm font-bold"><Download size={18}/> Recuperar de la nube</button>
            ) : null}
            <button type="button" onClick={() => void signOut(auth)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm font-bold"><LogOut size={18}/> Salir</button>
          </div>
          <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-muted">
            Los datos se guardan en Firebase y se actualizan solos en todos los equipos.
            Si dos equipos cambian algo a la vez, se avisa antes de reemplazar.
          </p>
        </section>
      )}
    </div>
  );
}
