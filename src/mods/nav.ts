// Which tab each tabs node shows. layout.select changes it.
import { useSyncExternalStore } from "react";

let active: Record<string, string> = {};
const listeners = new Set<() => void>();

export function selectTab(tabs: string, child: string) {
  if (active[tabs] === child) return;
  active = { ...active, [tabs]: child };
  listeners.forEach((l) => l());
}

export function useActiveTab(tabs: string): string | undefined {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => active[tabs]);
}
