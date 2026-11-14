// Data check.mjs and tests render mods with: two machines, three spaces, a
// sub-agent, every status. Shaped like what the app gives (src/mods/data-types.ts).
import type { AgentData, AppData, TerminalData } from "./data-types";
import { BASE_THEME } from "./theme";

const now = 1_760_000_000_000;

const program = (key: string, name: string, agent: boolean) => ({ key, name, icon: agent ? `icons/${key}.svg` : "icons/shell.svg", tint: true, agent });

function term(address: string, machine: string, space: string | null, tab: string | null, extra: Partial<TerminalData> = {}): TerminalData {
  return {
    address,
    machine,
    space,
    tab,
    name: null,
    title: "",
    cwd: "/home/me/workspace/me/app",
    state: "live",
    status: null,
    message: "",
    statusAt: null,
    createdAt: now - 3_600_000,
    turn: 0,
    parent: null,
    labels: space ? { "herdr.space": space, "herdr.tab": tab ?? "" } : {},
    argv: ["zsh"],
    program: program("shell", "Shell", false),
    ...extra,
  };
}

const terminals: TerminalData[] = [
  term("c1:t1", "server", "sp1", "tb1", { status: "working", message: "Running tests", title: "pi", program: program("pi", "Pi", true), argv: ["pi"], statusAt: now - 60_000, turn: 3 }),
  term("c1:t2", "server", "sp1", "tb2", { title: "nvim", program: program("nvim", "Neovim", false), argv: ["nvim"] }),
  term("c1:t3", "server", "sp2", "tb3", { status: "blocked", message: "Allow running npm test?", title: "claude", program: program("claude", "Claude Code", true), argv: ["claude"], statusAt: now - 120_000 }),
  term("c1:t4", "server", null, null, { status: "done", message: "Wrote the report", program: program("pi", "Pi", true), parent: "c1:t1", argv: ["pi"], statusAt: now - 30_000 }),
  term("c2:t1", "vps", "sp3", "tb4", { status: "idle", title: "pi", program: program("pi", "Pi", true), argv: ["pi"], statusAt: now - 7_200_000, cwd: "/srv/api" }),
];

const spaceName: Record<string, string> = { sp1: "app", sp2: "app-login-fix", sp3: "api" };

const agents: AgentData[] = terminals
  .filter((t) => t.status)
  .map((t) => ({ ...t, status: t.status!, space: t.space ?? "sp1", space_name: spaceName[t.space ?? "sp1"] }));

export const SAMPLE_DATA: AppData = {
  machines: [
    { name: "server", state: "connected", error: null, definition: true },
    { name: "vps", state: "connected", error: null, definition: false },
    { name: "laptop", state: "offline", error: "asleep", definition: false },
  ],
  spaces: [
    { id: "sp1", machine: "server", name: "app", named: false, folder: "/home/me/workspace/me/app", status: "working", tabs: [
      { id: "tb1", name: "", named: false, terminals: ["c1:t1"], status: "working" },
      { id: "tb2", name: "editor", named: true, terminals: ["c1:t2"], status: null },
    ] },
    { id: "sp2", machine: "server", name: "app-login-fix", named: false, folder: "/home/me/.herdr/worktrees/app/login-fix", status: "blocked", tabs: [
      { id: "tb3", name: "", named: false, terminals: ["c1:t3"], status: "blocked" },
    ] },
    { id: "sp3", machine: "vps", name: "api", named: true, folder: "/srv/api", status: "idle", tabs: [
      { id: "tb4", name: "", named: false, terminals: ["c2:t1"], status: "idle" },
    ] },
  ],
  agents,
  terminals,
  settings: { fontSize: 12, dark: true },
  theme: BASE_THEME,
  safeArea: { top: 48, bottom: 24, left: 0, right: 0 },
  shared: {},
  commands: [],
  layout: null,
};
