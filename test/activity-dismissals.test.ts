import { beforeEach, expect, test, vi } from "vitest";
import { activityItems } from "../src/activity";
import type { Session } from "../src/hc/fleet";

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

function items(key: string, statusMs = 100) {
  const session: Session = {
    key, parentKey: null, machine: "machine", linkId: "link", address: key,
    terminal: { address: key, argv: ["agent"], cwd: "/work", state: "live", created_ms: 1, status_ms: statusMs, status: { state: "idle" }, labels: {}, cols: 80, rows: 24 },
  };
  return activityItems([session], []);
}

test("dismissal fingerprints persist across module reloads", async () => {
  const dismissals = await import("../src/activity-dismissals");
  const hidden = items("core:session");
  await dismissals.loadActivityDismissals();

  await dismissals.dismissActivityItems(hidden);
  vi.resetModules();
  const restarted = await import("../src/activity-dismissals");

  expect(await restarted.loadActivityDismissals()).toEqual({ "core:session": hidden[0].fingerprint });
});

test("returning to Activity loads the latest committed map", async () => {
  const dismissals = await import("../src/activity-dismissals");
  await dismissals.loadActivityDismissals();
  const hidden = items("core:session");

  await dismissals.dismissActivityItems(hidden);

  expect(await dismissals.loadActivityDismissals()).toEqual({ "core:session": hidden[0].fingerprint });
});

test("malformed data and read failures reject but a later load can retry", async () => {
  storage.value = "{";
  const dismissals = await import("../src/activity-dismissals");
  await expect(dismissals.loadActivityDismissals()).rejects.toThrow();
  storage.value = null;
  storage.failRead = true;
  await expect(dismissals.loadActivityDismissals()).rejects.toThrow("read failed");

  storage.failRead = false;

  expect(await dismissals.loadActivityDismissals()).toEqual({});
});

test("failed dismissal preserves prior state and can be retried", async () => {
  const dismissals = await import("../src/activity-dismissals");
  await dismissals.loadActivityDismissals();
  const first = items("core:first");
  const next = items("core:next");
  await dismissals.dismissActivityItems(first);
  storage.failWrite = true;

  await expect(dismissals.dismissActivityItems(next)).rejects.toThrow("write failed");

  expect(await dismissals.loadActivityDismissals()).toEqual({ "core:first": first[0].fingerprint });
  expect(JSON.parse(storage.value!)).toEqual({ "core:first": first[0].fingerprint });
  storage.failWrite = false;
  await dismissals.dismissActivityItems(next);
  expect(await dismissals.loadActivityDismissals()).toEqual({ "core:first": first[0].fingerprint, "core:next": next[0].fingerprint });
});

test("rapid dismissals merge instead of overwriting unrelated entries", async () => {
  const dismissals = await import("../src/activity-dismissals");
  await dismissals.loadActivityDismissals();
  const first = items("core:first");
  const second = items("other:second");

  await Promise.all([dismissals.dismissActivityItems(first), dismissals.dismissActivityItems(second)]);

  expect(await dismissals.loadActivityDismissals()).toEqual({ "core:first": first[0].fingerprint, "other:second": second[0].fingerprint });
});

test("dismissal loads existing markers before writing when called before page load", async () => {
  storage.value = JSON.stringify({ "core:old": "saved" });
  const dismissals = await import("../src/activity-dismissals");
  const next = items("core:next");

  await dismissals.dismissActivityItems(next);

  expect(await dismissals.loadActivityDismissals()).toEqual({ "core:old": "saved", "core:next": next[0].fingerprint });
});
