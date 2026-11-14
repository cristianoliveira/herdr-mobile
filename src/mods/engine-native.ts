// The phone's engine: modules/mod-engine, on its own native thread.
import { ModEngine } from "../../modules/mod-engine";
import { DEFAULT_BUDGET_MS, DEFAULT_MEMORY_LIMIT, type Engine, type EngineFactory } from "./engine";

let count = 0;

export const nativeEngine: EngineFactory = async (options = {}) => {
  const id = `engine-${++count}`;
  await ModEngine.create(id, options.memoryLimit ?? DEFAULT_MEMORY_LIMIT, options.budgetMs ?? DEFAULT_BUDGET_MS);
  const engine: Engine = {
    load: (files, entry) => ModEngine.load(id, files, entry) as any,
    call: (name, args = []) => ModEngine.call(id, name, args) as any,
    dispose: () => ModEngine.dispose(id),
  };
  return engine;
};
