// shared(key) / setShared(key, value): state every mod on this phone sees,
// kept across restarts. Setting it draws every mod again, as on desktop.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

const KEY = "mods.shared.v1";
let shared: Record<string, unknown> = {};
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

export async function loadShared() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) shared = { ...JSON.parse(raw), ...shared };
  } catch {}
  listeners.forEach((l) => l());
}

export function setShared(key: string, value: unknown) {
  const next = { ...shared };
  if (value === null || value === undefined) delete next[key];
  else next[key] = value;
  shared = next;
  listeners.forEach((l) => l());
  clearTimeout(timer);
  timer = setTimeout(() => void AsyncStorage.setItem(KEY, JSON.stringify(shared)), 300);
}

export const getShared = () => shared;

export function useShared(): Record<string, unknown> {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => shared);
}

/** A mod copy's localStorage, kept per copy. */
export async function loadStorage(copy: string): Promise<Record<string, string>> {
  try {
    return JSON.parse((await AsyncStorage.getItem(`mods.storage.${copy}`)) ?? "{}");
  } catch {
    return {};
  }
}

const storageTimers = new Map<string, ReturnType<typeof setTimeout>>();
export function saveStorage(copy: string, storage: Record<string, string>) {
  clearTimeout(storageTimers.get(copy));
  storageTimers.set(copy, setTimeout(() => void AsyncStorage.setItem(`mods.storage.${copy}`, JSON.stringify(storage)), 300));
}
