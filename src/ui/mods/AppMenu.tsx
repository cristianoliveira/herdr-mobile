// The app's own menu on every root screen: always there, whatever the layout,
// so Settings can't be lost.
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable } from "react-native";
import { agentPrompt, definitionCommands, useSyncStatus } from "../../definition/controller";
import { toast } from "../../mods/overlays";
import { Sheet, SheetAction } from "../Sheet";
import { colors } from "../theme";

export function AppMenu() {
  const [open, setOpen] = useState(false);
  const status = useSyncStatus();
  const go = (f: () => void) => () => {
    setOpen(false);
    f();
  };
  return (
    <>
      <Pressable hitSlop={10} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="App menu">
        <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)}>
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
