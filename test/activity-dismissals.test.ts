import { beforeEach, expect, test, vi } from "vitest";
import { activityItems, EMPTY_ACTIVITY_FILTERS, openActivityItem, visibleActivity } from "../src/activity";
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

test("opening an unread entry opens its panel and durably clears only that entry", async () => {
  const dismissals = await import("../src/activity-dismissals");
  const [entry] = items("core:read");
  const [unread] = items("core:unread");
  const opened: string[] = [];

  await openActivityItem(entry, {
    openPanel: (key) => opened.push(key),
    markRead: dismissals.dismissActivityItems,
  });
  vi.resetModules();
  const restarted = await import("../src/activity-dismissals");
  const read = await restarted.loadActivityDismissals();

  expect(opened).toEqual([entry.session.key]);
  expect(visibleActivity([entry, unread], read, EMPTY_ACTIVITY_FILTERS).map(({ session }) => session.key)).toEqual([unread.session.key]);
});

test("new activity from a previously opened agent resurfaces and Undo restores the read entry", async () => {
  const dismissals = await import("../src/activity-dismissals");
  const [entry] = items("core:read", 100);
  const [newer] = items("core:read", 200);
  await openActivityItem(entry, { openPanel: () => {}, markRead: dismissals.dismissActivityItems });

  const read = await dismissals.loadActivityDismissals();
  const unread = visibleActivity([newer], read, EMPTY_ACTIVITY_FILTERS);
  const restored = await dismissals.undoActivityItems([entry]);

  expect(unread.map(({ fingerprint }) => fingerprint)).toEqual([newer.fingerprint]);
  expect(visibleActivity([entry], restored, EMPTY_ACTIVITY_FILTERS)).toEqual([entry]);
});

test("a failed panel navigation leaves the entry unread", async () => {
  const dismissals = await import("../src/activity-dismissals");
  const [entry] = items("core:read");

  await expect(openActivityItem(entry, {
    openPanel: () => { throw new Error("navigation failed"); },
    markRead: dismissals.dismissActivityItems,
  })).rejects.toThrow("navigation failed");

  expect(await dismissals.loadActivityDismissals()).toEqual({});
});

test("a failed read-state save still opens the panel and leaves the entry unread", async () => {
  const dismissals = await import("../src/activity-dismissals");
  const [entry] = items("core:read");
  const opened: string[] = [];
  storage.failWrite = true;

  await expect(openActivityItem(entry, {
    openPanel: (key) => opened.push(key),
    markRead: dismissals.dismissActivityItems,
  })).rejects.toThrow("write failed");

  expect(opened).toEqual([entry.session.key]);
  expect(visibleActivity([entry], await dismissals.loadActivityDismissals(), EMPTY_ACTIVITY_FILTERS)).toEqual([entry]);
});

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

test("Undo removes only dismissed markers and preserves unrelated entries", async () => {
  const dismissals = await import("../src/activity-dismissals");
  await dismissals.loadActivityDismissals();
  const target = items("core:target");
  const unrelated = items("other:session");
  await dismissals.dismissActivityItems([...target, ...unrelated]);

  await dismissals.undoActivityItems(target);

  expect(await dismissals.loadActivityDismissals()).toEqual({ "other:session": unrelated[0].fingerprint });
});

test("batch Undo restores all exact dismissed revisions", async () => {
  const dismissals = await import("../src/activity-dismissals");
  await dismissals.loadActivityDismissals();
  const batch = [items("core:first")[0], items("core:second")[0]];
  await dismissals.dismissActivityItems(batch);
  expect(Object.keys(await dismissals.loadActivityDismissals())).toHaveLength(2);

  await dismissals.undoActivityItems(batch);

  expect(await dismissals.loadActivityDismissals()).toEqual({});
});

test("Undo restores only the exact dismissed revision and preserves newer markers", async () => {
  const dismissals = await import("../src/activity-dismissals");
  await dismissals.loadActivityDismissals();
  const firstRevision = items("core:session", 100);
  const newerRevision = items("core:session", 200);
  await dismissals.dismissActivityItems(firstRevision);
  await dismissals.dismissActivityItems(newerRevision);

  await dismissals.undoActivityItems(firstRevision);

  expect(await dismissals.loadActivityDismissals()).toEqual({ "core:session": newerRevision[0].fingerprint });
});

test("failed Undo writes leave persisted dismissals unchanged", async () => {
  const dismissals = await import("../src/activity-dismissals");
  await dismissals.loadActivityDismissals();
  const hidden = items("core:session");
  await dismissals.dismissActivityItems(hidden);
  storage.failWrite = true;

  await expect(dismissals.undoActivityItems(hidden)).rejects.toThrow("write failed");

  expect(await dismissals.loadActivityDismissals()).toEqual({ "core:session": hidden[0].fingerprint });
  expect(JSON.parse(storage.value!)).toEqual({ "core:session": hidden[0].fingerprint });
});

test("dismissal loads existing markers before writing when called before page load", async () => {
  storage.value = JSON.stringify({ "core:old": "saved" });
  const dismissals = await import("../src/activity-dismissals");
  const next = items("core:next");

  await dismissals.dismissActivityItems(next);

  expect(await dismissals.loadActivityDismissals()).toEqual({ "core:old": "saved", "core:next": next[0].fingerprint });
});
