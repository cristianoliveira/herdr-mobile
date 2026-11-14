// Builds what mods read (spaces(), agents(), terminals(), machines()) from the
// fleet: each machine's herdr-app document for spaces, tabs and names, and the
// herdr.space / herdr.tab labels for terminals no document lists yet.
import type { FleetSnapshot, HerdrDoc, Session, Target } from "../hc/fleet";
import type { Terminal } from "../hc/types";
import type { AgentData, AppData, MachineData, Program, SpaceData, Status, TabData, TerminalData } from "./data-types";
import table from "./programs.json";

const RANK: Record<Status, number> = { blocked: 4, done: 3, working: 2, idle: 1 };

export function statusOf(t: Terminal): Status | null {
  const s = t.status?.state;
  if (!s || t.state !== "live") return null;
  if (s === "error") return "blocked";
  return s in RANK ? (s as Status) : null;
}

/** The more urgent of two: blocked > done > working > idle. */
export const urgent = (a: Status | null, b: Status | null): Status | null => ((a ? RANK[a] : 0) >= (b ? RANK[b] : 0) ? a : b);

type Entry = { name?: string; icon?: string; tint?: boolean; match?: string[]; run?: string[] };
const PROGRAMS = (table as { programs: Record<string, Entry> }).programs;
const SHELLS = new Set<string>((table as any).shells);
const INTERPRETERS = new Set<string>((table as any).interpreters);
const MATCH = new Map<string, string>();
for (const [k, e] of Object.entries(PROGRAMS)) {
  MATCH.set(k, k);
  for (const m of e.match ?? []) MATCH.set(m, k);
}

const base = (p: string) => p.slice(p.lastIndexOf("/") + 1).replace(/\.(exe|js|mjs|cjs|py)$/, "");

/** How a terminal shows: the agent's own report, else what runs in it. */
export function programOf(t: Terminal): Program {
  const agent = !!t.status;
  const app = t.status?.app?.toLowerCase();
  let key = app ? MATCH.get(app) : undefined;
  let name: string | undefined;
  if (!key) {
    const argv = t.foreground?.argv?.length ? t.foreground.argv : t.argv;
    let i = 0;
    name = base(argv[0] ?? "");
    while (INTERPRETERS.has(name) && i + 1 < argv.length) {
      i++;
      if (!argv[i].startsWith("-")) name = base(argv[i]);
    }
    key = SHELLS.has(name) ? "shell" : MATCH.get(name);
  }
  const e = key ? PROGRAMS[key] : undefined;
  if (!key || !e) return { key: "program", name: app || name || "Program", icon: PROGRAMS.program?.icon ?? null, tint: true, agent };
  return { key, name: e.name ?? key, icon: e.icon ?? null, tint: e.tint ?? true, agent: agent || !!e.run };
}

/** Agents people can start: the table's entries with a run command. */
export const KNOWN_AGENTS = Object.entries(PROGRAMS)
  .filter(([, e]) => e.run)
  .map(([key, e]) => ({ key, name: e.name ?? key, icon: e.icon ?? null, tint: e.tint ?? true, run: e.run! }));

/** A folder as a space is called after it: its last part, "~" at home. */
export function folderName(folder: string): string {
  const path = folder.replace(/\/+$/, "");
  if (/^\/(home|Users)\/[^/]+$/.test(path) || path === "/root") return "~";
  return path.slice(path.lastIndexOf("/") + 1) || "/";
}

const coreOf = (key: string) => key.slice(0, key.lastIndexOf(":"));

/** Terminal addresses in a desktop pane tree. */
export function terminalsIn(root: unknown): string[] {
  const out: string[] = [];
  const walk = (n: any) => {
    if (!n || typeof n !== "object") return;
    if (typeof n.content?.terminal === "string") out.push(n.content.terminal);
    for (const c of n.children ?? []) walk(c);
  };
  walk(root);
  return out;
}

export type DataInput = {
  snapshot: FleetSnapshot;
  targets: Target[];
  /** The link id of the definition machine. */
  definitionLink: string | null;
};

export type FleetData = Pick<AppData, "spaces" | "agents" | "terminals" | "machines">;

