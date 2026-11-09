import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { projectPathError, type ProjectLayout } from "./projects";
import type { TerminalMode } from "./terminal/TerminalView";

export type Settings = {
  fontSize: number;
  projectPaths: string[];
  projectLayout: ProjectLayout;
  defaultMode: TerminalMode;
  /** How the bottom bar takes input: keys straight to the terminal, or a message hc pastes. */
  inputMode: "direct" | "message";
  /** Spaces shows only the agents that need you, most urgent first. */
  inbox: boolean;
};

const DEFAULTS: Settings = {
  fontSize: 12,
  projectPaths: ["~/workspace"],
  projectLayout: "grouped",
  defaultMode: "fit",
  inputMode: "direct",
  inbox: false,
};
const KEY = "settings.v1";

let current: Settings = DEFAULTS;
const listeners = new Set<() => void>();

export async function loadSettings() {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) {
    const saved = JSON.parse(raw);
    const { projectPath, ...settings } = saved;
    current = { ...DEFAULTS, ...settings, projectPaths: saved.projectPaths ?? (projectPath ? [projectPath] : DEFAULTS.projectPaths) };
  }
  listeners.forEach((l) => l());
}

export function getSettings(): Settings {
  return current;
}

export async function updateSettings(patch: Partial<Settings>) {
  if (patch.projectPaths !== undefined) {
    for (const path of patch.projectPaths) {
      const error = projectPathError(path);
      if (error) throw new Error(error);
    }
    patch = { ...patch, projectPaths: [...new Set(patch.projectPaths)] };
  }
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
