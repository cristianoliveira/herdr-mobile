// One isolated JavaScript engine for one mod copy. The phone uses the native
// QuickJS-ng module; Node (tests, check.mjs) uses the same QuickJS-ng release
// built to WebAssembly. Both return the same results (modules/mod-engine/cpp/mod_engine.h).

export type EngineError = { message: string; name?: string; file?: string; line?: number; stack?: string };

export type EngineResult<T = unknown> =
  | { ok: true; value: T; outbox: OutboxMessage[]; jobErrors: EngineError[] }
  | { ok: false; error: EngineError; outbox: OutboxMessage[]; jobErrors: EngineError[] };

/** What a mod's runtime asks of the app (src/mods/runtime/herdr.js). */
export type OutboxMessage =
  | { t: "render" }
  | { t: "call"; id: number; name: string; args: unknown[] }
  | { t: "timer"; id: number; ms: number; repeat: boolean }
  | { t: "timerCancel"; id: number }
  | { t: "shared"; key: string; value: unknown }
  | { t: "storage"; key: string; value: string | null }
  | { t: "overlay"; id: string; mod: string; props: Record<string, unknown>; kind: string; title: string | null }
  | { t: "closeOverlay"; id: string | null }
  | { t: "toast"; title: string; body: string; level: string; action: { name: string; args?: unknown } | null; timeout: number | null }
  | { t: "log"; level: "log" | "warn" | "error"; text: string }
  | { t: "error"; error: EngineError };

export interface Engine {
  /** files: module name → source. Relative imports resolve against the importing module. */
  load(files: Record<string, string>, entry: string): Promise<EngineResult<null>>;
  /** Calls globalThis.__dispatch(name, JSON.stringify(args)); the value is what it returned, parsed. */
  call<T = unknown>(name: string, args?: unknown[]): Promise<EngineResult<T>>;
  dispose(): Promise<void>;
}

export type EngineOptions = { memoryLimit?: number; budgetMs?: number };
export type EngineFactory = (options?: EngineOptions) => Promise<Engine>;

export const DEFAULT_MEMORY_LIMIT = 32 << 20;
export const DEFAULT_BUDGET_MS = 250;

/** QuickJS's default module name normalization: relative to the importer's folder. */
export function resolveModule(base: string, name: string): string {
  if (!name.startsWith(".")) return name;
  const parts = base.split("/").slice(0, -1);
  for (const part of name.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

/** The first frame of a QuickJS stack ("    at f (x.js:1:24)" or "    at x.js:4:2"). */
export function firstFrame(stack: string | undefined): { file: string; line: number } | null {
  const m = stack?.match(/at (?:[^\n(]*\()?([^\n()]+?):(\d+):\d+\)?/);
  return m ? { file: m[1], line: Number(m[2]) } : null;
}
