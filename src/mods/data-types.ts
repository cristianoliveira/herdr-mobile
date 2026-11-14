// What `herdr`'s live data calls return to a mod (spaces(), agents(), ...).
// The app builds it from its machines (src/mods/data.ts); check.mjs uses sample data.

export type Status = "working" | "blocked" | "done" | "idle";

/** How a program shows: its name, an icon in the home, whether the icon is a one-color glyph. */
export type Program = { key: string; name: string; icon: string | null; tint: boolean; agent: boolean };

export type MachineData = {
  name: string;
  state: "connecting" | "connected" | "offline";
  error: string | null;
  /** The machine holding this phone's definition. */
  definition: boolean;
};

export type TerminalData = {
  /** Opaque: what commands take as `terminal`. */
  address: string;
  machine: string;
  space: string | null;
  tab: string | null;
  name: string | null;
  title: string;
  cwd: string;
  state: "live" | "finished";
  /** The agent's state, or null for a terminal that isn't an agent. */
  status: Status | null;
  /** What the agent last said about itself. */
  message: string;
  statusAt: number | null;
  createdAt: number;
  /** Counts the agent's finished turns. */
  turn: number;
  /** The terminal that started this one. */
  parent: string | null;
  labels: Record<string, string>;
  argv: string[];
  program: Program;
};

/** A live terminal that reports a status, with its space's name. */
export type AgentData = TerminalData & { status: Status; space_name: string };

export type TabData = { id: string; name: string; named: boolean; terminals: string[]; status: Status | null };

export type SpaceData = {
  id: string;
  machine: string;
  name: string;
  named: boolean;
  folder: string;
  tabs: TabData[];
  /** The most urgent of its agents: blocked > done > working > idle. */
  status: Status | null;
};

export type AppData = {
  spaces: SpaceData[];
  agents: AgentData[];
  terminals: TerminalData[];
  machines: MachineData[];
  settings: { fontSize: number; dark: true };
  theme: Record<string, string>;
  safeArea: { top: number; bottom: number; left: number; right: number };
  shared: Record<string, unknown>;
  commands: { name: string; args: Record<string, string>; doc: string }[];
  layout: unknown;
};
