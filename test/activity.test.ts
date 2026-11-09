import { describe, expect, test } from "vitest";
import type { Session } from "../src/hc/fleet";
import { activityItems, activityKind, activitySelectionId, dismissItems, filterActivity, pruneActivitySelection, shouldCaptureDismissSwipe, shouldRevealDismiss, visibleActivity } from "../src/activity";
import type { Space } from "../src/spaces";

function session(key: string, state: string, statusMs?: number, terminalState = "live", exitCode?: number, labels: Record<string, string> = {}): Session {
  return {
    key, parentKey: null, machine: "machine", linkId: "link", address: key,
    terminal: {
      address: key, argv: ["agent"], cwd: "/work/project", state: terminalState, created_ms: 100,
      status_ms: statusMs, finished_ms: terminalState === "finished" ? statusMs : undefined, exit_code: exitCode,
      status: { state }, labels, cols: 80, rows: 24,
    },
  };
}

describe("activity", () => {
  test("filters by type together with machine and space, including finished successes and failures", () => {
    const done = session("core:done", "working", 200, "finished", 0);
    const failed = session("core:failed", "working", 300, "finished", 1);
    const elsewhere = session("other:error", "error", 400);
    const space = { key: "core:space", target: {} as Space["target"], id: "space", name: "Workspace", folder: "/work", factory: false, agents: [done, failed] } satisfies Space;
    const items = activityItems([done, failed, elsewhere], [space]);
    const filters = { machine: "core", space: space.key, kind: "error" } as const;

    const errors = filterActivity(items, filters);
    const completed = filterActivity(items, { ...filters, kind: "completed" });

    expect(errors.map(({ session }) => session.key)).toEqual([failed.key]);
    expect(completed.map(({ session }) => session.key)).toEqual([done.key]);
    expect(filterActivity(items, { ...filters, kind: null })).toHaveLength(2);
    expect(filterActivity(items, { ...filters, kind: "waiting" })).toEqual([]);
  });

  test("type filtering limits bulk dismissal and removes hidden selections", () => {
    const items = activityItems([session("core:error", "error", 200), session("core:idle", "idle", 300)], []);
    const filters = { machine: null, space: null, kind: "error" } as const;
    const scoped = filterActivity(items, filters);
    const selected = items.map(activitySelectionId);

    const dismissed = dismissItems({}, scoped);

    expect(Object.keys(dismissed)).toEqual(["core:error"]);
    expect(pruneActivitySelection(selected, items, {}, filters)).toEqual(scoped.map(activitySelectionId));
    expect(visibleActivity(items, dismissed, { ...filters, kind: null }).map(({ session }) => session.key)).toEqual(["core:idle"]);
  });
  test("captures deliberate left swipes only and reveals dismissal past the threshold", () => {
    expect(shouldCaptureDismissSwipe(-20, 2)).toBe(true);
    expect(shouldCaptureDismissSwipe(40, 1)).toBe(false);
    expect(shouldCaptureDismissSwipe(-60, 70)).toBe(false);
    expect(shouldCaptureDismissSwipe(-80, 0, 12)).toBe(false);
    expect(shouldRevealDismiss(-40, 0)).toBe(false);
    expect(shouldRevealDismiss(-70, 2)).toBe(true);
    expect(shouldRevealDismiss(-100, 2, 64, 12)).toBe(false);
  });
  test("classifies attention, completion, idle, and unknown states explicitly", () => {
    expect(activityKind(session("wait", "blocked"))).toBe("waiting");
    expect(activityKind(session("error", "error"))).toBe("error");
    expect(activityKind(session("done", "done"))).toBe("completed");
    expect(activityKind(session("finished", "working", 200, "finished", 0))).toBe("completed");
    expect(activityKind(session("failed", "done", 200, "finished", 1))).toBe("error");
    expect(activityKind(session("failed-unknown", "working", 200, "finished", 2))).toBe("error");
    expect(activityKind(session("idle", "idle"))).toBe("idle");
    expect(activityKind(session("other", "new-state"))).toBe("unknown");
  });

  test("sorts attention then completed then others by newest timestamp and stable key without mutating input", () => {
    const input = [session("z-idle", "idle", 900), session("b-wait", "blocked", 400), session("done", "done", 700), session("a-error", "error", 400), session("a-idle", "idle", 900)];
    const original = [...input];
    expect(activityItems(input, []).map(({ session: item }) => item.key)).toEqual(["a-error", "b-wait", "done", "a-idle", "z-idle"]);
    expect(input).toEqual(original);
  });

  test("prefers finished time and resolves membership and labeled finished-session space context", () => {
    const member = session("core:member", "working", 300);
    const finished = session("core:finished", "blocked", 400, "finished", 0, { "herdr.space": "space" });
    finished.terminal.finished_ms = 600;
    const space = { key: "core:space", target: {} as Space["target"], id: "space", name: "Workspace", folder: "/work", factory: false, agents: [member] } satisfies Space;
    const items = activityItems([member, finished], [space]);
    expect(items.find((item) => item.session.key === member.key)?.space).toBe(space);
    expect(items.find((item) => item.session.key === finished.key)?.space).toBe(space);
    expect(items.find((item) => item.session.key === finished.key)?.changedAt).toBe(600);
    expect(items.find((item) => item.session.key === finished.key)?.timeSource).toBe("finished");
    expect(items.find((item) => item.session.key === member.key)?.timeSource).toBe("status");
  });

  test("includes live sessions without status and returns an empty list for no sessions", () => {
    const live = session("live", "", undefined);
    live.terminal.status = null;
    expect(activityItems([live], [])[0].kind).toBe("unknown");
    expect(activityItems([live], [])[0].changedAt).toBe(100);
    expect(activityItems([live], [])[0].timeSource).toBe("started");
    expect(activityItems([], [])).toEqual([]);
  });

  test("composes machine/space filters and confines dismissal to the filtered scope", () => {
    const member = session("core:member", "working", 300);
    const elsewhere = session("other:outside", "idle", 200);
    elsewhere.machine = "other-machine";
    const space = { key: "core:space", target: {} as Space["target"], id: "space", name: "Workspace", folder: "/work", factory: false, agents: [member] } satisfies Space;
    const [inSpace, outside] = activityItems([member, elsewhere], [space]);
    const filtered = filterActivity([inSpace, outside], { machine: "core", space: space.key, kind: null });
    expect(filtered.map(({ session: item }) => item.key)).toEqual([member.key]);
    const hidden = dismissItems({}, filtered);
    expect(visibleActivity([inSpace, outside], hidden, { machine: "core", space: space.key, kind: null })).toEqual([]);
    expect(visibleActivity([inSpace, outside], hidden, { machine: null, space: null, kind: null })).toHaveLength(1);
    expect(filterActivity([inSpace, outside], { machine: null, space: "__none__", kind: null }).map(({ session: item }) => item.key)).toEqual([elsewhere.key]);
    const newEvent = activityItems([session(member.key, "error", 500)], [space]);
    expect(visibleActivity(newEvent, hidden, { machine: null, space: null, kind: null })).toHaveLength(1);
  });

  test("uses stable core IDs for machine filtering and prunes stale selection revisions", () => {
    const one = session("core-a:session", "working", 300);
    one.machine = "Shared name";
    const two = session("core-b:session", "working", 300);
    two.machine = "Shared name";
    const oldItems = activityItems([one], []);
    const revisedItems = activityItems([session(one.key, "error", 400)], []);
    expect(filterActivity([...oldItems, ...activityItems([two], [])], { machine: "core-a", space: null, kind: null })).toHaveLength(1);
    expect(pruneActivitySelection([activitySelectionId(oldItems[0])], revisedItems, {}, { machine: null, space: null, kind: null })).toEqual([]);
  });

  test("dismissal hides the exact revision, and a newer event in the same state resurfaces", () => {
    const before = activityItems([session("core:agent", "working", 300)], []);
    const dismissed = dismissItems({}, before);
    const unchanged = activityItems([session("core:agent", "working", 300)], []);
    const newer = activityItems([session("core:agent", "working", 301)], []);
    const filters = { machine: null, space: null, kind: null };

    expect(visibleActivity(unchanged, dismissed, filters)).toEqual([]);
    expect(visibleActivity(newer, dismissed, filters).map((item) => item.session.key)).toEqual(["core:agent"]);
  });

  test("an unavailable scope stays empty rather than exposing all activity", () => {
    const items = activityItems([session("core:agent", "working", 300)], []);

    expect(filterActivity(items, { machine: "missing-core", space: null, kind: null })).toEqual([]);
    expect(filterActivity(items, { machine: null, space: "missing-space", kind: null })).toEqual([]);
  });

  test("handles missing change timestamps and duplicate keys deterministically", () => {
    const result = activityItems([session("b", "working"), session("a", "working"), session("a", "error")], []);
    expect(result.map(({ session: item }) => item.key)).toEqual(["a", "b"]);
    expect(result[0].kind).toBe("error");
    expect(result[0].changedAt).toBe(100);
  });
});
