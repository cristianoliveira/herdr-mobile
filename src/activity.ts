import type { Session } from "./hc/fleet";
import { coreOf, type Space } from "./spaces";

export type ActivityKind = "waiting" | "error" | "completed" | "working" | "idle" | "unknown";
export type ActivityItem = {
  session: Session;
  kind: ActivityKind;
  changedAt: number | null;
  timeSource: "finished" | "status" | "started";
  space?: Space;
};

export function activityKind(session: Session): ActivityKind {
  const { state, exit_code } = session.terminal;
  if (state === "finished") return exit_code != null && exit_code !== 0 ? "error" : "completed";
  switch (session.terminal.status?.state) {
    case "blocked": return "waiting";
    case "error": return "error";
    case "done": return "completed";
    case "working": return "working";
    case "idle": return "idle";
    default: return "unknown";
  }
}

const priority = (kind: ActivityKind) => {
  if (kind === "waiting" || kind === "error") return 0;
  if (kind === "completed") return 1;
  return 2;
};

export function activityItems(sessions: Session[], spaces: Space[]): ActivityItem[] {
  const spaceByKey = new Map(spaces.map((space) => [space.key, space]));
  const spaceBySession = new Map(spaces.flatMap((space) => space.agents.map((session) => [session.key, space] as const)));
  const unique = new Map(sessions.map((session) => [session.key, session]));
  return [...unique.values()].map((session) => {
    const terminal = session.terminal;
    const timeSource: ActivityItem["timeSource"] = terminal.state === "finished" && terminal.finished_ms != null
      ? "finished"
      : terminal.status_ms != null ? "status" : "started";
    const changedAt = timeSource === "finished" ? terminal.finished_ms!
      : timeSource === "status" ? terminal.status_ms! : terminal.created_ms ?? null;
    const labeledSpace = terminal.labels?.["herdr.space"];
    const space = spaceBySession.get(session.key) ?? (labeledSpace ? spaceByKey.get(`${coreOf(session.key)}:${labeledSpace}`) : undefined);
    return { session, kind: activityKind(session), changedAt, timeSource, space };
  }).sort((a, b) => priority(a.kind) - priority(b.kind)
    || (b.changedAt ?? 0) - (a.changedAt ?? 0)
    || a.session.key.localeCompare(b.session.key));
}
