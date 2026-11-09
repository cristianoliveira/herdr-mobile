import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Sheet } from "../ui/Sheet";
import { colors, radius, space } from "../ui/theme";
import { loadSnippets, saveSnippets, SNIPPET_NAME_LIMIT, SNIPPET_TEXT_LIMIT, type Snippet } from "./snippets";

export function SnippetsSheet({ draft, onInsert, onClose }: { draft: string; onInsert: (text: string) => void; onClose: () => void }) {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [original, setOriginal] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    loadSnippets().then((items) => {
      if (active) { setSnippets(items); setLoaded(true); }
    }).catch(() => { if (active) setError("Could not load snippets. Close and reopen to try again. Saved data has not been changed."); });
    return () => { active = false; };
  }, []);

  const edit = (snippet?: Snippet) => {
    setOriginal(snippet?.name ?? null);
    setName(snippet?.name ?? "");
    setBody(snippet?.text ?? draft);
    setEditing(true);
    setError("");
  };

  const persist = async (next: Snippet[]) => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await saveSnippets(next);
      setSnippets(next);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save snippets.");
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    const next = { name: name.trim(), text: body };
    void persist(original === null ? [...snippets, next] : snippets.map((s) => s.name === original ? next : s));
  };

  const remove = () => Alert.alert("Delete snippet?", `Delete “${original}” from this device?`, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: () => void persist(snippets.filter((s) => s.name !== original)) },
  ]);

  return (
    <Sheet visible onClose={() => { if (!saving) onClose(); }}>
      <Text style={styles.title}>{editing ? (original === null ? "New snippet" : "Edit snippet") : "Snippets"}</Text>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.note}>Saved on this device, not encrypted. Do not store passwords or secrets.</Text>
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {!loaded && !error && <Text style={styles.note}>Loading…</Text>}
        {editing ? (
          <>
            <TextInput accessibilityLabel="Snippet name" placeholder="Name" placeholderTextColor={colors.muted} value={name} onChangeText={setName} maxLength={SNIPPET_NAME_LIMIT} editable={!saving} style={styles.input} />
            <TextInput accessibilityLabel="Snippet text" placeholder="Reusable text" placeholderTextColor={colors.muted} value={body} onChangeText={setBody} maxLength={SNIPPET_TEXT_LIMIT} multiline editable={!saving} style={[styles.input, styles.body]} />
          </>
        ) : snippets.map((snippet) => (
          <Pressable key={snippet.name} accessibilityRole="button" accessibilityLabel={`Insert ${snippet.name}`} accessibilityHint="Adds text to your message draft without sending" accessibilityActions={[{ name: "longpress", label: "Edit snippet" }]} onAccessibilityAction={() => edit(snippet)} onLongPress={() => edit(snippet)} onPress={() => onInsert(snippet.text)} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
            <Text style={styles.label}>{snippet.name}</Text>
            <Text style={styles.note} numberOfLines={2}>{snippet.text}</Text>
          </Pressable>
        ))}
        {loaded && !editing && <Text style={styles.note}>{snippets.length ? "Tap to insert into your draft. Hold to edit or delete." : "Save text you type often, then insert it into any session’s draft."}</Text>}
      </ScrollView>
      {editing ? (
        <View style={styles.actions}>
          <Action label="Cancel" disabled={saving} onPress={() => setEditing(false)} />
          {original !== null && <Action label="Delete" disabled={saving} onPress={remove} />}
          <Action label={saving ? "Saving…" : "Save"} disabled={saving || !name.trim() || !body.trim()} onPress={save} />
        </View>
      ) : (
        <View style={styles.actions}>
          <Action label="Close" onPress={onClose} />
          <Action label="New snippet" disabled={!loaded} onPress={() => edit()} />
        </View>
      )}
    </Sheet>
  );
}

function Action({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.action, disabled && styles.off]}><Text style={styles.label}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 20, fontWeight: "700", padding: space.md },
  content: { padding: space.sm, gap: space.sm },
  note: { color: colors.muted, fontSize: 13 },
  error: { color: colors.blocked, fontSize: 14 },
  input: { color: colors.text, backgroundColor: colors.bg, borderRadius: radius.sm, padding: space.md, minHeight: 48, fontSize: 16 },
  body: { minHeight: 120, maxHeight: 220, textAlignVertical: "top" },
  item: { minHeight: 64, padding: space.md, borderRadius: radius.sm, gap: space.xs },
  pressed: { backgroundColor: colors.surfaceHigh },
  label: { color: colors.text, fontSize: 16 },
  actions: { flexDirection: "row", justifyContent: "space-between", padding: space.sm },
  action: { minHeight: 48, minWidth: 48, paddingHorizontal: space.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceHigh, borderRadius: radius.sm },
  off: { opacity: 0.4 },
});
