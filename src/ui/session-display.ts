import { colors } from "./theme";
export { agentTitle, sessionTitle } from "../session-title";

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
