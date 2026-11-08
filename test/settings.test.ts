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

test("existing settings keep terminal preferences and default to owner/repo in ~/workspace", async () => {
  storage.value = JSON.stringify({ fontSize: 16, defaultMode: "full" });
  const settings = await import("../src/settings");

  await settings.loadSettings();

  expect(settings.getSettings()).toMatchObject({ fontSize: 16, defaultMode: "full", projectPaths: ["~/workspace"], projectLayout: "grouped" });
});

test("multiple project paths and layout survive reloading settings", async () => {
  const settings = await import("../src/settings");

  await settings.updateSettings({ projectPaths: ["~/other", "~/work", "/srv/projects"], projectLayout: "direct" });
  vi.resetModules();
  const restarted = await import("../src/settings");
  await restarted.loadSettings();

  expect(restarted.getSettings()).toMatchObject({ projectPaths: ["~/other", "~/work", "/srv/projects"], projectLayout: "direct" });
});

test("single-path settings migrate without losing the user's selection", async () => {
  storage.value = JSON.stringify({ projectPath: "~/work", projectLayout: "direct" });
  const settings = await import("../src/settings");

  await settings.loadSettings();

  expect(settings.getSettings()).toMatchObject({ projectPaths: ["~/work"], projectLayout: "direct" });
});

test("duplicate paths are stored once, and removing all paths persists", async () => {
  const settings = await import("../src/settings");

  await settings.updateSettings({ projectPaths: ["~/other", "~/other"] });
  expect(settings.getSettings().projectPaths).toEqual(["~/other"]);
  await settings.updateSettings({ projectPaths: [] });
  vi.resetModules();
  const restarted = await import("../src/settings");
  await restarted.loadSettings();

  expect(restarted.getSettings().projectPaths).toEqual([]);
});

test("invalid paths leave saved and current settings unchanged", async () => {
  const settings = await import("../src/settings");
  const before = settings.getSettings();

  await expect(settings.updateSettings({ projectPaths: ["~/other", "relative/path"] })).rejects.toThrow("absolute path");

  expect(settings.getSettings()).toEqual(before);
  expect(storage.value).toBeNull();
});
