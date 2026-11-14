// Node's engine: QuickJS-ng built to WebAssembly, the same release the phone's
// native module vendors. It behaves like modules/mod-engine/cpp/mod_engine.c.
import variant from "@jitl/quickjs-ng-wasmfile-release-sync";
import {
  newQuickJSWASMModuleFromVariant,
  newVariant,
  type QuickJSContext,
  type QuickJSHandle,
  type QuickJSWASMModule,
} from "quickjs-emscripten-core";
import { DEFAULT_BUDGET_MS, DEFAULT_MEMORY_LIMIT, firstFrame, resolveModule, type Engine, type EngineError, type EngineFactory, type EngineResult } from "./engine";

let module: Promise<QuickJSWASMModule> | null = null;

/** Loads QuickJS once; `wasm` lets a bundle (check.mjs) pass the binary itself. */
export function quickjs(wasm?: Uint8Array): Promise<QuickJSWASMModule> {
  module ??= newQuickJSWASMModuleFromVariant(wasm ? newVariant(variant, { wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) as ArrayBuffer }) : variant);
  return module;
}

function errorOf(ctx: QuickJSContext, handle: QuickJSHandle): EngineError {
  const e = ctx.dump(handle) as any;
  if (!e || typeof e !== "object") return { message: String(e) };
  const out: EngineError = { message: String(e.message ?? e), name: e.name, stack: e.stack };
  const frame = e.fileName ? { file: e.fileName, line: e.lineNumber } : firstFrame(e.stack);
  if (frame) Object.assign(out, frame);
  return out;
}

export const wasmEngine: EngineFactory = async (options = {}) => {
  const QuickJS = await quickjs();
  const rt = QuickJS.newRuntime();
  rt.setMemoryLimit(options.memoryLimit ?? DEFAULT_MEMORY_LIMIT);
  rt.setMaxStackSize(1024 * 1024);
  const budget = options.budgetMs ?? DEFAULT_BUDGET_MS;
  let deadline = 0;
  rt.setInterruptHandler(() => deadline !== 0 && Date.now() > deadline);
  let files: Record<string, string> = {};
  rt.setModuleLoader(
    (name) => (name in files ? files[name] : { error: new ReferenceError(`could not find module '${name}'`) }),
    (base, name) => resolveModule(base, name),
  );
  const ctx = rt.newContext();

  const finish = <T>(head: { ok: true; value: T } | { ok: false; error: EngineError }, jobErrors: EngineError[]): EngineResult<T> => {
    deadline = 0;
    let outbox: any[] = [];
    const drain = ctx.getProp(ctx.global, "__drain");
    if (ctx.typeof(drain) === "function") {
      const r = ctx.callFunction(drain, ctx.global);
      if (r.error) r.error.dispose();
      else {
        outbox = JSON.parse(ctx.getString(r.value));
        r.value.dispose();
      }
    }
    drain.dispose();
    return { ...head, outbox, jobErrors } as EngineResult<T>;
  };

  const runJobs = (): EngineError[] => {
    const errors: EngineError[] = [];
    for (;;) {
      const r = rt.executePendingJobs(1);
      if (r.error) {
        const saved = deadline;
        deadline = 0;
        errors.push(errorOf(ctx, r.error));
        r.error.dispose();
        deadline = saved;
        continue;
      }
      if (r.value === 0) break;
    }
    return errors;
  };

  return {
    async load(f, entry) {
      files = f;
      deadline = Date.now() + budget;
      if (!(entry in files)) {
        return finish({ ok: false, error: { message: `could not find module '${entry}'`, name: "ReferenceError" } }, []);
      }
      const r = ctx.evalCode(files[entry], entry, { type: "module" });
      if (r.error) {
        deadline = 0;
        const error = errorOf(ctx, r.error);
        r.error.dispose();
        return finish({ ok: false, error }, []);
      }
      const jobs = runJobs();
      const state = ctx.getPromiseState(r.value);
      r.value.dispose();
      if (state.type === "rejected") {
        deadline = 0;
        const error = errorOf(ctx, state.error);
        state.error.dispose();
        return finish({ ok: false, error }, jobs);
      }
      if (state.type === "fulfilled" && state.notAPromise === false) state.value.dispose();
      return finish({ ok: true, value: null }, jobs);
    },

    async call<T>(name: string, args: unknown[] = []) {
      deadline = Date.now() + budget;
      const dispatch = ctx.getProp(ctx.global, "__dispatch");
      if (ctx.typeof(dispatch) !== "function") {
        dispatch.dispose();
        return finish<T>({ ok: false, error: { message: "the mod runtime is not loaded", name: "TypeError" } }, []);
      }
      const n = ctx.newString(name);
      const a = ctx.newString(JSON.stringify(args));
      const r = ctx.callFunction(dispatch, ctx.global, n, a);
      n.dispose();
      a.dispose();
      dispatch.dispose();
      if (r.error) {
        deadline = 0;
        const error = errorOf(ctx, r.error);
        r.error.dispose();
        return finish<T>({ ok: false, error }, []);
      }
      const jobs = runJobs();
      deadline = 0;
      const text = ctx.typeof(r.value) === "string" ? ctx.getString(r.value) : "null";
      r.value.dispose();
      return finish<T>({ ok: true, value: JSON.parse(text) }, jobs);
    },

    async dispose() {
      ctx.dispose();
      rt.dispose();
    },
  };
};
