// What the app does for mods: their host calls (run, exec, files, agents,
// fetch) and the command context commands act through.
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { runCommand, type CommandContext } from "../commands";
import { definitionCommands, definitionTarget } from "../definition/controller";
import { fleet } from "../fleet-store";
import { toBase64, utf8Encode } from "../hc/bytes";
import type { Target } from "../hc/fleet";
import { presize } from "../terminal/presize";
import { fleetData, KNOWN_AGENTS } from "./data";
import { selectTab } from "./nav";
import { openOverlay } from "./overlays";

let screens = 0;

export const commandContext: CommandContext = {
  fleet,
  data: () => fleetData({ snapshot: fleet.snapshot(), targets: fleet.targets(), definitionLink: null }),
  nav: {
    openScreen: (mod, props, title) => router.push({ pathname: "/screen/[id]", params: { id: String(++screens), mod, props: JSON.stringify(props ?? {}), title: title ?? "" } }),
    back: () => (router.canGoBack() ? router.back() : router.replace("/")),
    selectTab,
    showTerminal: (terminal) => router.push({ pathname: "/session/[key]", params: { key: terminal } }),
    settings: () => router.push("/settings"),
    machines: () => router.push("/machines"),
  },
  confirm: (title, detail, command) => openOverlay({ id: `confirm${Date.now()}`, mod: "confirm", kind: "dialog", title: null, props: { title, detail, command } }),
  clipboard: async (text) => void (await Clipboard.setStringAsync(text)),
  presize,
  definition: definitionCommands,
};

export const run = (name: string, args: Record<string, unknown> = {}) => runCommand(commandContext, name, args);

/** A machine by name; without one, the definition machine. */
function target(on: unknown): Target {
  if (typeof on === "string" && on) {
    const t = fleet.targets().find((x) => x.label === on);
    if (!t) throw new Error(`${on} is not connected`);
    return t;
  }
  const t = definitionTarget();
  if (!t) throw new Error("the definition machine is not connected; pass { on: <machine> }");
  return t;
}

const probe = (cmds: string[]) => `for c in ${cmds.map((c) => `'${c.replace(/'/g, "")}'`).join(" ")}; do command -v "$c" >/dev/null 2>&1 && echo "$c"; done; true`;

export async function hostCall(name: string, args: any[]): Promise<unknown> {
  switch (name) {
    case "run":
      return run(String(args[0]), args[1] ?? {});
    case "exec": {
      const [cmd, argv = [], opts = {}] = args;
      const r = await fleet.exec(target(opts.on), [String(cmd), ...argv.map(String)], opts.cwd);
      return { code: r.code, stdout: r.stdout, stderr: r.stderr };
    }
    case "readTextFile": {
      const [path, opts = {}] = args;
      const r = await fleet.call<{ text: string }>(target(opts.on), "file.read", { path: String(path) });
      return r.text;
    }
    case "writeTextFile": {
      const [path, text, opts = {}] = args;
      await fleet.call(target(opts.on), "file.write", { path: String(path), data: toBase64(utf8Encode(String(text))) });
      return null;
    }
    case "knownAgents": {
      const [opts = {}] = args;
      const r = await fleet.exec(target(opts.on), ["sh", "-c", probe(KNOWN_AGENTS.map((a) => a.run[0]))]);
      const installed = new Set(r.stdout.split("\n").filter(Boolean));
      return KNOWN_AGENTS.map((a) => ({ ...a, installed: installed.has(a.run[0]) })).sort((a, b) => Number(b.installed) - Number(a.installed));
    }
    case "fetch": {
      const [url, init = {}] = args;
      const r = await fetch(String(url), { method: init.method, headers: init.headers, body: init.body });
      const headers: Record<string, string> = {};
      r.headers.forEach((v, k) => (headers[k] = v));
      return { status: r.status, headers, body: await r.text() };
    }
    default:
      throw new Error(`unknown host call ${name}`);
  }
}
