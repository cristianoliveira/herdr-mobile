import { useEffect, useState } from "react";
import { fleet } from "../fleet-store";
import type { Target } from "../hc/fleet";
import { newId } from "../herdr-app";
import { getSettings, useSettings } from "../settings";
import { scanProjectPaths } from "../projects";
import type { Space } from "../spaces";
import { lastFitSize } from "../terminal/fit";

export const AGENTS = [
  { cmd: "pi", label: "Pi" },
  { cmd: "claude", label: "Claude" },
] as const;

export const SPACE_TABS: string[][] = [["nvim-server"], ["deltoids"], ["gob", "tui"]];

const AGENT_PROBE = `for c in ${AGENTS.map((a) => a.cmd).join(" ")}; do command -v "$c" >/dev/null 2>&1 && echo "$c"; done; true`;

export type Project = { target: Target; owner: string; repo: string; folder: string };

export function useInstalledAgents(target: Target | undefined): string[] | null {
  const [found, setFound] = useState<string[] | null>(null);
  useEffect(() => {
    setFound(null);
    if (!target) return;
    let cancelled = false;
    fleet.exec(target, ["sh", "-c", AGENT_PROBE]).then(
      (out) => !cancelled && setFound(out.stdout.split("\n").filter(Boolean)),
      () => !cancelled && setFound([]),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.coreId]);
  return found;
}

export function useProjects(targets: Target[], active: boolean): { projects: Project[]; loading: boolean; errors: string[] } {
  const { projectPaths, projectLayout } = useSettings();
  const [byCore, setByCore] = useState<Record<string, Project[]>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(0);
  const ids = targets.map((t) => t.coreId).join(",");
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setPending(targets.length);
    setByCore({});
    setErrors([]);
    for (const target of targets) {
      scanProjectPaths(projectPaths, projectLayout, (argv) => fleet.exec(target, argv))
        .then((result) => {
          if (cancelled) return;
          setErrors((list) => [...list, ...result.errors.map((path) => `${target.label}: could not read ${path}. Check the paths in Settings.`)]);
          setByCore((m) => ({ ...m, [target.coreId]: result.projects.map((project) => ({ target, ...project })) }));
          setPending((n) => n - 1);
        });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, active, projectPaths, projectLayout]);
  const projects = targets.flatMap((t) => byCore[t.coreId] ?? []);
  return { projects, loading: pending > 0 && projects.length === 0, errors };
}

async function presize(key: string) {
  const size = lastFitSize();
  if (!size || getSettings().defaultMode !== "fit") return;
  const start = Date.now();
  let route = fleet.route(key);
  while (!route && Date.now() - start < 2000) {
    await new Promise((r) => setTimeout(r, 50));
    route = fleet.route(key);
  }
  if (!route) return;
  try {
    const stream = await route.conn.attach({ terminal: route.address, cols: size.cols, rows: size.rows, history: 0 }, { onData: () => {}, onClose: () => {} });
    stream.resize(size.cols, size.rows);
    stream.close();
  } catch {}
}

export async function startAgent(space: Pick<Space, "target" | "id" | "folder">, cmd: string): Promise<string> {
  const key = await fleet.run(space.target, {
    argv: [cmd],
    cwd: space.folder,
    labels: { "herdr.space": space.id, "herdr.tab": newId("tb") },
  });
  await presize(key);
  return key;
}

function placed(key: string, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const s = fleet.snapshot().sessions.find((x) => x.key === key);
      if (s?.terminal.labels?.where) return resolve(true);
      if (Date.now() - start > ms) return resolve(false);
      setTimeout(tick, 100);
    };
    tick();
  });
}

export async function startSpace(target: Target, folder: string): Promise<string> {
  const id = newId("sp");
  const space = { target, id, folder };
  let desktop = true;
  const settle = async (key: string) => {
    if (desktop) desktop = await placed(key, 3000);
    return key;
  };
  const tab = (argv: string[]) =>
    fleet
      .run(target, { argv, cwd: folder, keep: true, labels: { "herdr.space": id, "herdr.tab": newId("tb") } })
      .then(settle)
      .catch(() => null);
  const [first, ...rest] = SPACE_TABS;
  await tab(first);
  const pi = await startAgent(space, "pi").then(settle);
  for (const argv of rest.reverse()) await tab(argv);
  return pi;
}

export function spaceFor(project: Project, spaces: Space[]): Space | undefined {
  return spaces.find(
    (s) => s.target.coreId === project.target.coreId && !!s.folder && (s.folder === project.folder || s.folder.startsWith(project.folder + "/")),
  );
}
