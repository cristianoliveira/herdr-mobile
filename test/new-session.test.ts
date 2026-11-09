import { beforeEach, expect, test, vi } from "vitest";

const run = vi.hoisted(() => vi.fn());
vi.mock("../src/fleet-store", () => ({ fleet: { run } }));
vi.mock("../src/herdr-app", () => ({ newId: () => "tb-test" }));
vi.mock("../src/settings", () => ({ getSettings: () => ({ defaultMode: "full" }), useSettings: vi.fn() }));
vi.mock("../src/terminal/fit", () => ({ lastFitSize: () => null }));

import { sessionChoices, startSession } from "../src/ui/new-session";

const space = { id: "space-1", folder: "/work/project with spaces", target: { coreId: "core-1", label: "Workstation", linkId: "link-1", on: "remote" } };

beforeEach(() => { run.mockReset(); run.mockResolvedValue("core-1:t1"); });

test("shell remains available without installed agents and while probing", () => {
  expect(sessionChoices([])).toEqual([{ label: "Shell" }]);
  expect(sessionChoices(null)).toContainEqual({ label: "Shell" });
});

test("offers installed agents alongside the shell", () => {
  expect(sessionChoices(["pi"])).toEqual([{ cmd: "pi", label: "Pi" }, { label: "Shell" }]);
});

test("starts the remote machine’s default shell in the project folder", async () => {
  const key = await startSession(space);

  expect(key).toBe("core-1:t1");
  expect(run).toHaveBeenCalledWith(space.target, {
    cwd: space.folder,
    labels: { "herdr.space": "space-1", "herdr.tab": "tb-test" },
  });
  expect(run.mock.calls[0][1]).not.toHaveProperty("argv");
});

test.each(["pi", "claude"])("keeps starting %s by its executable name", async (cmd) => {
  await startSession(space, cmd);

  expect(run).toHaveBeenCalledWith(space.target, {
    argv: [cmd], cwd: space.folder,
    labels: { "herdr.space": "space-1", "herdr.tab": "tb-test" },
  });
});

test("reports shell startup failure to the caller", async () => {
  run.mockRejectedValue(new Error("Machine offline"));

  await expect(startSession(space)).rejects.toThrow("Machine offline");
});
