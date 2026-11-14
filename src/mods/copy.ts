// One running copy of a mod: its engine, its data, its timers, the calls it
// waits on. A reload starts a new engine and keeps the old one until the new
// one has loaded, started, and drawn once: a broken save never blanks a screen.
import type { UINode } from "./description";
import type { Engine, EngineError, EngineFactory, EngineResult, OutboxMessage } from "./engine";

export type ModData = Record<string, unknown>;

export type CopyHost = {
  engine: EngineFactory;
  /** The runtime modules (herdr-ui, herdr). */
  runtime: Record<string, string>;
  /** Answers what a mod waits for: run, exec, readTextFile, writeTextFile, knownAgents, fetch. */
  call(name: string, args: unknown[]): Promise<unknown>;
  /** What a mod tells the app and doesn't wait for: overlays, toasts, shared state, storage, logs. */
  post(message: OutboxMessage): void;
};

export type CopyState = {
  description: UINode | null;
  /** The last thing that went wrong, until a load succeeds or it's dismissed. The description stays the last good one. */
  error: EngineError | null;
};

const BOOT = "__boot.js";
const boot = `import Mod from "./main.js"; import { __install } from "herdr"; __install(Mod);`;

/** How long a closed copy keeps its engine to finish what it was waiting for. */
const FINISH_MS = 15_000;

/** One engine with what belongs to it alone. */
class Running {
  sent = new Map<string, unknown>();
  timers = new Map<number, ReturnType<typeof setTimeout>>();
  queue: Promise<unknown> = Promise.resolve();
  /** Not shown any more: no timers, no renders. */
  closed = false;
  /** The engine is gone. */
  disposed = false;
  /** Host calls the mod still waits for. */
  pending = 0;
  constructor(readonly engine: Engine) {}

  /** Engine calls run one at a time, in order. */
  run<T>(f: () => Promise<T>): Promise<T> {
    const p = this.queue.then(f, f);
    this.queue = p.catch(() => {});
    return p;
  }

  /** The keys of `data` that changed since the engine last saw them. */
  delta(data: ModData): ModData | null {
    let out: ModData | null = null;
    for (const [k, v] of Object.entries(data)) {
      if (this.sent.get(k) === v) continue;
      this.sent.set(k, v);
      (out ??= {})[k] = v;
    }
    return out;
  }

  stop() {
    this.closed = true;
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }
}

export class ModCopy {
  private live: Running | null = null;
  private state: CopyState = { description: null, error: null };
  private scheduled = false;
  private closed = false;

  constructor(
    readonly name: string,
    private host: CopyHost,
    private data: () => ModData,
    private storage: Record<string, string>,
    private onChange: (state: CopyState) => void,
  ) {}

  get current(): CopyState {
    return this.state;
  }

  /** Loads, starts and draws the mod; on failure the previous build (if any) keeps running. */
  async load(files: Record<string, string>): Promise<boolean> {
    if (this.closed) return false;
    const next = new Running(await this.host.engine());
    const fail = async (error: EngineError) => {
      next.stop();
      await next.engine.dispose();
      this.set({ error });
      return false;
    };
    const loaded = await next.engine.load({ ...this.host.runtime, ...files, [BOOT]: boot }, BOOT);
    this.outbox(next, loaded);
    if (!loaded.ok) return fail(loaded.error);
    const init = await next.run(() => next.engine.call("init", [next.delta(this.data()) ?? {}, this.storage]));
    this.outbox(next, init);
    if (!init.ok) return fail(init.error);
    const drawn = await next.run(() => next.engine.call<UINode>("render", [next.delta(this.data())]));
    this.outbox(next, drawn);
    if (!drawn.ok) return fail(drawn.error);
    if (this.closed) {
      next.stop();
      await next.engine.dispose();
      return false;
    }
    const old = this.live;
    this.live = next;
    this.set({ description: drawn.value, error: null });
    if (old) await this.retire(old);
    return true;
  }

  /** The data changed: draw again, once, soon. */
  dataChanged() {
    this.schedule();
  }

