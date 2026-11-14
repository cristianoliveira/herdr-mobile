// A home's files, read as a definition: settings, layouts and mods, with
// what's wrong with each. Error keys name the .error file the app writes:
// "settings" → settings.error, "layouts/main" → layouts/main.error, "mods/prs" → mods/prs.error.
import { validateLayout, type Layout } from "./layout";

export type Settings = { layout: string; theme: Record<string, string> };
export type ModInfo = { name: string; files: Record<string, string>; meta: { title?: string; icon?: string } };
export type Definition = {
  settings: Settings;
  layouts: Record<string, Layout>;
  mods: Record<string, ModInfo>;
  errors: Record<string, string>;
};

export const DEFAULT_SETTINGS: Settings = { layout: "main", theme: {} };

/** The files that make up a definition, as DefinitionSync lists them. */
export function isDefinitionPath(path: string): boolean {
  if (path.split("/").some((p) => p.startsWith(".")) || path.endsWith(".error")) return false;
  return path === "settings.json" || /^layouts\/[^/]+\.json$/.test(path) || /^mods\/[^/]+\/.+/.test(path);
}

function parseJson(text: string): { value?: unknown; error?: string } {
  try {
    return { value: JSON.parse(text) };
  } catch (e) {
    return { error: `not valid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
}

function settingsOf(text: string | undefined): { settings: Settings; error?: string } {
  if (text === undefined) return { settings: DEFAULT_SETTINGS };
  const p = parseJson(text);
  if (p.error) return { settings: DEFAULT_SETTINGS, error: p.error };
  const v = p.value as any;
  const errors: string[] = [];
  if (!v || typeof v !== "object" || Array.isArray(v)) return { settings: DEFAULT_SETTINGS, error: "needs an object" };
  for (const k of Object.keys(v)) if (k !== "layout" && k !== "theme") errors.push(`unknown field "${k}" (allowed: layout, theme)`);
  if (v.layout !== undefined && typeof v.layout !== "string") errors.push("layout: needs the name of a file in layouts/");
  if (v.theme !== undefined && (typeof v.theme !== "object" || Array.isArray(v.theme) || Object.values(v.theme).some((c) => typeof c !== "string")))
    errors.push('theme: needs { "<color name>": "#rrggbb" }');
  if (errors.length) return { settings: DEFAULT_SETTINGS, error: errors.join("\n") };
  return { settings: { layout: v.layout ?? "main", theme: v.theme ?? {} } };
}

export function parseDefinition(files: Record<string, string>): Definition {
  const errors: Record<string, string> = {};
  const mods: Record<string, ModInfo> = {};
  for (const [path, text] of Object.entries(files)) {
    const m = path.match(/^mods\/([^/]+)\/(.+)$/);
    if (!m || !isDefinitionPath(path)) continue;
    (mods[m[1]] ??= { name: m[1], files: {}, meta: {} }).files[m[2]] = text;
  }
  for (const mod of Object.values(mods)) {
    if (mod.files["mod.json"] !== undefined) {
      const p = parseJson(mod.files["mod.json"]);
      const v = p.value as any;
      if (p.error) errors[`mods/${mod.name}`] = `mod.json: ${p.error}`;
      else if (!v || typeof v !== "object" || Array.isArray(v)) errors[`mods/${mod.name}`] = "mod.json: needs an object";
      else mod.meta = { title: typeof v.title === "string" ? v.title : undefined, icon: typeof v.icon === "string" ? v.icon : undefined };
    }
    if (mod.files["main.js"] === undefined) errors[`mods/${mod.name}`] = "has no main.js";
  }
  const names = new Set(Object.keys(mods));
  const layouts: Record<string, Layout> = {};
  for (const [path, text] of Object.entries(files)) {
    const m = path.match(/^layouts\/([^/]+)\.json$/);
    if (!m) continue;
    const p = parseJson(text);
    if (p.error) {
      errors[`layouts/${m[1]}`] = p.error;
      continue;
    }
    const { layout, errors: problems } = validateLayout(p.value, names);
    if (layout) layouts[m[1]] = layout;
    else errors[`layouts/${m[1]}`] = problems.join("\n");
  }
  const s = settingsOf(files["settings.json"]);
  if (s.error) errors.settings = s.error;
  if (!s.error && !layouts[s.settings.layout] && !errors[`layouts/${s.settings.layout}`])
    errors.settings = `layout: there is no layouts/${s.settings.layout}.json`;
  return { settings: s.settings, layouts, mods, errors };
}
