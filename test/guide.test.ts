// The guide agents read must keep up with the app: every command named in
// AGENTS.md, every runtime export and builder declared in the .d.ts files.
import { expect, test } from "vitest";
import { COMMANDS } from "../src/commands";
import { DEFAULT_FILES } from "../src/definition/defaults.generated";
import { RUNTIME_FILES } from "../src/mods/runtime.generated";

test("AGENTS.md names every command", () => {
  const missing = COMMANDS.map((c) => c.name).filter((n) => !DEFAULT_FILES["AGENTS.md"].includes("`" + n));
  expect(missing).toEqual([]);
});

test("herdr.d.ts declares everything herdr exports", () => {
  const src = RUNTIME_FILES.herdr;
  const names = [...src.matchAll(/^export (?:const|function) (\w+)/gm)].map((m) => m[1]).filter((n) => !n.startsWith("__"));
  const missing = names.filter((n) => !DEFAULT_FILES["herdr.d.ts"].includes(`function ${n}`));
  expect(names.length).toBeGreaterThan(10);
  expect(missing).toEqual([]);
});

test("herdr-ui.d.ts declares every builder and element", () => {
  const src = RUNTIME_FILES["herdr-ui"];
  const body = src.slice(src.indexOf("export class El"), src.indexOf("\n}\n", src.indexOf("export class El")));
  const methods = [...body.matchAll(/^  ([a-z][a-z0-9_]*)\(/gm)].map((m) => m[1]).filter((m) => m !== "constructor");
  const elements = [...src.matchAll(/^export const (\w+) =/gm)].map((m) => m[1]);
  const dts = DEFAULT_FILES["herdr-ui.d.ts"];
  expect(methods.length).toBeGreaterThan(50);
  expect(methods.filter((m) => !dts.includes(`  ${m}(`))).toEqual([]);
  expect(elements.filter((e) => !dts.includes(`function ${e}(`))).toEqual([]);
});
