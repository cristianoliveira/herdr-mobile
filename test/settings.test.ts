import { beforeEach, expect, test, vi } from "vitest";

const storage = vi.hoisted(() => ({ value: null as string | null }));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async () => storage.value,
    setItem: async (_key: string, value: string) => { storage.value = value; },
  },
}));

beforeEach(() => {
  storage.value = null;
  vi.resetModules();
});

test("settings saved by an older version keep the terminal preferences and drop what's gone", async () => {
  storage.value = JSON.stringify({ fontSize: 16, defaultMode: "full", projectPaths: ["~/work"], projectLayout: "direct", inbox: true });
  const settings = await import("../src/settings");
  await settings.loadSettings();
  expect(settings.getSettings()).toEqual({ fontSize: 16, defaultMode: "full", inputMode: "direct", definitionMachine: null });
});

test("the definition machine survives a restart", async () => {
  const settings = await import("../src/settings");
  await settings.updateSettings({ definitionMachine: "m2" });
  vi.resetModules();
  const restarted = await import("../src/settings");
  await restarted.loadSettings();
  expect(restarted.getSettings().definitionMachine).toBe("m2");
});