export function fleetData({ snapshot, targets, definitionLink }: DataInput): FleetData {
  const label = new Map(targets.map((t) => [t.coreId, t.label]));
  const byKey = new Map(snapshot.sessions.map((s) => [s.key, s]));

  // Spaces and tabs: documents first, in their order.
  type Place = { space: SpaceData; tab: TabData };
  const spaces: SpaceData[] = [];
  const spaceIndex = new Map<string, SpaceData>(); // coreId:spaceId
  const placeOf = new Map<string, Place>(); // terminal key → its pane's place
  for (const t of targets) {
    const doc: HerdrDoc | null | undefined = snapshot.docs[t.coreId];
    for (const s of doc?.spaces ?? []) {
      if (!s.id) continue;
      const space: SpaceData = { id: s.id, machine: t.label, name: s.name ?? "", named: !!s.name, folder: s.folder ?? "", tabs: [], status: null };
      for (const tab of s.tabs ?? []) {
        if (!tab.id) continue;
        const td: TabData = { id: tab.id, name: tab.name ?? "", named: !!tab.name, terminals: [], status: null };
        for (const addr of terminalsIn(tab.root)) {
          const key = `${t.coreId}:${addr}`;
          if (!byKey.has(key)) continue;
          td.terminals.push(key);
          placeOf.set(key, { space, tab: td });
        }
        space.tabs.push(td);
      }
      spaces.push(space);
      spaceIndex.set(`${t.coreId}:${s.id}`, space);
    }
  }

  // Labeled live terminals no document lists yet.
  for (const s of snapshot.sessions) {
    if (placeOf.has(s.key) || s.terminal.state !== "live") continue;
    const sid = s.terminal.labels?.["herdr.space"];
    if (!sid) continue;
    const core = coreOf(s.key);
    let space = spaceIndex.get(`${core}:${sid}`);
    if (!space) {
      space = { id: sid, machine: label.get(core) ?? s.machine, name: "", named: false, folder: s.terminal.cwd, tabs: [], status: null };
      spaces.push(space);
      spaceIndex.set(`${core}:${sid}`, space);
    }
    const tid = s.terminal.labels?.["herdr.tab"] || `${sid}-tab`;
    let tab = space.tabs.find((x) => x.id === tid);
    if (!tab) space.tabs.push((tab = { id: tid, name: "", named: false, terminals: [], status: null }));
    tab.terminals.push(s.key);
    placeOf.set(s.key, { space, tab });
  }

  // A terminal without a pane (a sub-agent) belongs where its parent does.
  const place = (key: string, seen = new Set<string>()): Place | undefined => {
    const p = placeOf.get(key);
    if (p || seen.has(key)) return p;
    seen.add(key);
    const parent = byKey.get(key)?.parentKey;
    return parent ? place(parent, seen) : undefined;
  };

  const terminals: TerminalData[] = snapshot.sessions.map((s: Session) => {
    const t = s.terminal;
    const p = place(s.key);
    return {
      address: s.key,
      machine: label.get(coreOf(s.key)) ?? s.machine,
      space: p?.space.id ?? null,
      tab: p?.tab.id ?? null,
      name: t.name ?? null,
      title: t.title ?? "",
      cwd: t.foreground?.cwd || t.cwd,
      state: t.state === "live" ? "live" : "finished",
      status: statusOf(t),
      message: t.status?.msg ?? "",
      statusAt: t.status_ms ?? null,
      createdAt: t.created_ms,
      turn: t.turn ?? 0,
      parent: s.parentKey,
      labels: t.labels ?? {},
      argv: t.argv,
      program: programOf(t),
    };
  });

  for (const term of terminals) {
    if (!term.status) continue;
    const p = place(term.address);
    if (!p) continue;
    p.tab.status = urgent(p.tab.status, term.status);
    p.space.status = urgent(p.space.status, term.status);
  }

  // Unnamed spaces are called after where their first terminal is now.
  const byAddress = new Map(terminals.map((t) => [t.address, t]));
  for (const space of spaces) {
    if (space.named) continue;
    const first = space.tabs.flatMap((t) => t.terminals).map((k) => byAddress.get(k)).find(Boolean);
    space.name = folderName(first?.cwd || space.folder || "~");
  }

  const order = new Map(spaces.map((s, i) => [s, i]));
  const agents: AgentData[] = terminals
    .filter((t): t is TerminalData & { status: Status } => !!t.status)
    .map((t) => {
      const p = place(t.address);
      return { ...t, space_name: p?.space.name ?? "" };
    })
    .sort((a, b) => {
      const pa = place(a.address), pb = place(b.address);
      return (pa ? order.get(pa.space)! : 1e9) - (pb ? order.get(pb.space)! : 1e9) || a.createdAt - b.createdAt;
    });

  const machines: MachineData[] = [];
  const seen = new Set<string>();
  for (const l of snapshot.links) {
    const name = l.core?.name ?? l.config.name;
    if (l.core) seen.add(l.core.id);
    machines.push({ name: label.get(l.core?.id ?? "") ?? name, state: l.state, error: l.error ?? null, definition: l.config.id === definitionLink });
  }
  for (const l of snapshot.links) {
    for (const m of l.machines) {
      if (seen.has(m.id) || m.temporary) continue;
      seen.add(m.id);
      machines.push({ name: label.get(m.id) ?? (m.host || m.name), state: m.state === "connected" ? "connected" : "offline", error: m.state === "connected" ? null : m.state, definition: false });
    }
  }

  return { spaces, agents, terminals, machines };
}
