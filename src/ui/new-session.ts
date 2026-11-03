import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { fleet } from "../fleet-store";
import type { Target } from "../hc/fleet";
import { herdrLabels } from "../herdr-app";
import { getSettings } from "../settings";

export const AGENTS = [
  { cmd: "pi", label: "Pi" },
  { cmd: "claude", label: "Claude" },
] as const;

const LAST_TARGET = "last-target.v1";

const PROBE = `printf '%s\\n' "$HOME"; for c in ${AGENTS.map((a) => a.cmd).join(" ")}; do command -v "$c" >/dev/null 2>&1 && echo "$c"; done; true`;

export type Machine = { home: string; agents: string[] };

export async function lastTarget(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_TARGET);
}

export function useMachineAgents(targets: Target[], active: boolean): Record<string, Machine | undefined> {
  const [found, setFound] = useState<Record<string, Machine | undefined>>({});
  const ids = targets.map((t) => t.coreId).join(",");
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    for (const target of targets) {
      fleet.exec(target, ["sh", "-c", PROBE]).then(
        (out) => {
          const [home, ...agents] = out.stdout.split("\n").filter(Boolean);
          if (!cancelled) setFound((f) => ({ ...f, [target.coreId]: { home, agents } }));
        },
        () => !cancelled && setFound((f) => ({ ...f, [target.coreId]: { home: "", agents: [] } })),
      );
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, active]);
  return found;
}

export async function startAgent(target: Target, cmd: string, home: string): Promise<string> {
  const labels = getSettings().showInHerdr ? await herdrLabels(fleet, target, home) : undefined;
  const key = await fleet.run(target, { argv: [cmd], cwd: home, labels });
  await AsyncStorage.setItem(LAST_TARGET, target.coreId);
  return key;
}
