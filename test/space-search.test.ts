import { describe, expect, test } from "vitest";
import type { Session, Target } from "../src/hc/fleet";
import type { Space } from "../src/spaces";
import { searchSpaces } from "../src/space-search";

function session(key: string, title: string, message = "", machine = "Machine A"): Session {
  return {
    key, parentKey: null, machine, linkId: "link", address: key,
    terminal: {
      address: key, argv: ["agent"], cwd: "/work", state: "live", created_ms: 1,
      status: { state: "working", title, msg: message }, labels: {}, cols: 80, rows: 24,
    },
  };
}

function space(coreId: string, id: string, name: string, agents: Session[], label = coreId): Space {
  const target: Target = { coreId, label, linkId: "link" };
  return { key: `${coreId}:${id}`, target, id, name, folder: `/work/${id}`, factory: false, agents };
}

const build = () => {
  const first = session("core-a:one", "Build agent", "Compiling release");
  const sibling = session("core-a:two", "Review agent", "Waiting for approval");
  const secondMachine = session("core-b:three", "Docs agent", "Writing guide", "Machine B");
  const project = space("core-a", "project", "Herdr Mobile", [first, sibling], "Machine A");
  const otherProject = space("core-b", "docs", "Documentation", [secondMachine], "Machine B");
  const loose = session("core-a:loose", "Shell", "Idle shell");
  return { spaces: [project, otherProject], loose: [loose], project, otherProject, first, sibling, secondMachine, looseAgent: loose };
};

describe("searchSpaces", () => {
  test("empty query returns scoped contents in original order without mutation", () => {
    const data = build();
    const originalSpaces = [...data.spaces];
    const originalAgents = [...data.project.agents];

    const result = searchSpaces(data.spaces, data.loose, "  ", { kind: "all" });

    expect(result.spaces).toEqual(data.spaces);
    expect(result.loose).toEqual(data.loose);
    expect(data.spaces).toEqual(originalSpaces);
    expect(data.project.agents).toEqual(originalAgents);
  });

  test("matching a space name reveals all its agents while preserving the heading", () => {
    const data = build();
    const result = searchSpaces(data.spaces, data.loose, "MOBILE", { kind: "all" });

    expect(result.spaces).toEqual([data.project]);
    expect(result.spaces[0].agents).toEqual([data.first, data.sibling]);
    expect(result.loose).toEqual([]);
  });

  test("matches agent titles and status messages case-insensitively with contextual space", () => {
    const data = build();
    expect(searchSpaces(data.spaces, data.loose, "review AGENT", { kind: "all" }).spaces[0].agents).toEqual([data.sibling]);
    expect(searchSpaces(data.spaces, data.loose, "APPROVAL", { kind: "all" }).spaces[0].agents).toEqual([data.sibling]);
  });

  test("includes loose agents and scopes machine identity by core ID", () => {
    const data = build();
    const result = searchSpaces(data.spaces, data.loose, "shell", { kind: "machine", coreId: "core-a" });

    expect(result.spaces).toEqual([]);
    expect(result.loose).toEqual([data.looseAgent]);
    expect(searchSpaces(data.spaces, data.loose, "", { kind: "machine", coreId: "missing" })).toEqual({ spaces: [], loose: [] });
  });

  test("specific space scope excludes sibling spaces and loose agents", () => {
    const data = build();
    const result = searchSpaces(data.spaces, data.loose, "", { kind: "space", key: data.otherProject.key });

    expect(result.spaces).toEqual([data.otherProject]);
    expect(result.loose).toEqual([]);
    expect(searchSpaces(data.spaces, data.loose, "", { kind: "space", key: "missing" })).toEqual({ spaces: [], loose: [] });
  });

  test("treats regex punctuation as literal text", () => {
    const data = build();
    data.first.terminal.status!.msg = "Build [release]+ (fast)";

    expect(searchSpaces(data.spaces, data.loose, "[release]+", { kind: "all" }).spaces[0].agents).toEqual([data.first]);
  });

  test("matches terminal-name aliases and the same extracted title shown in rows", () => {
    const data = build();
    data.first.terminal.name = "Alternate label";
    data.first.terminal.status!.title = "AI - Build agent - project";
    data.first.terminal.cwd = "/work/project";

    expect(searchSpaces(data.spaces, data.loose, "alternate label", { kind: "all" }).spaces[0].agents).toEqual([data.first]);
    expect(searchSpaces(data.spaces, data.loose, "Build agent", { kind: "all" }).spaces[0].agents).toEqual([data.first]);
  });

  test("returns empty results when query matches nothing", () => {
    const data = build();
    expect(searchSpaces(data.spaces, data.loose, "not present", { kind: "all" })).toEqual({ spaces: [], loose: [] });
  });
});
