import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import { alphaTag } from "../scripts/alpha-release.mjs";

test("one-click release starts at alpha.1 without a tag argument", () => {
  expect(alphaTag("0.2.0", "", [])).toBe("v0.2.0-alpha.1");
});

test("one-click release chooses the next alpha for this app version", () => {
  expect(alphaTag("0.2.0", "", ["v0.2.0-alpha.2", "v0.2.0-alpha.10", "v0.3.0-alpha.50", "v0.2.0", "notes"])).toBe("v0.2.0-alpha.11");
});

test("an explicitly pushed alpha tag is retained", () => {
  expect(alphaTag("0.2.0", "v0.2.0-alpha.3", ["v0.2.0-alpha.3"])).toBe("v0.2.0-alpha.3");
});

test.each(["v0.3.0-alpha.1", "v0.2.0", "v0.2.0-alpha.0", "v0.2.0-alpha.1; echo bad"])("rejects an invalid or mismatched tag: %s", (tag) => {
  expect(() => alphaTag("0.2.0", tag, [])).toThrow();
});

test("rejects invalid app versions", () => {
  expect(() => alphaTag("oops", "", [])).toThrow();
});

test("CLI publishes the next tag and exact checkout commit to GitHub Actions outputs", () => {
  const root = mkdtempSync(join(tmpdir(), "alpha release "));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  try {
    git("init", "--quiet");
    git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--allow-empty", "-m", "fixture");
    git("tag", "v0.2.0-alpha.4");
    writeFileSync(join(root, "app.json"), JSON.stringify({ expo: { version: "0.2.0" } }));
    const outputs = join(root, "outputs");
    const environment = join(root, "environment");

    const result = spawnSync(process.execPath, [resolve("scripts/alpha-release.mjs")], {
      cwd: root, encoding: "utf8", timeout: 10000,
      env: { ...process.env, REQUESTED_RELEASE_TAG: "", GITHUB_OUTPUT: outputs, GITHUB_ENV: environment },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(Object.fromEntries(readFileSync(outputs, "utf8").trim().split("\n").map((line) => line.split("=")))).toEqual({ tag: "v0.2.0-alpha.5", commit: git("rev-parse", "HEAD") });
    expect(readFileSync(environment, "utf8")).toBe("RELEASE_TAG=v0.2.0-alpha.5\n");
    expect(git("tag", "--list")).toBe("v0.2.0-alpha.4");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
