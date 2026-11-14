// The app's own menu on every root screen: always there, whatever the layout,
// so Settings can't be lost.
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { agentPrompt, definitionCommands, useSyncStatus } from "../../definition/controller";
import { toast } from "../../mods/overlays";
import { applyUpdate, useUpdates } from "../../updates";
import { Sheet, SheetAction } from "../Sheet";
import { colors } from "../theme";

export function AppMenu() {
  const [open, setOpen] = useState(false);
  const status = useSyncStatus();
  const { isUpdatePending } = useUpdates();
  const go = (f: () => void) => () => {
    setOpen(false);
    f();
  };
  return (
    <>
      <Pressable hitSlop={10} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="App menu">
        <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
        {isUpdatePending && <View style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />}
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)}>
        {isUpdatePending && <SheetAction label="Restart to update" detail="A new version is ready." onPress={go(() => void applyUpdate())} />}
        <SheetAction label="Settings" onPress={go(() => router.push("/settings"))} />
        <SheetAction label="Machines" onPress={go(() => router.push("/machines"))} />
        <SheetAction
          label="Copy agent prompt"
          detail="Paste it into an agent: it learns how to change this app."
          onPress={go(() => {
            void Clipboard.setStringAsync(agentPrompt(status.machine));
            toast({ title: "Agent prompt copied" });
          })}
        />
        <SheetAction label="Reload definition" detail={status.machine ? `From ${status.machine}` : undefined} onPress={go(() => void definitionCommands.reload())} />
      </Sheet>
    </>
  );
}
