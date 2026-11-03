import type { Session } from "../hc/fleet";
import { colors } from "./theme";

export function statusColor(state: string | undefined): string {
  switch (state) {
    case "working":
      return colors.working;
    case "blocked":
      return colors.blocked;
    case "error":
      return colors.error;
    case "done":
    case "idle":
      return colors.done;
    default:
      return colors.idle;
  }
}

/** What a person would call it: its name, the agent's own title, or the program. */
export function sessionTitle(s: Session): string {
  const t = s.terminal;
  return t.name || t.status?.title || t.title || t.foreground?.name || t.argv[0] || t.address;
}

function folderOf(s: Session): string {
  return s.terminal.foreground?.cwd || s.terminal.cwd;
}

/** /home/me/x and /Users/me/x both read as ~/x. */
export function shortPath(path: string): string {
  return path.replace(/^\/(home|Users)\/[^/]+/, "~");
}

export function ago(ms: number | null | undefined, now = Date.now()): string {
  if (!ms) return "";
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** The folder's last part: the project. */
export function projectName(s: Session): string {
  const path = folderOf(s).replace(/\/+$/, "");
  return shortPath(path) === "~" ? "~" : path.slice(path.lastIndexOf("/") + 1) || "/";
}

/** What it is doing: the agent's title, the terminal's title, or its name. */
export function taskName(s: Session): string {
  const t = s.terminal;
  const title = t.status?.title || t.title || t.name || "";
  return title === projectName(s) ? "" : title;
}

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

export function agents(sessions: Session[]): Session[] {
  const changed = (s: Session) => s.terminal.status_ms ?? s.terminal.created_ms;
  return sessions
    .filter((s) => s.terminal.state === "live" && !!s.terminal.status)
    .sort((a, b) => rank(a.terminal.status?.state) - rank(b.terminal.status?.state) || changed(b) - changed(a));
}

export const needsYou = (s: Session) => s.terminal.state === "live" && (s.terminal.status?.state === "blocked" || s.terminal.status?.state === "error");
