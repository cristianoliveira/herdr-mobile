// Mod engines: one isolated QuickJS-ng runtime per mod copy, on a native
// thread of their own. See cpp/mod_engine.h for the result format.
import { requireNativeModule } from "expo-modules-core";

export type EngineError = { message: string; name?: string; file?: string; line?: number; stack?: string };
export type EngineResult<T = unknown> = { ok: true; value: T; outbox: unknown[]; jobErrors: EngineError[] } | { ok: false; error: EngineError; outbox: unknown[]; jobErrors: EngineError[] };

type ModEngineModule = {
  create(id: string, memoryLimit: number, budgetMs: number): Promise<void>;
  load(id: string, files: string, entry: string): Promise<string>;
  call(id: string, name: string, args: string): Promise<string>;
  dispose(id: string): Promise<void>;
};

const native = requireNativeModule<ModEngineModule>("ModEngine");

export const ModEngine = {
  create: (id: string, memoryLimit = 32 << 20, budgetMs = 250) => native.create(id, memoryLimit, budgetMs),
  load: async (id: string, files: Record<string, string>, entry: string): Promise<EngineResult> => JSON.parse(await native.load(id, JSON.stringify(files), entry)),
  call: async <T = unknown>(id: string, name: string, args: unknown[] = []): Promise<EngineResult<T>> => JSON.parse(await native.call(id, name, JSON.stringify(args))),
  dispose: (id: string) => native.dispose(id),
};
