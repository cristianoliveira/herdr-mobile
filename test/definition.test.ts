// The definition home's pure parts: checksums, the install plan, the store.
import { execFileSync } from "node:child_process";
import { expect, test } from "vitest";
import { cksum } from "../src/definition/cksum";
import { planInstall } from "../src/definition/install";
import { DefinitionStore } from "../src/definition/store";
import { DEFAULT_SETTINGS } from "../src/definition/definition";

test("cksum matches the cksum command", () => {
  for (const s of ["", "a", "hello world\n", "ünïcödé ✓ 🚀", "x".repeat(70000)]) {
    expect(cksum(s)).toBe(execFileSync("cksum", { input: s, encoding: "utf8" }).trim().split(" ").slice(0, 2).join(" "));
  }
});

const shipped = { "layouts/main.json": "{main}", "mods/spaces/main.js": "spaces v2", "mods/spaces/mod.json": "{}", "AGENTS.md": "guide v2" };
const sums = (files: Record<string, string>) => Object.fromEntries(Object.entries(files).map(([p, t]) => [p, cksum(t)]));

test("a fresh home gets every shipped file", () => {
  const plan = planInstall(shipped, {}, { files: {} });
  expect(plan.write.sort()).toEqual(Object.keys(shipped).sort());
  expect(plan.rescue).toEqual([]);
  expect(plan.installed.files).toEqual(sums(shipped));
});

test("an unchanged home needs nothing; an old shipped version is replaced", () => {
  expect(planInstall(shipped, sums(shipped), { files: sums(shipped) }).write).toEqual([]);
  const old = { ...shipped, "mods/spaces/main.js": "spaces v1", "AGENTS.md": "guide v1" };
  const plan = planInstall(shipped, sums(old), { files: sums(old) });
  expect(plan.write.sort()).toEqual(["AGENTS.md", "mods/spaces/main.js"]);
  expect(plan.rescue).toEqual([]);
});

test("an edited shipped mod moves aside whole, an edited layout alone", () => {
  const installed = { files: sums({ ...shipped, "mods/spaces/main.js": "spaces v1" }) };
  const remote = sums({ ...shipped, "mods/spaces/main.js": "mine", "layouts/main.json": "{mine}", "mods/spaces-edited/main.js": "older" });
  const plan = planInstall(shipped, remote, installed);
  expect(plan.rescue).toEqual([
    ["mods/spaces", "mods/spaces-edited-2"],
    ["layouts/main.json", "layouts/main-edited.json"],
  ]);
  expect(plan.write.sort()).toEqual(["layouts/main.json", "mods/spaces/main.js", "mods/spaces/mod.json"]);
});

test("a file added to a shipped mod makes it the person's", () => {
  const plan = planInstall(shipped, sums({ ...shipped, "mods/spaces/extra.js": "x" }), { files: sums(shipped) });
  expect(plan.rescue).toEqual([["mods/spaces", "mods/spaces-edited"]]);
});

test("files no longer shipped go when untouched and stay when edited", () => {
  const before = { ...shipped, "mods/old/main.js": "old", "mods/kept/main.js": "kept" };
  const plan = planInstall(shipped, sums({ ...before, "mods/kept/main.js": "edited" }), { files: sums(before) });
  expect(plan.remove).toEqual(["mods/old/main.js"]);
});

test("a home with the person's own files before any install keeps them", () => {
  const plan = planInstall(shipped, sums({ "mods/spaces/main.js": "theirs" }), { files: {} });
  expect(plan.rescue).toEqual([["mods/spaces", "mods/spaces-edited"]]);
});

const LAYOUT = (mod: string) => JSON.stringify({ root: { type: "block", id: "r", content: { mod } } });

test("the store keeps a layout's last good version and reports the broken one", () => {
  const store = new DefinitionStore({ files: { "layouts/main.json": LAYOUT("a"), "mods/a/main.js": "x" }, good: { settings: DEFAULT_SETTINGS, layouts: {}, mods: {} } });
  expect(store.current.layouts.main).toBeTruthy();
  expect(store.current.errors).toEqual({});
  store.apply({ "layouts/main.json": "{ broken" });
  expect(store.current.layouts.main).toMatchObject({ root: { content: { mod: "a" } } });
  expect(store.current.errors["layouts/main"]).toContain("not valid JSON");
  store.apply({ "layouts/main.json": LAYOUT("missing") });
  expect(store.current.errors["layouts/main"]).toContain('no mod named "missing"');
  store.apply({ "layouts/main.json": null });
  expect(store.current.layouts.main).toBeUndefined();
});

test("the store says which .error files to write and clear", () => {
  const store = new DefinitionStore({ files: { "layouts/main.json": LAYOUT("a"), "mods/a/main.js": "x" }, good: { settings: DEFAULT_SETTINGS, layouts: {}, mods: {} } });
  store.setModError("a", "mods/a/main.js:3: boom");
  expect(store.pendingErrors()).toEqual({ "mods/a": "mods/a/main.js:3: boom" });
  store.markWritten("mods/a", "mods/a/main.js:3: boom");
  expect(store.pendingErrors()).toEqual({});
  store.setModError("a", null);
  expect(store.pendingErrors()).toEqual({ "mods/a": null });
});
