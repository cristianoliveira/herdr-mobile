// herdr: what Herdr Mobile tells a mod and what a mod asks of it.
// Written by Herdr Mobile on every connect. Edits here are overwritten.

export type Status = "working" | "blocked" | "done" | "idle";

/** How a program shows: a name, an icon in the home, whether the icon is a one-color glyph (svg) or a picture (image). */
export type Program = { key: string; name: string; icon: string | null; tint: boolean; agent: boolean };

export type Machine = {
  name: string;
  state: "connecting" | "connected" | "offline";
  error: string | null;
  /** The machine holding this definition. */
  definition: boolean;
};

export type Terminal = {
  /** Opaque: what commands take as `terminal`. */
  address: string;
  machine: string;
  space: string | null;
  tab: string | null;
  name: string | null;
  title: string;
  /** Its live folder. */
  cwd: string;
  state: "live" | "finished";
  /** null: not an agent. */
  status: Status | null;
  /** What the agent last said about itself. */
  message: string;
  statusAt: number | null;
  createdAt: number;
  /** Counts finished turns: when it moves, the agent just finished one. */
  turn: number;
  /** The terminal that started this one (a sub-agent's parent). */
  parent: string | null;
  labels: Record<string, string>;
  argv: string[];
  program: Program;
};

/** A live terminal that reports a status. */
export type Agent = Terminal & { status: Status; space_name: string };

export type Tab = { id: string; name: string; named: boolean; terminals: string[]; status: Status | null };

export type Space = {
  id: string;
  machine: string;
  /** Its name, or, unnamed, where its first terminal is now. */
  name: string;
  named: boolean;
  folder: string;
  tabs: Tab[];
  /** The most urgent of its agents: blocked > done > working > idle. */
  status: Status | null;
};

// Live data: read them in render(); the mod draws again when they change.
export declare function spaces(): Space[];
export declare function agents(): Agent[];
export declare function terminals(): Terminal[];
export declare function machines(): Machine[];
export declare function settings(): { fontSize: number; dark: true };
/** Colors by desktop's names: background, canvas, chrome, surface, popover, raised, hover, selected, border, input, foreground, muted, dim, accent, accent_foreground, solid, solid_foreground, selection, working, blocked, done, idle, unknown, ansi0..ansi15. */
export declare function theme(): Record<string, string>;
/** The phone's insets, for a mod that draws edge to edge. */
export declare function safeArea(): { top: number; bottom: number; left: number; right: number };
/** The layout shown. */
export declare function layout(): unknown;
/** Every command: its arguments and what it does. */
export declare function commands(): { name: string; args: Record<string, "required" | "optional">; doc: string }[];
/** This copy's props (from the layout, screen.open or openOverlay); an overlay's has `overlay`, its id. */
export declare function props(): any;

/** State every mod on this phone shares, kept across restarts. Setting it draws every mod again. */
export declare function shared<T = unknown>(key: string): T | undefined;
export declare function setShared(key: string, value: unknown): void;

/** Runs a command (see commands()); resolves with what it returns, rejects with what went wrong. */
export declare function run(command: string, args?: Record<string, unknown>): Promise<any>;
/** Runs a program on a machine (default: the definition machine). */
export declare function exec(cmd: string, args?: string[], options?: { cwd?: string; on?: string }): Promise<{ code: number | null; stdout: string; stderr: string }>;
export declare function readTextFile(path: string, options?: { on?: string }): Promise<string>;
export declare function writeTextFile(path: string, text: string, options?: { on?: string }): Promise<void>;
/** The agents people can start (Pi, Claude Code, ...), installed ones first; start one with run("tab.new", { space, argv: agent.run }). */
export declare function knownAgents(options?: { on?: string }): Promise<(Program & { run: string[]; installed: boolean })[]>;

/** Opens a mod over the screen: a sheet from the bottom, or a dialog. Returns its id; the mod gets it as props().overlay. */
export declare function openOverlay(options: { mod: string; props?: Record<string, unknown>; kind?: "sheet" | "dialog"; title?: string }): string;
/** Closes an overlay (null: the one this copy is in). */
export declare function closeOverlay(id?: string | null): void;
/** A toast at the top; tapping it runs action. */
export declare function notify(options: { title: string; body?: string; level?: "info" | "success" | "warning" | "error"; action?: { name: string; args?: Record<string, unknown> }; timeout?: number }): void;

// Also there: console.log/warn/error (to the app's log), localStorage (per mod copy),
// fetch (text and JSON). Not there: setTimeout and setInterval (use cx.timer), Intl,
// structuredClone, Node and browser APIs.
