// The phone's copy of the definition. It keeps the last good version of each
// layout and of settings.json, so a broken save never changes the screen, and
// tracks what each .error file on the definition machine should say.
import { DEFAULT_SETTINGS, isDefinitionPath, parseDefinition, type Definition, type ModInfo, type Settings } from "./definition";
import type { Layout } from "./layout";
import type { Changes } from "./sync";

export type Good = { settings: Settings; layouts: Record<string, Layout>; mods: Record<string, Record<string, string>> };

export type DefinitionView = {
  settings: Settings;
  layouts: Record<string, Layout>;
  mods: Record<string, ModInfo>;
  /** error key ("settings", "layouts/main", "mods/prs") → what's wrong. */
  errors: Record<string, string>;
  /** Bumps on every change. */
  version: number;
};

export type Saved = { files: Record<string, string>; good: Good };

export class DefinitionStore {
  private files: Record<string, string> = {};
  private def!: Definition;
  private good: Good = { settings: DEFAULT_SETTINGS, layouts: {}, mods: {} };
  private modErrors: Record<string, string> = {};
  private written: Record<string, string | null> = {};
  private view!: DefinitionView;
  private version = 0;
  private listeners = new Set<() => void>();

  constructor(saved: Saved) {
    this.files = Object.fromEntries(Object.entries(saved.files).filter(([p]) => isDefinitionPath(p)));
    this.good = saved.good;
    this.recompute();
  }

  /** Every file, as on the definition machine (a fresh start). */
  replace(files: Record<string, string>) {
    this.files = Object.fromEntries(Object.entries(files).filter(([p]) => isDefinitionPath(p)));
    this.recompute();
  }

  apply(changes: Changes) {
    for (const [p, text] of Object.entries(changes)) {
      if (text === null) delete this.files[p];
      else if (isDefinitionPath(p)) this.files[p] = text;
    }
    this.recompute();
  }

  get current(): DefinitionView {
    return this.view;
  }

  /** A mod's runtime error (load, render, a tap), or null when it's fine again. */
  setModError(name: string, message: string | null) {
    if ((this.modErrors[name] ?? null) === message) return;
    if (message === null) delete this.modErrors[name];
    else this.modErrors[name] = message;
    this.recompute();
  }

  /** A mod loaded: remember its files as its last good build. */
  markModGood(name: string, files: Record<string, string>) {
    if (JSON.stringify(this.good.mods[name]) === JSON.stringify(files)) return;
    this.good = { ...this.good, mods: { ...this.good.mods, [name]: files } };
  }

  goodModFiles(name: string): Record<string, string> | null {
    return this.good.mods[name] ?? null;
  }

  /** The .error files whose contents should change: key → text, or null to remove. */
  pendingErrors(): Record<string, string | null> {
    const out: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(this.view.errors)) if (this.written[k] !== v) out[k] = v;
    for (const k of Object.keys(this.written)) if (this.written[k] !== null && !(k in this.view.errors)) out[k] = null;
    return out;
  }

  markWritten(key: string, text: string | null) {
    this.written[key] = text;
  }

  /** The machine was (re)connected: what's there is unknown, so write every error again and clear the ones gone. */
  forgetWritten(existing: string[] = []) {
    this.written = Object.fromEntries(existing.map((k) => [k, "?"]));
  }

  saved(): Saved {
    return { files: this.files, good: this.good };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private recompute() {
    this.def = parseDefinition(this.files);
    const layouts: Record<string, Layout> = {};
    for (const p of Object.keys(this.files)) {
      const m = p.match(/^layouts\/([^/]+)\.json$/);
      if (!m) continue;
      const name = m[1];
      layouts[name] = this.def.layouts[name] ?? this.good.layouts[name];
      if (!layouts[name]) delete layouts[name];
    }
    const settings = this.def.errors.settings && this.files["settings.json"] !== undefined ? this.good.settings : this.def.settings;
    this.good = { ...this.good, settings, layouts };
    const errors: Record<string, string> = { ...this.def.errors };
    for (const [m, e] of Object.entries(this.modErrors)) {
      if (!this.def.mods[m]) continue;
      errors[`mods/${m}`] = errors[`mods/${m}`] ? `${errors[`mods/${m}`]}\n${e}` : e;
    }
    this.view = { settings, layouts, mods: this.def.mods, errors, version: ++this.version };
    for (const l of this.listeners) l();
  }
}
