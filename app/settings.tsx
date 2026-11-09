import Constants from "expo-constants";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFleet } from "../src/fleet-store";
import { updateSettings, useSettings } from "../src/settings";
import { Cell, Row, Section } from "../src/ui/Group";
import { TextField } from "../src/ui/TextField";
import { projectPathError } from "../src/projects";
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

      <ProjectSettings />

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

function ProjectSettings() {
  const s = useSettings();
  const [path, setPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async (projectPaths: string[], projectLayout = s.projectLayout) => {
    setError(null);
    setSaving(true);
    try {
      await updateSettings({ projectPaths, projectLayout });
    } catch {
      setError("Could not save project settings. Try again.");
    } finally {
      setSaving(false);
    }
  };
  const add = (value: string) => {
    const next = value.trim();
    const invalid = projectPathError(next);
    setError(invalid);
    if (invalid) return false;
    void save([...s.projectPaths, next]);
    return true;
  };
  return (
    <Section title="Projects">
      <Row label="Project paths" hint="Search all these paths on every connected machine. Results are combined." />
      {s.projectPaths.map((saved) => (
        <Row key={saved} label={saved}>
          <Small label="Remove" accessibilityLabel={`Remove ${saved}`} onPress={() => void save(s.projectPaths.filter((value) => value !== saved))} disabled={saving} />
        </Row>
      ))}
      {!s.projectPaths.length && <Row label="No paths yet" hint="Add a path below to find projects." />}
      <Cell>
        <Text style={styles.smallText}>Add a path</Text>
        <View style={styles.presets}>
          {["~/workspace", "~/projects", "~/code", "~/src"].filter((preset) => !s.projectPaths.includes(preset)).map((preset) => (
            <Small key={preset} label={`+ ${preset}`} onPress={() => add(preset)} disabled={saving} />
          ))}
        </View>
        <TextField accessibilityLabel="Custom project path" value={path} onChangeText={setPath} onSubmitEditing={() => { if (add(path)) setPath(""); }} returnKeyType="done" placeholder="~/repos or /srv/projects" autoCorrect={false} spellCheck={false} invalid={!!error} editable={!saving} inset />
        <Small label={saving ? "Saving…" : "Add custom path"} onPress={() => { if (add(path)) setPath(""); }} disabled={saving || s.projectPaths.includes(path.trim())} />
        {error && <Text accessibilityRole="alert" style={styles.smallText}>{error}</Text>}
      </Cell>
      <Cell>
        <Text style={styles.smallText}>Folder layout for all paths</Text>
        <Segmented value={s.projectLayout} options={[["direct", "Direct folders"], ["grouped", "Owner / repo"]]} onChange={(layout) => { if (!saving) void save(s.projectPaths, layout); }} />
        <Text style={styles.smallText}>{s.projectLayout === "direct" ? "<path>/repo" : "<path>/owner/repo"}</Text>
      </Cell>
    </Section>
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
