// Sheets, dialogs and toasts mods open over the screen.
import { useSyncExternalStore } from "react";

export type Overlay = {
  id: string;
  mod: string;
  props: Record<string, unknown>;
  kind: "sheet" | "dialog" | "toast";
  title: string | null;
};

let overlays: Overlay[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openOverlay(o: Overlay) {
  overlays = [...overlays.filter((x) => x.id !== o.id), o];
  emit();
}

export function closeOverlay(id: string | null) {
  const before = overlays.length;
  overlays = id === null ? overlays.slice(0, -1) : overlays.filter((x) => x.id !== id);
  if (overlays.length !== before) emit();
}

let toastCount = 0;
export function toast(t: { title: string; body?: string; level?: string; action?: { name: string; args?: unknown } | null; timeout?: number | null }) {
  const id = `toast${++toastCount}`;
  openOverlay({ id, mod: "toast", kind: "toast", title: null, props: { title: t.title, body: t.body ?? "", level: t.level ?? "info", action: t.action ?? null } });
  setTimeout(() => closeOverlay(id), t.timeout ?? 4000);
}

export function useOverlays(): Overlay[] {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => overlays);
}
