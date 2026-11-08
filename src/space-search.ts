import type { Session } from "./hc/fleet";
import { agentTitle } from "./session-title";
import { coreOf, type Space } from "./spaces";

export type SpaceSearchScope = { kind: "all" } | { kind: "machine"; coreId: string } | { kind: "space"; key: string };
export type SpaceSearchResults = { spaces: Space[]; loose: Session[] };

export function searchSpaces(spaces: Space[], loose: Session[], query: string, scope: SpaceSearchScope): SpaceSearchResults {
  const needle = query.trim().toLowerCase();
  const machineAllowed = (coreId: string) => scope.kind === "all" || (scope.kind === "machine" && coreId === scope.coreId);
  const scopedSpaces = scope.kind === "space"
    ? spaces.filter((space) => space.key === scope.key)
    : spaces.filter((space) => machineAllowed(space.target.coreId));
  const resultSpaces = scopedSpaces.flatMap((space) => {
    if (!needle || space.name.toLowerCase().includes(needle)) return [space];
    const agents = space.agents.filter((session) => matches(session, needle));
    return agents.length ? [{ ...space, agents }] : [];
  });
  const scopedLoose = scope.kind === "space" ? [] : loose.filter((session) => machineAllowed(coreOf(session.key)));
  return { spaces: resultSpaces, loose: !needle ? scopedLoose : scopedLoose.filter((session) => matches(session, needle)) };
}

function matches(session: Session, needle: string): boolean {
  const terminal = session.terminal;
  const searchable = [agentTitle(session), terminal.name, terminal.title, terminal.status?.title, terminal.status?.msg]
    .filter(Boolean).join(" ").toLowerCase();
  return searchable.includes(needle);
}
