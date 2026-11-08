import { useEffect, useRef, type ReactNode } from "react";
import { BackHandler, Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardHeight } from "./keyboard";
import { colors } from "./theme";

export function Sheet({ visible, onClose, onShow, contentStyle, inline = false, children }: {
  visible: boolean;
  onClose: () => void;
  onShow?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  inline?: boolean;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const closeRef = useRef(onClose);
  const showRef = useRef(onShow);
  closeRef.current = onClose;
  showRef.current = onShow;

  useEffect(() => {
    if (!inline || !visible) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      closeRef.current();
      return true;
    });
    showRef.current?.();
    return () => subscription.remove();
  }, [inline, visible]);

  if (inline) {
    if (!visible) return null;
    return (
      <View style={styles.inlineOverlay} accessibilityViewIsModal>
        <Pressable style={styles.inlineBackdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.inlineSheet, { paddingBottom: (keyboard || insets.bottom) + 12, maxHeight: "90%" }, contentStyle]}>
          <View style={styles.handle} />
          {children}
        </View>
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onShow={onShow} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: (keyboard || insets.bottom) + 12, maxHeight: "85%" }, contentStyle]}>
        <View style={styles.handle} />
        {children}
      </View>
    </Modal>
  );
}

export function SheetAction({ label, detail, onPress, danger, disabled }: { label: string; detail?: string; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <Pressable style={({ pressed }) => [styles.action, pressed && styles.pressed, disabled && { opacity: 0.4 }]} onPress={onPress} disabled={disabled}>
      <Text style={[styles.actionText, danger && { color: colors.blocked }]}>{label}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.backdrop },
  inlineOverlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000, justifyContent: "flex-end" },
  inlineBackdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.backdrop },
  inlineSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 8, paddingHorizontal: 8 },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 8, paddingHorizontal: 8 },
  handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 8 },
  action: { paddingVertical: 14, paddingHorizontal: 14, borderRadius: 10 },
  pressed: { backgroundColor: colors.surfaceHigh },
  actionText: { color: colors.text, fontSize: 16 },
  detail: { color: colors.muted, fontSize: 13, marginTop: 2 },
});
