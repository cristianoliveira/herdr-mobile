// check.mjs: node ~/.config/herdr-mobile/check.mjs [mod names...]
// Checks the home this file sits in. Exits 1 and prints file:line: message
// for each problem.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error esbuild loads the WebAssembly file as bytes.
import wasm from "@jitl/quickjs-ng-wasmfile-release-sync/wasm";
import { quickjs, wasmEngine } from "../mods/engine-wasm";
import { RUNTIME_FILES } from "../mods/runtime.generated";
import { checkHome } from "./check-home";

const home = dirname(fileURLToPath(import.meta.url));
await quickjs(wasm as Uint8Array);
const { problems, mods, layouts } = await checkHome(home, wasmEngine, RUNTIME_FILES, process.argv.slice(2));
if (problems.length) {
  for (const p of problems) console.log(p);
  process.exit(1);
}
console.log(`ok: ${mods} mod${mods === 1 ? "" : "s"}, ${layouts} layout${layouts === 1 ? "" : "s"}`);
