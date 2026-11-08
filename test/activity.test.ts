import { describe, expect, test } from "vitest";
import type { Session } from "../src/hc/fleet";
import { activityItems, activityKind } from "../src/activity";
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

  test("handles missing change timestamps and duplicate keys deterministically", () => {
    const result = activityItems([session("b", "working"), session("a", "working"), session("a", "error")], []);
    expect(result.map(({ session: item }) => item.key)).toEqual(["a", "b"]);
    expect(result[0].kind).toBe("error");
    expect(result[0].changedAt).toBe(100);
  });
});
