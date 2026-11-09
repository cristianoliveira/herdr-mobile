import { beforeEach, expect, test, vi } from "vitest";

const storage = vi.hoisted(() => ({ value: null as string | null, failRead: false, failWrite: false }));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async () => { if (storage.failRead) throw new Error("read failed"); return storage.value; },
    setItem: async (_key: string, value: string) => { if (storage.failWrite) throw new Error("write failed"); storage.value = value; },
  },
}));

beforeEach(() => {
  storage.value = null;
  storage.failRead = false;
  storage.failWrite = false;
  vi.resetModules();
});

test("defaults to all types, machines and spaces", async () => {
  const filters = await import("../src/activity-filters");

  expect(await filters.loadActivityFilters()).toEqual({ machine: null, space: null, kind: null });
});

test("saved filters survive returning to Activity and restarting the app", async () => {
  const filters = await import("../src/activity-filters");
  const selected = { machine: "core", space: "core:space", kind: "error" } as const;

  await filters.saveActivityFilters(selected);
  expect(await filters.loadActivityFilters()).toEqual(selected);
  vi.resetModules();
  const restarted = await import("../src/activity-filters");

  expect(await restarted.loadActivityFilters()).toEqual(selected);
});

test("selecting all types clears only the type restriction", async () => {
  const filters = await import("../src/activity-filters");
  await filters.saveActivityFilters({ machine: "core", space: "__none__", kind: "completed" });

  await filters.saveActivityFilters({ machine: "core", space: "__none__", kind: null });
  vi.resetModules();
  const restarted = await import("../src/activity-filters");

  expect(await restarted.loadActivityFilters()).toEqual({ machine: "core", space: "__none__", kind: null });
});

test("reads older filters without a type as all types", async () => {
  storage.value = JSON.stringify({ machine: "core", space: null });
  const filters = await import("../src/activity-filters");

  expect(await filters.loadActivityFilters()).toEqual({ machine: "core", space: null, kind: null });
});

test.each(["{", "null", "[]", '{"machine":12,"space":null}', '{"machine":null,"space":null,"kind":"bogus"}'])("rejects malformed saved filters instead of broadening scope: %s", async (raw) => {
  storage.value = raw;
  const filters = await import("../src/activity-filters");

  await expect(filters.loadActivityFilters()).rejects.toThrow();
});

test("failed reads can be retried", async () => {
  storage.failRead = true;
  const filters = await import("../src/activity-filters");
  await expect(filters.loadActivityFilters()).rejects.toThrow("read failed");

  storage.failRead = false;

  expect(await filters.loadActivityFilters()).toEqual({ machine: null, space: null, kind: null });
});

test("failed writes preserve committed filters and allow retry", async () => {
  const filters = await import("../src/activity-filters");
  const before = { machine: null, space: null, kind: "working" } as const;
  const after = { ...before, kind: "completed" } as const;
  await filters.saveActivityFilters(before);
  storage.failWrite = true;

  await expect(filters.saveActivityFilters(after)).rejects.toThrow("write failed");

  expect(await filters.loadActivityFilters()).toEqual(before);
  expect(JSON.parse(storage.value!)).toEqual(before);
  storage.failWrite = false;
  await filters.saveActivityFilters(after);
  expect(await filters.loadActivityFilters()).toEqual(after);
});

test("navigation waits for queued saves and restores the last selection", async () => {
  const filters = await import("../src/activity-filters");
  const first = filters.saveActivityFilters({ machine: null, space: null, kind: "error" });
  const last = filters.saveActivityFilters({ machine: null, space: null, kind: "idle" });

  const returned = await filters.loadActivityFilters();
  await Promise.all([first, last]);

  expect(returned).toEqual({ machine: null, space: null, kind: "idle" });
});
