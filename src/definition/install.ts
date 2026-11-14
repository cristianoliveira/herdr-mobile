// Puts the shipped home on the definition machine, by desktop's rules:
// shipped files are replaced on every connect; one the person edited is first
// moved to a personal copy (mods/<name>-edited, layouts/<name>-edited.json);
// a shipped file no longer shipped goes if untouched. App files (AGENTS.md,
// the .d.ts files, check.mjs, icons/) are simply kept current.
import { cksum } from "./cksum";

export type Installed = { files: Record<string, string> };

export type InstallPlan = {
  /** Shipped files to write. */
  write: string[];
  /** Folders and files to move aside first: [from, to]. */
  rescue: [string, string][];
  /** Files to delete. */
  remove: string[];
  installed: Installed;
};

const isDefinition = (path: string) => path.startsWith("mods/") || path.startsWith("layouts/");
const modOf = (path: string) => path.match(/^mods\/([^/]+)\//)?.[1] ?? null;

/** The first free "<name>-edited", "<name>-edited-2", ... */
function freeName(taken: (name: string) => boolean, name: string): string {
  for (let i = 1; ; i++) {
    const n = i === 1 ? `${name}-edited` : `${name}-edited-${i}`;
    if (!taken(n)) return n;
  }
}

/**
 * shipped: path → content. remote: path → cksum of what's there now.
 * installed: what the app wrote last time.
 */
export function planInstall(shipped: Record<string, string>, remote: Record<string, string>, installed: Installed): InstallPlan {
  const want: Record<string, string> = {};
  for (const [p, text] of Object.entries(shipped)) want[p] = cksum(text);
  const before = installed.files;
  const plan: InstallPlan = { write: [], rescue: [], remove: [], installed: { files: { ...want } } };

  // Edited: there, not what we wrote last time, and not what we ship now.
  const edited = (p: string) => p in remote && remote[p] !== want[p] && remote[p] !== before[p];

  // Mods are rescued whole: an edit or an added file in a shipped mod's folder.
  const shippedMods = new Set(Object.keys(shipped).map(modOf).filter((m): m is string => !!m));
  const rescuedMods = new Set<string>();
  for (const mod of shippedMods) {
    const there = Object.keys(remote).filter((p) => modOf(p) === mod);
    const touched = there.some((p) => (p in want ? edited(p) : !(p in before)));
    if (touched) rescuedMods.add(mod);
  }
  const takenMod = (n: string) => Object.keys(remote).some((p) => modOf(p) === n);
  for (const mod of rescuedMods) plan.rescue.push([`mods/${mod}`, `mods/${freeName(takenMod, mod)}`]);

  for (const p of Object.keys(want)) {
    const mod = modOf(p);
    if (mod && rescuedMods.has(mod)) {
      plan.write.push(p);
      continue;
    }
    if (remote[p] === want[p]) continue;
    if (isDefinition(p) && !mod && edited(p)) {
      const name = p.replace(/^layouts\//, "").replace(/\.json$/, "");
      const takenLayout = (n: string) => `layouts/${n}.json` in remote;
      plan.rescue.push([p, `layouts/${freeName(takenLayout, name)}.json`]);
    }
    plan.write.push(p);
  }

  // No longer shipped: gone if untouched, kept (as theirs) if edited.
  for (const [p, sum] of Object.entries(before)) {
    if (p in want) continue;
    if (remote[p] === sum) plan.remove.push(p);
  }
  return plan;
}
