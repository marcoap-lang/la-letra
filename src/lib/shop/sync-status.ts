import { create } from "zustand";

export type SyncMode = "checking" | "ready" | "saving" | "offline" | "conflict" | "denied";

// Estado de sincronización que cloud-sync.tsx publica solo para mostrarlo en pantalla.
export const useSyncStatus = create<{ mode: SyncMode; dirty: boolean }>(() => ({ mode: "checking", dirty: false }));
