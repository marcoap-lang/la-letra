import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Cloud, CloudAlert, CloudCheck, CloudUpload, Download, KeyRound, LockKeyhole, RefreshCw, X } from "lucide-react";
import { downloadSnapshot, parseSnapshot, toSnapshot, useShop, type Snapshot } from "@/lib/shop/store";

type Mode = "checking" | "locked" | "ready" | "conflict" | "saving" | "error";
type CloudData = { revision: string | null; snapshot: Snapshot | null; savedAt?: string };
const REVISION_KEY = "la-letra-cloud-revision";

function hasTransactions(snapshot: Snapshot): boolean {
  return snapshot.jobs.length > 0 || (snapshot.sales?.length ?? 0) > 0 || snapshot.customers.length > 0;
}
async function api(path: string, init?: RequestInit) {
  return fetch(path, { credentials: "same-origin", cache: "no-store", ...init });
}

export function CloudBackup() {
  const [mode, setMode] = useState<Mode>("checking");
  const [expanded, setExpanded] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [remote, setRemote] = useState<CloudData | null>(null);
  const revision = useRef<string | null>(null);
  const modeRef = useRef<Mode>("checking");
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writing = useRef(false);
  const dirty = useRef(false);
  const applying = useRef(false);
  const generation = useRef(0);

  const changeMode = (value: Mode) => { modeRef.current = value; setMode(value); };
  const importRemote = useCallback((data: CloudData, force = false) => {
    const parsed = parseSnapshot(data.snapshot);
    if (!parsed) return;
    const local = toSnapshot(useShop.getState());
    if (force && hasTransactions(local)) downloadSnapshot(local);
    applying.current = true;
    useShop.getState().replaceAll(parsed);
    applying.current = false;
    revision.current = data.revision;
    if (data.revision) localStorage.setItem(REVISION_KEY, data.revision);
    dirty.current = false;
    generation.current += 1;
    setRemote(data);
    setMessage("Datos recuperados correctamente.");
    changeMode("ready");
  }, []);

  const inspect = useCallback(async () => {
    const res = await api("/api/cloud-backup");
    if (!res.ok) {
      changeMode(res.status === 401 ? "locked" : "error");
      setMessage("No se pudo consultar la copia en la nube.");
      return;
    }
    const current = await res.json() as CloudData;
    setRemote(current);
    const localRev = localStorage.getItem(REVISION_KEY);
    const local = toSnapshot(useShop.getState());
    if (!current.revision) {
      revision.current = null;
      changeMode("ready");
      setMessage("Nube lista. Los datos de este equipo se respaldarán aquí.");
      if (hasTransactions(local)) dirty.current = true;
      return;
    }
    if (current.revision === localRev) {
      revision.current = current.revision;
      changeMode("ready");
      setMessage("Su información está protegida con copia en la nube.");
      return;
    }
    if (!hasTransactions(local)) {
      importRemote(current);
      return;
    }
    changeMode("conflict");
    setMessage("Hay datos guardados en este equipo y otra copia en la nube. Revise antes de reemplazar.");
  }, [importRemote]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await useShop.persist.rehydrate();
        const res = await api("/api/cloud-login");
        if (!alive) return;
        if (!res.ok) {
          changeMode("locked");
          setMessage("Active una copia segura para no depender de una sola computadora.");
          return;
        }
        await inspect();
      } catch {
        if (alive) {
          changeMode("error");
          setMessage("Sin conexión a la nube. Los datos siguen guardados en este equipo.");
        }
      }
    })();
    return () => { alive = false; };
  }, [inspect]);

  const upload = useCallback(async () => {
    if (writing.current || !dirty.current || modeRef.current === "conflict" || modeRef.current === "locked") return;
    writing.current = true;
    const started = generation.current;
    changeMode("saving");
    try {
      const snap = toSnapshot(useShop.getState());
      const res = await api("/api/cloud-backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseRevision: revision.current, snapshot: snap }),
      });
      if (res.status === 409) {
        changeMode("conflict");
        setMessage("Otra computadora guardó datos más recientes. No se ha sobrescrito nada.");
        return;
      }
      if (!res.ok) throw new Error("No se pudo guardar");
      const answer = await res.json() as { revision: string };
      revision.current = answer.revision;
      localStorage.setItem(REVISION_KEY, answer.revision);
      dirty.current = generation.current !== started;
      setMessage("Copia actualizada en la nube.");
      changeMode("ready");
    } catch {
      changeMode("error");
      setMessage("No se pudo respaldar. Los datos permanecen en este equipo.");
    } finally {
      writing.current = false;
    }
  }, []);

  useEffect(() => {
    if (mode !== "ready" && mode !== "saving" && mode !== "error") return;
    const unsubscribe = useShop.subscribe(() => {
      if (applying.current) return;
      dirty.current = true;
      generation.current += 1;
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => { void upload(); }, 2500);
    });
    if (dirty.current && !writing.current) {
      saveTimeout.current = setTimeout(() => { void upload(); }, 1000);
    }
    return () => {
      unsubscribe();
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [mode, upload]);

  useEffect(() => {
    if (mode !== "ready") return;
    const interval = setInterval(() => {
      if (dirty.current || writing.current) return;
      void (async () => {
        try {
          const response = await api("/api/cloud-backup?meta=1");
          if (!response.ok) return;
          const data = await response.json() as { revision: string | null };
          if (data.revision && data.revision !== revision.current) {
            const latest = await api("/api/cloud-backup");
            if (latest.ok && !dirty.current && !writing.current) {
              const snap = await latest.json() as CloudData;
              importRemote(snap);
            }
          }
        } catch { /* stays available offline */ }
      })();
    }, 60000);
    return () => clearInterval(interval);
  }, [mode, importRemote]);

  async function login(event: FormEvent) {
    event.preventDefault();
    if (!accessCode.trim()) return;
    setBusy(true);
    try {
      const res = await api("/api/cloud-login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: accessCode.trim() }),
      });
      if (!res.ok) {
        setMessage("Código incorrecto o conexión no disponible.");
        return;
      }
      setAccessCode("");
      await inspect();
    } catch {
      setMessage("No se pudo conectar. Intente nuevamente.");
    } finally { setBusy(false); }
  }

  function restore() {
    if (!remote?.snapshot) return;
    if (!window.confirm("¿Recuperar la copia de la nube? Primero se descargará un respaldo de los datos de este equipo para no perderlos.")) return;
    importRemote(remote, true);
  }
  async function reloadRemote() {
    setBusy(true);
    try {
      const result = await api("/api/cloud-backup");
      if (result.ok) {
        const current = await result.json() as CloudData;
        setRemote(current);
        if (!current.snapshot) {
          setMessage("Aún no hay un respaldo en la nube.");
          changeMode("ready");
          return;
        }
        changeMode("conflict");
        setMessage("Copia más reciente encontrada. Puede recuperarla conservando antes una copia local.");
      }
    } finally { setBusy(false); }
  }

  return (
    <div className="no-print fixed bottom-4 right-4 z-40 max-w-[calc(100vw-2rem)]">
      {!expanded ? (
        <button type="button" onClick={() => setExpanded(true)}
          className={"flex min-h-12 items-center gap-2 rounded-2xl border bg-card px-4 py-3 text-sm font-bold shadow-xl " + (mode === "ready" ? "border-emerald-300 text-emerald-700" : mode === "conflict" ? "border-amber-400 text-amber-700" : "border-line text-ink")}>
          {mode === "ready" ? <CloudCheck size={21}/> : mode === "conflict" || mode === "error" ? <CloudAlert size={21}/> : <Cloud size={21}/>}
          {mode === "ready" ? "Copia en nube activa" : mode === "saving" ? "Guardando copia..." : mode === "conflict" ? "Revisar copias" : mode === "checking" ? "Verificando copia..." : "Activar respaldo en nube"}
        </button>
      ) : (
        <section aria-label="Copias de seguridad" className="w-[390px] max-w-full rounded-2xl border border-line bg-card p-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><LockKeyhole size={22} className="text-stamp"/><h2 className="text-lg font-extrabold">Respaldo privado</h2></div>
            <button type="button" onClick={() => setExpanded(false)} aria-label="Cerrar" className="rounded-lg p-2 hover:bg-paper"><X size={20}/></button>
          </div>
          <p className="mt-2 text-sm text-muted">{message || "Los datos locales siempre se conservan."}</p>
          {mode === "locked" ? (
            <form className="mt-4 space-y-3" onSubmit={(event) => void login(event)}>
              <label className="block text-base font-bold">Clave familiar
                <input type="password" value={accessCode} onChange={(event) => setAccessCode(event.target.value)}
                  placeholder="Ingrese la clave de acceso"
                  autoComplete="current-password" className="mt-2 w-full rounded-xl border border-line px-4 py-3 text-lg"/>
              </label>
              <button type="submit" disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-stamp px-4 font-bold text-white">
                <KeyRound size={19}/> Activar copia en nube
              </button>
            </form>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => { dirty.current = true; void upload(); }} disabled={busy || mode === "conflict"}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-stamp px-3 text-sm font-bold text-white disabled:opacity-50"><CloudUpload size={18}/> Guardar ahora</button>
              <button type="button" onClick={() => void reloadRemote()} disabled={busy}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm font-bold"><RefreshCw size={18}/> Ver copia</button>
              {remote?.snapshot ? (
                <button type="button" onClick={restore}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm font-bold"><Download size={18}/> Recuperar</button>
              ) : null}
            </div>
          )}
          <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-muted">
            Los respaldos se guardan en un almacén privado de Vercel.
            Si dos equipos modifican datos a la vez, revise el aviso antes de restaurar.
            Esta función es un respaldo con recuperación, no una base transaccional de múltiples cajeros.
          </p>
        </section>
      )}
    </div>
  );
}
