import Constants from "expo-constants";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { agentPrompt, definitionCommands, definitionLink, useDefinition, useSyncStatus } from "../src/definition/controller";
import { useFleet } from "../src/fleet-store";
import { updateSettings, useSettings } from "../src/settings";
import { Cell, Row, Section } from "../src/ui/Group";
import { colors, radius, space } from "../src/ui/theme";
import { applyUpdate, currentUpdate, fetchUpdate, updatesEnabled } from "../src/updates";

export default function SettingsScreen() {
  const s = useSettings();
  const { links } = useFleet();
  const up = links.filter((l) => l.state === "connected").length;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Section>
        <Row
          label="Machines"
          hint={links.length === 0 ? "None yet" : `${up} of ${links.length} connected · this phone's SSH key`}
          onPress={() => router.push("/machines")}
        />
      </Section>

      <DefinitionSettings />

      <Section title="Terminal">
        <Row label="Text size">
          <View style={styles.stepper}>
            <Small label="A−" onPress={() => void updateSettings({ fontSize: Math.max(8, s.fontSize - 1) })} />
            <Text style={styles.value}>{s.fontSize}</Text>
            <Small label="A+" onPress={() => void updateSettings({ fontSize: Math.min(22, s.fontSize + 1) })} />
          </View>
        </Row>
        <Row
          label="Open sessions at"
          hint={
            s.defaultMode === "fit"
              ? "Phone size: the terminal reflows to fit the phone, and your desktop sees that size until you use it there again."
              : "Full size: watch at your desktop's size, scaled down; pinch to zoom."
          }
        >
          <Segmented value={s.defaultMode} options={[["fit", "Phone"], ["full", "Full"]]} onChange={(v) => void updateSettings({ defaultMode: v })} />
        </Row>
      </Section>

      <Section title="App">
        <Row label={`Herdr Mobile ${Constants.expoConfig?.version ?? ""}`} hint={currentUpdate()}>
          {updatesEnabled && <UpdateButton />}
        </Row>
      </Section>
    </ScrollView>
  );
}

function UpdateButton() {
  const [state, setState] = useState<"idle" | "checking" | "ready" | "latest" | "failed">("idle");
  const label = { idle: "Check for updates", checking: "Checking…", ready: "Restart to update", latest: "Up to date", failed: "Couldn't check" }[state];
  const onPress = async () => {
    if (state === "ready") return void applyUpdate();
    setState("checking");
    try {
      setState((await fetchUpdate()) ? "ready" : "latest");
    } catch {
      setState("failed");
    }
  };
  return <Small label={label} active={state === "ready"} onPress={() => void onPress()} disabled={state === "checking"} />;
}

function Small({ label, onPress, active, disabled, accessibilityLabel }: { label: string; onPress: () => void; active?: boolean; disabled?: boolean; accessibilityLabel?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={({ pressed }) => [styles.small, active && styles.active, pressed && styles.pressed]} onPress={onPress} disabled={disabled}>
      <Text style={[styles.smallText, active && styles.activeText]}>{label}</Text>
    </Pressable>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <View style={styles.segment} accessibilityRole="radiogroup">
      {options.map(([v, label]) => (
        <Pressable key={v} accessibilityRole="radio" accessibilityState={{ selected: v === value }} style={[styles.seg, v === value && styles.active]} onPress={() => onChange(v)}>
          <Text style={[styles.smallText, v === value && styles.activeText]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: 48, gap: space.xl },
  value: { color: colors.text, fontSize: 16, minWidth: 28, textAlign: "center", fontVariant: ["tabular-nums"] },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.sm },
  small: { backgroundColor: colors.surfaceHigh, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: space.sm - 2 },
  smallText: { color: colors.text, fontSize: 14 },
  pressed: { opacity: 0.7 },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceHigh, borderRadius: radius.sm + 2, padding: 2 },
  seg: { paddingHorizontal: space.md, paddingVertical: space.sm - 2, borderRadius: radius.sm },
  active: { backgroundColor: colors.accent },
  activeText: { color: colors.onAccent, fontWeight: "700" },
});

function DefinitionSettings() {
  const { links } = useFleet();
  const status = useSyncStatus();
  const def = useDefinition();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const chosen = definitionLink();
  const errors = Object.entries(def.errors);
  const state =
    status.state === "synced"
      ? `Synced from ${status.home ?? "~/.config/herdr-mobile"}`
      : status.state === "starting"
        ? "Connecting…"
        : status.state === "failed"
          ? `Failed: ${status.error}`
          : status.state === "none"
            ? "Add a machine first"
            : "Offline: showing the last definition it had";
  const act = (name: string, f: () => Promise<unknown>) => async () => {
    setBusy(name);
    try {
      await f();
    } catch {
    } finally {
      setBusy(null);
    }
  };
  return (
    <Section title="Definition">
      <Row label="Definition machine" hint={state}>
        {links.length > 1 && (
          <Segmented
            value={chosen ?? ""}
            options={links.map((l) => [l.config.id, l.config.name] as [string, string])}
            onChange={(v) => void updateSettings({ definitionMachine: v })}
          />
        )}
      </Row>
      <Row label="Agent prompt" hint={agentPrompt(status.machine)}>
        <Small
          label={copied ? "Copied" : "Copy"}
          onPress={() => {
            void Clipboard.setStringAsync(agentPrompt(status.machine));
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        />
      </Row>
      <Row label={errors.length ? `${errors.length} file${errors.length > 1 ? "s" : ""} with errors` : "No errors"} hint={errors.map(([k, v]) => `${k}: ${v}`).join("\n") || undefined} />
      <Row label="Reset layout" hint={`Puts layouts/${def.settings.layout}.json back as shipped; yours is kept beside it.`}>
        <Small label={busy === "reset" ? "…" : "Reset"} onPress={act("reset", () => definitionCommands.resetLayout())} />
      </Row>
      <Row label="Reload definition">
        <Small label={busy === "reload" ? "…" : "Reload"} onPress={act("reload", () => definitionCommands.reload())} />
      </Row>
    </Section>
  );
}
