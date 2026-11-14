// Checks a herdr-mobile home the way the phone loads it: settings, every
// layout, and every mod loaded, started and drawn once with sample data.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { isDefinitionPath, parseDefinition } from "../definition/definition";
import { ModCopy } from "../mods/copy";
import type { UINode } from "../mods/description";
import type { EngineError, EngineFactory } from "../mods/engine";
import { SAMPLE_DATA } from "../mods/sample-data";

export type CheckResult = { problems: string[]; mods: number; layouts: number };

/** Every definition file under `home`, keyed by its path in the home. */
export function readHome(home: string): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (dir: string) => {
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      const full = join(dir, name);
      const path = relative(home, full).split(sep).join("/");
      if (name.startsWith(".")) continue;
      if (statSync(full).isDirectory()) walk(full);
      else if (isDefinitionPath(path)) files[path] = readFileSync(full, "utf8");
    }
  };
  walk(join(home, "layouts"));
  walk(join(home, "mods"));
  try {
    files["settings.json"] = readFileSync(join(home, "settings.json"), "utf8");
  } catch {}
  return files;
}

const where = (mod: string, e: EngineError) => (e.file ? `mods/${mod}/${e.file}${e.line ? `:${e.line}` : ""}` : `mods/${mod}`);

const KINDS = new Set(["b", "svg", "img", "icon", "input"]);

/** What's wrong with a description, or null. */
export function describeProblem(n: UINode, at = "render()"): string | null {
  if (typeof n === "string") return null;
  if (!n || typeof n !== "object" || !KINDS.has(n.t)) return `${at}: not an element`;
  if ((n.t === "svg" || n.t === "img") && !n.path) return `${at}: ${n.t} needs a path`;
  if (n.t === "icon" && !n.name) return `${at}: icon needs a name`;
  for (const [i, c] of (n.k ?? []).entries()) {
    const p = describeProblem(c, `${at}.child[${i}]`);
    if (p) return p;
  }
  return null;
}

export async function checkHome(home: string, engine: EngineFactory, runtime: Record<string, string>, only?: string[]): Promise<CheckResult> {
  const def = parseDefinition(readHome(home));
  const problems = Object.entries(def.errors).map(([k, v]) => `${k === "settings" ? "settings.json" : k.startsWith("layouts/") ? `${k}.json` : k}: ${v.replace(/\n/g, `\n${" ".repeat(k.length + 2)}`)}`);
  const names = Object.keys(def.mods).filter((m) => !only?.length || only.includes(m));
  for (const name of names) {
    if (def.errors[`mods/${name}`]) continue;
    const errors: EngineError[] = [];
    const copy = new ModCopy(
      name,
      { engine, runtime, call: async () => null, post: (m) => void (m.t === "error" && errors.push(m.error)) },
      () => ({ ...SAMPLE_DATA, props: {} }),
      {},
      () => {},
    );
    const ok = await copy.load(def.mods[name].files);
    const state = copy.current;
    await copy.close();
    if (!ok && state.error) problems.push(`${where(name, state.error)}: ${state.error.message}`);
    else if (state.description !== null) {
      const p = describeProblem(state.description);
      if (p) problems.push(`mods/${name}: ${p}`);
    }
    for (const e of errors) problems.push(`${where(name, e)}: ${e.message}`);
  }
  return { problems, mods: names.length, layouts: Object.keys(def.layouts).length };
}
