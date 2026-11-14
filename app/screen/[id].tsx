// A mod pushed as a screen (screen.open): back with the gesture or the arrow.
import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useDefinition } from "../../src/definition/controller";
import { useAppData } from "../../src/mods/app-data";
import { ModBlock } from "../../src/ui/mods/ModBlock";

export default function ModScreen() {
  const { id, mod, props, title } = useLocalSearchParams<{ id: string; mod: string; props?: string; title?: string }>();
  const def = useDefinition();
  const { theme: t } = useAppData();
  const parsed = useMemo(() => {
    try {
      return JSON.parse(props ?? "{}");
    } catch {
      return {};
    }
  }, [props]);
  return (
    <View style={[styles.screen, { backgroundColor: t.background }]}>
      <Stack.Screen options={{ title: title || def.mods[mod]?.meta.title || mod }} />
      <ModBlock mod={mod} props={parsed} copyId={`screen/${mod}/${id}`} style={styles.screen} />
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1 } });
