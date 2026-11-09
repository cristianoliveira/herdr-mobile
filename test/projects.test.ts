import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { projectPathError, projectProbe, readProjects } from "../src/projects";

const scratch: string[] = [];
afterEach(() => scratch.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })));

function root() {
  const path = realpathSync(mkdtempSync(join(tmpdir(), "herdr-projects-")));
  scratch.push(path);
  return path;
}

function discover(path: string, layout: "direct" | "grouped", home?: string) {
  const output = execFileSync("sh", projectProbe(path, layout).slice(1), {
    encoding: "utf8",
    env: { ...process.env, ...(home ? { HOME: home } : {}) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return readProjects(output);
}

test("discovers repositories directly inside a custom path with shell characters", () => {
  const path = join(root(), "my projects ' $(echo injected)");
  mkdirSync(join(path, "herdr-mobile"), { recursive: true });
  mkdirSync(join(path, ".hidden"));

  expect(discover(path, "direct")).toEqual([{ owner: "", repo: "herdr-mobile", folder: join(path, "herdr-mobile") }]);
});

test("keeps the owner/repo layout and expands home on the target machine", () => {
  const home = root();
  mkdirSync(join(home, "workspace", "owner", "repo"), { recursive: true });

  expect(discover("~/workspace", "grouped", home)).toEqual([
    { owner: "owner", repo: "repo", folder: join(home, "workspace", "owner", "repo") },
  ]);
});

test("an empty directory returns no projects and a missing path fails", () => {
  const path = root();

  expect(discover(path, "direct")).toEqual([]);
  expect(() => discover(join(path, "missing"), "direct")).toThrow();
});

test("rejects relative paths and control characters, but accepts literal shell punctuation", () => {
  for (const path of ["", "work", "~someone/work", "/tmp/a\nb", "/tmp/a\0b"]) {
    expect(projectPathError(path)).not.toBeNull();
    expect(() => projectProbe(path, "direct")).toThrow();
  }
  for (const path of ["~/other", "/srv/my projects", "/tmp/$(touch nope)", "~"]) {
    expect(projectPathError(path)).toBeNull();
  }
});
