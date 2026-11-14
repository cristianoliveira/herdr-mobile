import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import type { TerminalMode } from "./terminal/TerminalView";

export type Settings = {
  fontSize: number;
  defaultMode: TerminalMode;
  /** How the bottom bar takes input: keys straight to the terminal, or a message hc pastes. */
  inputMode: "direct" | "message";
  /** The machine (its id in Machines) whose core holds the definition; null: the first machine. */
  definitionMachine: string | null;
};

const DEFAULTS: Settings = {
  fontSize: 12,
  defaultMode: "fit",
  inputMode: "direct",
  definitionMachine: null,
};
const KEY = "settings.v1";

let current: Settings = DEFAULTS;
const listeners = new Set<() => void>();

export async function loadSettings() {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) {
    const saved = JSON.parse(raw);
    current = {
      fontSize: saved.fontSize ?? DEFAULTS.fontSize,
      defaultMode: saved.defaultMode ?? DEFAULTS.defaultMode,
      inputMode: saved.inputMode ?? DEFAULTS.inputMode,
      definitionMachine: saved.definitionMachine ?? null,
    };
  }
  listeners.forEach((l) => l());
}

export function getSettings(): Settings {
  return current;
}

export async function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  listeners.forEach((l) => l());
  await AsyncStorage.setItem(KEY, JSON.stringify(current));
}

export function onSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettings(): Settings {
  return useSyncExternalStore(onSettings, getSettings);
}
