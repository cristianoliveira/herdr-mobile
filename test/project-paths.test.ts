import { expect, test } from "vitest";
import { scanProjectPaths } from "../src/projects";

test("searches every configured path and merges distinct projects", async () => {
  const called: string[] = [];
  const exec = async (argv: string[]) => {
    const path = argv[4];
    called.push(path);
    return { code: 0, stdout: `${path}\nrepo\n` };
  };

  const result = await scanProjectPaths(["/other", "/work", "/custom"], "direct", exec);

  expect(called).toEqual(["/other", "/work", "/custom"]);
  expect(result.projects.map((p) => p.folder)).toEqual(["/other/repo", "/work/repo", "/custom/repo"]);
  expect(result.errors).toEqual([]);
});

test("deduplicates projects resolved through overlapping search paths", async () => {
  const result = await scanProjectPaths(["~/other", "/home/user/other"], "direct", async () => ({
    code: 0, stdout: "/home/user/other\nrepo\n",
  }));

  expect(result.projects).toEqual([{ owner: "", repo: "repo", folder: "/home/user/other/repo" }]);
});

test("one missing path or failed connection does not hide other projects", async () => {
  const result = await scanProjectPaths(["/missing", "/failed", "/work"], "direct", async (argv) => {
    if (argv[4] === "/failed") throw new Error("Disconnected");
    return argv[4] === "/missing" ? { code: 1, stdout: "" } : { code: 0, stdout: "/work\nrepo\n" };
  });

  expect(result.projects.map((p) => p.folder)).toEqual(["/work/repo"]);
  expect(result.errors).toEqual(["/missing", "/failed"]);
});

test("an empty list searches nothing", async () => {
  const result = await scanProjectPaths([], "direct", async () => { throw new Error("Must not execute"); });

  expect(result).toEqual({ projects: [], errors: [] });
});
