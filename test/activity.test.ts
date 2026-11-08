import { describe, expect, test } from "vitest";
import type { Session } from "../src/hc/fleet";
import { activityItems, activityKind, activitySelectionId, dismissItems, filterActivity, pruneActivitySelection, visibleActivity } from "../src/activity";
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
    const filtered = filterActivity([inSpace, outside], { machine: "core", space: space.key });
    expect(filtered.map(({ session: item }) => item.key)).toEqual([member.key]);
    const hidden = dismissItems({}, filtered);
    expect(visibleActivity([inSpace, outside], hidden, { machine: "core", space: space.key })).toEqual([]);
    expect(visibleActivity([inSpace, outside], hidden, { machine: null, space: null })).toHaveLength(1);
    expect(filterActivity([inSpace, outside], { machine: null, space: "__none__" }).map(({ session: item }) => item.key)).toEqual([elsewhere.key]);
    const newEvent = activityItems([session(member.key, "error", 500)], [space]);
    expect(visibleActivity(newEvent, hidden, { machine: null, space: null })).toHaveLength(1);
  });

  test("uses stable core IDs for machine filtering and prunes stale selection revisions", () => {
    const one = session("core-a:session", "working", 300);
    one.machine = "Shared name";
    const two = session("core-b:session", "working", 300);
    two.machine = "Shared name";
    const oldItems = activityItems([one], []);
    const revisedItems = activityItems([session(one.key, "error", 400)], []);
    expect(filterActivity([...oldItems, ...activityItems([two], [])], { machine: "core-a", space: null })).toHaveLength(1);
    expect(pruneActivitySelection([activitySelectionId(oldItems[0])], revisedItems, {}, { machine: null, space: null })).toEqual([]);
  });

  test("dismissal hides the exact revision, and a newer event in the same state resurfaces", () => {
    const before = activityItems([session("core:agent", "working", 300)], []);
    const dismissed = dismissItems({}, before);
    const unchanged = activityItems([session("core:agent", "working", 300)], []);
    const newer = activityItems([session("core:agent", "working", 301)], []);
    const filters = { machine: null, space: null };

    expect(visibleActivity(unchanged, dismissed, filters)).toEqual([]);
    expect(visibleActivity(newer, dismissed, filters).map((item) => item.session.key)).toEqual(["core:agent"]);
  });

  test("an unavailable scope stays empty rather than exposing all activity", () => {
    const items = activityItems([session("core:agent", "working", 300)], []);

    expect(filterActivity(items, { machine: "missing-core", space: null })).toEqual([]);
    expect(filterActivity(items, { machine: null, space: "missing-space" })).toEqual([]);
  });

  test("handles missing change timestamps and duplicate keys deterministically", () => {
    const result = activityItems([session("b", "working"), session("a", "working"), session("a", "error")], []);
    expect(result.map(({ session: item }) => item.key)).toEqual(["a", "b"]);
    expect(result[0].kind).toBe("error");
    expect(result[0].changedAt).toBe(100);
  });
});
