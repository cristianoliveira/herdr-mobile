// The data every mod copy reads, kept with stable identities: a key whose
// value didn't change keeps its object, so a copy is sent only what changed.
import { useMemo, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COMMAND_LIST } from "../commands";
import { definitionLink, useDefinition } from "../definition/controller";
import { fleet, useFleet } from "../fleet-store";
import { useSettings } from "../settings";
import type { AppData } from "./data-types";
import { fleetData } from "./data";
import { useShared } from "./shared";
import { themeWith } from "./theme";

/** Keeps the old value when the new one is the same. */
function useStable<T>(value: T): T {
  const ref = useRef<{ json: string; value: T } | null>(null);
  const json = JSON.stringify(value);
  if (!ref.current || ref.current.json !== json) ref.current = { json, value };
  return ref.current.value;
}

export function useAppData(): AppData {
  const snapshot = useFleet();
  const def = useDefinition();
  const shared = useShared();
  const settings = useSettings();
  const insets = useSafeAreaInsets();
  const fleetPart = useMemo(() => fleetData({ snapshot, targets: fleet.targets(), definitionLink: definitionLink() }), [snapshot]);
  const spaces = useStable(fleetPart.spaces);
  const agents = useStable(fleetPart.agents);
  const terminals = useStable(fleetPart.terminals);
  const machines = useStable(fleetPart.machines);
  const theme = useStable(themeWith(def.settings.theme));
  const safeArea = useStable({ top: insets.top, bottom: insets.bottom, left: insets.left, right: insets.right });
  const appSettings = useStable({ fontSize: settings.fontSize, dark: true as const });
  const layout = def.layouts[def.settings.layout] ?? null;
  return useMemo(
    () => ({ spaces, agents, terminals, machines, settings: appSettings, theme, safeArea, shared, commands: COMMAND_LIST, layout }),
    [spaces, agents, terminals, machines, appSettings, theme, safeArea, shared, layout],
  );
}
