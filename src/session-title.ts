import type { Session } from "./hc/fleet";

export function sessionTitle(session: Session): string {
  const terminal = session.terminal;
  return terminal.name || terminal.status?.title || terminal.title || terminal.foreground?.name || terminal.argv[0] || terminal.address;
}

export function agentTitle(session: Session): string {
  const terminal = session.terminal;
  const raw = terminal.status?.title || terminal.title || terminal.name || terminal.status?.app || terminal.argv[0]?.split("/").pop() || sessionTitle(session);
  const folder = terminal.cwd.replace(/\/+$/, "");
  const base = folder.slice(folder.lastIndexOf("/") + 1);
  const trimmed = raw.replace(/^\S{1,2}\s+-\s+/, "").replace(new RegExp(` - ${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "");
  return trimmed || raw;
}