  /** A tap, a swipe, typed text: run the mod's callback, then draw. */
  event(callback: number, event: unknown = {}) {
    const r = this.live;
    if (!r) return;
    void r.run(async () => {
      const res = await r.engine.call("event", [callback, event]);
      this.outbox(r, res);
      if (!res.ok) this.set({ error: res.error });
    });
    this.schedule();
  }

  async close() {
    this.closed = true;
    const r = this.live;
    this.live = null;
    if (r) await this.retire(r);
  }

  private async retire(r: Running) {
    r.stop();
    try {
      // A copy that closed itself (an overlay running a command) still gets what
      // it was waiting for, so "close, then open the new terminal" works.
      const start = Date.now();
      while (r.pending > 0 && Date.now() - start < FINISH_MS) await new Promise((resolve) => setTimeout(resolve, 50));
      // A mod's close() gets one call; what it starts has a moment to go out.
      await r.run(async () => this.outbox(r, await r.engine.call("close")));
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 50));
      r.disposed = true;
      await r.engine.dispose();
    }
  }

  private schedule() {
    if (this.scheduled || this.closed) return;
    this.scheduled = true;
    setTimeout(() => {
      this.scheduled = false;
      void this.render();
    }, 0);
  }

  private async render() {
    const r = this.live;
    if (!r || r.closed) return;
    await r.run(async () => {
      if (r.closed) return;
      const res = await r.engine.call<UINode>("render", [r.delta(this.data())]);
      this.outbox(r, res);
      if (r !== this.live) return;
      // An error stays until a load succeeds or someone dismisses it.
      if (res.ok) this.set({ description: res.value });
      else this.set({ error: res.error });
    });
  }

  /** The error bar was dismissed. */
  dismissError() {
    this.set({ error: null });
  }

  private set(patch: Partial<CopyState>) {
    this.state = { ...this.state, ...patch };
    this.onChange(this.state);
  }

  /** Does what the engine asked for in its last call. */
  private outbox(r: Running, res: EngineResult<unknown>) {
    for (const e of res.jobErrors) this.host.post({ t: "error", error: e });
    if (res.jobErrors.length) this.set({ error: res.jobErrors[res.jobErrors.length - 1] });
    for (const m of res.outbox) {
      switch (m.t) {
        case "render":
          if (r === this.live) this.schedule();
          break;
        case "call":
          r.pending++;
          this.host.call(m.name, m.args).then(
            (value) => this.settle(r, m.id, true, value ?? null),
            (e) => this.settle(r, m.id, false, e instanceof Error ? e.message : String(e)),
          );
          break;
        case "timer": {
          if (r.closed) break;
          const fire = () => {
            if (!m.repeat) r.timers.delete(m.id);
            void r.run(async () => {
              if (r.closed) return;
              const res = await r.engine.call("timer", [m.id]);
              this.outbox(r, res);
              if (!res.ok) this.set({ error: res.error });
            });
          };
          r.timers.set(m.id, m.repeat ? (setInterval(fire, Math.max(m.ms, 16)) as any) : setTimeout(fire, m.ms));
          break;
        }
        case "timerCancel": {
          const t = r.timers.get(m.id);
          if (t) {
            clearTimeout(t);
            clearInterval(t as any);
            r.timers.delete(m.id);
          }
          break;
        }
        case "storage":
          if (m.value === null) delete this.storage[m.key];
          else this.storage[m.key] = m.value;
          this.host.post(m);
          break;
        case "error":
          this.set({ error: m.error });
          this.host.post(m);
          break;
        default:
          this.host.post(m);
      }
    }
  }

  private settle(r: Running, id: number, ok: boolean, value: unknown) {
    if (r.disposed) return;
    void r.run(async () => {
      if (r.disposed) return;
      const res = await r.engine.call("resolve", [id, ok, value]);
      // Count it settled only after its callbacks ran: they may ask for more.
      r.pending--;
      this.outbox(r, res);
      if (!res.ok && r === this.live) this.set({ error: res.error });
    });
  }
}
