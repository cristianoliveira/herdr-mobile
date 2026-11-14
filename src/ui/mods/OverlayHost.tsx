// Draws what mods open over the screen: sheets from the bottom, dialogs in
// the middle, toasts at the top. Each is a mod copy with props().overlay.
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppData } from "../../mods/app-data";
import { closeOverlay, useOverlays } from "../../mods/overlays";
import { useKeyboardHeight } from "../keyboard";
import { ModBlock } from "./ModBlock";

export function OverlayHost() {
  const overlays = useOverlays();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const { theme: t } = useAppData();
  const toasts = overlays.filter((o) => o.kind === "toast");
  return (
    <>
      {overlays
        .filter((o) => o.kind !== "toast")
        .map((o) => (
          <Modal key={o.id} visible transparent animationType={o.kind === "sheet" ? "slide" : "fade"} onRequestClose={() => closeOverlay(o.id)} statusBarTranslucent navigationBarTranslucent>
            <Pressable style={styles.backdrop} onPress={() => closeOverlay(o.id)} accessibilityLabel="Close" />
            {o.kind === "sheet" ? (
              <View style={[styles.sheet, { backgroundColor: t.popover, paddingBottom: (keyboard || insets.bottom) + 8 }]}>
                <View style={[styles.handle, { backgroundColor: t.border }]} />
                <ModBlock mod={o.mod} props={o.props} copyId={`overlay/${o.mod}`} overlay={o.id} />
              </View>
            ) : (
              <View style={styles.center} pointerEvents="box-none">
                <View style={[styles.dialog, { backgroundColor: t.popover, borderColor: t.border }]}>
                  <ModBlock mod={o.mod} props={o.props} copyId={`overlay/${o.mod}`} overlay={o.id} />
                </View>
              </View>
            )}
          </Modal>
        ))}
      {toasts.length > 0 && (
        <View style={[styles.toasts, { top: insets.top + 8 }]} pointerEvents="box-none">
          {toasts.map((o) => (
            <View key={o.id} style={[styles.toast, { backgroundColor: t.popover, borderColor: t.border }]}>
              <ModBlock mod={o.mod} props={o.props} copyId="overlay/toast" overlay={o.id} />
            </View>
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "85%", borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 8 },
  handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, marginBottom: 8 },
  center: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center", padding: 24 },
  dialog: { width: "100%", maxWidth: 420, maxHeight: "80%", borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  toasts: { position: "absolute", left: 12, right: 12, gap: 8 },
  toast: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
});
