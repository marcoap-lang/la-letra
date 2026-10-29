import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

/** Ofrece "Instalar app" solo cuando el navegador lo permite y la app aún no está instalada. */
export function useInstallApp() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => void listeners.delete(fn);
  }, []);
  const standalone = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;
  return {
    canInstall: !!deferred && !standalone,
    install: async () => {
      if (!deferred) return;
      const ev = deferred;
      deferred = null;
      notify();
      await ev.prompt();
      await ev.userChoice.catch(() => {});
    },
  };
}
