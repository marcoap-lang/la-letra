import { useEffect, useState, type ReactNode } from "react";
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  type User,
} from "firebase/auth";
import { LogIn } from "lucide-react";
import { Mark } from "./ui";
import { auth, firebaseConfigured, googleProvider } from "@/lib/firebase/client";

type AuthState = { status: "loading" } | { status: "out" } | { status: "in"; user: User };

export function AuthGate({ children }: { children: (user: User) => ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getRedirectResult(auth).catch(() => setError("No se pudo completar la entrada. Intente de nuevo."));
    return onAuthStateChanged(auth, (user) => setState(user ? { status: "in", user } : { status: "out" }));
  }, []);

  async function signIn() {
    setBusy(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError(
          code === "auth/network-request-failed"
            ? "Sin conexión. Revise internet e intente de nuevo."
            : "No se pudo entrar con Google. Intente de nuevo.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  if (!firebaseConfigured) {
    return (
      <Centered>
        <p className="text-base text-muted">Falta la configuración de Firebase (variables VITE_FIREBASE_*).</p>
      </Centered>
    );
  }
  if (state.status === "loading") {
    return (
      <Centered>
        <p className="text-base text-muted">Cargando...</p>
      </Centered>
    );
  }
  if (state.status === "out") {
    return (
      <Centered>
        <Mark />
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight">La Letra</h1>
        <p className="mt-1 text-base text-muted">Imprenta y papelería · Tuxtepec</p>
        <button
          type="button"
          onClick={() => void signIn()}
          disabled={busy}
          className="mt-8 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-stamp px-6 text-lg font-bold text-white shadow-brand hover:bg-stamp-dark disabled:opacity-60"
        >
          <LogIn size={22} /> {busy ? "Abriendo Google..." : "Entrar con Google"}
        </button>
        {error ? <p role="alert" className="mt-4 text-sm font-semibold text-red-700">{error}</p> : null}
      </Centered>
    );
  }
  if (!state.user.emailVerified) {
    return (
      <Centered>
        <p className="text-base">La cuenta {state.user.email} no tiene el correo verificado.</p>
        <button type="button" onClick={() => void auth.signOut()} className="mt-4 rounded-xl border border-line px-4 py-3 font-bold">
          Salir
        </button>
      </Centered>
    );
  }
  return <>{children(state.user)}</>;
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-tint to-paper p-6">
      <div className="flex w-full max-w-sm flex-col items-center rounded-3xl border border-line/80 bg-card p-8 text-center shadow-lift">{children}</div>
    </main>
  );
}
