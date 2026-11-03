import type { HerdrDoc, Session, Target } from "./hc/fleet";

export type Space = {
  key: string;
  target: Target;
  id: string;
  name: string;
  folder: string;
  factory: boolean;
  agents: Session[];
};

export const coreOf = (key: string) => key.slice(0, key.lastIndexOf(":"));

const isAgent = (s: Session) => s.terminal.state === "live" && !!s.terminal.status;

function rank(state: string | undefined): number {
  switch (state) {
    case "blocked":
    case "error":
      return 0;
    case "idle":
    case "done":
      return 1;
    case "working":
      return 2;
    default:
      return 3;
  }
}

const changed = (s: Session) => s.terminal.status_ms ?? s.terminal.created_ms;

export function byUrgency(a: Session, b: Session): number {
  return rank(a.terminal.status?.state) - rank(b.terminal.status?.state) || changed(b) - changed(a);
}

export function folderName(folder: string): string {
  const path = folder.replace(/\/+$/, "");
  if (/^\/(home|Users)\/[^/]+$/.test(path) || path === "/root") return "~";
  return path.slice(path.lastIndexOf("/") + 1) || "/";
}

function family(agents: Session[]): Session[] {
  const keys = new Set(agents.map((s) => s.key));
  const children = new Map<string, Session[]>();
  for (const s of agents) {
    if (s.parentKey && keys.has(s.parentKey)) children.set(s.parentKey, [...(children.get(s.parentKey) ?? []), s]);
  }
  const out: Session[] = [];
  const walk = (s: Session) => {
    out.push(s);
    for (const c of children.get(s.key) ?? []) walk(c);
  };
  for (const s of agents) if (!s.parentKey || !keys.has(s.parentKey)) walk(s);
  return out;
}

export function spaces(docs: Record<string, HerdrDoc | null>, targets: Target[], sessions: Session[]): { spaces: Space[]; loose: Session[] } {
  const byKey = new Map(sessions.map((s) => [s.key, s]));
  const out = new Map<string, Space>();
  const make = (target: Target, id: string, name: string, folder: string): Space => {
    const key = `${target.coreId}:${id}`;
    let space = out.get(key);
    if (!space) {
      space = { key, target, id, name: name || folderName(folder), folder, factory: id.startsWith("factory-"), agents: [] };
      out.set(key, space);
    }
    return space;
  };

  for (const target of targets) {
    for (const s of docs[target.coreId]?.spaces ?? []) {
      if (s.id) make(target, s.id, s.name ?? "", s.folder ?? "");
    }
  }

  const label = (s: Session) => s.terminal.labels?.["herdr.space"] || null;
  for (const s of sessions) {
    const id = label(s);
    const target = targets.find((t) => t.coreId === coreOf(s.key));
    if (id && target && s.terminal.state === "live") make(target, id, "", s.terminal.cwd);
  }

  const spaceOf = (s: Session): Space | undefined => {
    const seen = new Set<string>();
    let at: Session | undefined = s;
    while (at && !seen.has(at.key)) {
      seen.add(at.key);
      const id = label(at);
      if (id) return out.get(`${coreOf(at.key)}:${id}`);
      at = at.parentKey ? byKey.get(at.parentKey) : undefined;
    }
    return undefined;
  };

  const loose: Session[] = [];
  for (const s of sessions.filter(isAgent).sort(byUrgency)) {
    const space = spaceOf(s);
    if (space) space.agents.push(s);
    else loose.push(s);
  }

  for (const space of out.values()) space.agents = family(space.agents);

  const list = [...out.values()].sort(
    (a, b) => Number(a.factory) - Number(b.factory) || a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }),
  );
  return { spaces: list, loose };
}
