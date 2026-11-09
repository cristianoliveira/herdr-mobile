import { useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CORNER_ACTIONS, CORNER_ACTION_SIZE, CORNER_TRIGGER_SIZE, cornerActionAt, cornerRelease, type CornerAction } from "../corner-actions";
import { colors } from "./theme";

type Props = {
  open: boolean;
  connected: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: () => void;
  onNew: () => void;
  onActivity: () => void;
};

const accessibilityLabels = { search: "Search spaces and agents", new: "Open a project", activity: "View session activity" };

export function CornerActions(props: Props) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<CornerAction | null>(null);
  const live = useRef(props);
  live.current = props;
  const trigger = useRef<View>(null);
  const center = useRef<{ x: number; y: number } | null>(null);
  const drag = useRef({ x: 0, y: 0, moved: false, wasOpen: false, cancelled: false });

  const close = () => {
    drag.current.cancelled = true;
    setSelected(null);
    live.current.onOpenChange(false);
  };
  const activate = (action: CornerAction) => {
    close();
    if (action !== "activity" && !live.current.connected) return;
    if (action === "search") live.current.onSearch();
    else if (action === "new") live.current.onNew();
    else live.current.onActivity();
  };

  useEffect(() => {
    if (!props.open) {
      drag.current.cancelled = true;
      setSelected(null);
      return;
    }
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => back.remove();
  }, [props.open]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: (event) => event.nativeEvent.touches.length === 1,
    onPanResponderGrant: (_, gesture) => {
      const origin = center.current ?? { x: gesture.x0, y: gesture.y0 };
      drag.current = { ...origin, moved: false, wasOpen: live.current.open, cancelled: false };
      setSelected(null);
      live.current.onOpenChange(true);
    },
    onPanResponderStart: (event) => {
      if (event.nativeEvent.touches.length > 1) {
        drag.current.cancelled = true;
        setSelected(null);
      }
    },
    onPanResponderMove: (event, gesture) => {
      if (gesture.numberActiveTouches !== 1) drag.current.cancelled = true;
      if (Math.hypot(gesture.dx, gesture.dy) > 12) drag.current.moved = true;
      const x = event.nativeEvent.pageX - drag.current.x;
      const y = event.nativeEvent.pageY - drag.current.y;
      setSelected(drag.current.cancelled ? null : cornerActionAt(x, y, live.current.connected));
    },
    onPanResponderRelease: (event) => {
      const result = cornerRelease(event.nativeEvent.pageX - drag.current.x, event.nativeEvent.pageY - drag.current.y,
        { ...drag.current, connected: live.current.connected });
      if (result === "open") live.current.onOpenChange(true);
      else if (result === "close") close();
      else activate(result);
    },
    onPanResponderTerminate: close,
  }), []);

  const right = insets.right + 20;
  const bottom = insets.bottom + 20;
  return (
    <View pointerEvents="box-none" style={styles.overlay} accessibilityViewIsModal={props.open}>
      {props.open && <Pressable accessible={false} onPress={close} style={styles.backdrop} />}
      <View
        ref={trigger}
        collapsable={false}
        onLayout={() => trigger.current?.measureInWindow((x, y, width, height) => { center.current = { x: x + width / 2, y: y + height / 2 }; })}
        style={[styles.triggerPosition, { right, bottom }]}
        {...pan.panHandlers}
      >
        <Pressable
          onPress={() => live.current.onOpenChange(!live.current.open)}
          onAccessibilityEscape={close}
          accessibilityRole="button"
          accessibilityLabel={props.open ? "Close actions" : "Open actions"}
          accessibilityHint="Tap to expand, or hold and slide to Search, New or Activity."
          accessibilityState={{ expanded: props.open }}
          style={[styles.trigger, props.open && styles.triggerOpen]}
        >
          <View pointerEvents="none"><Text style={[styles.triggerText, props.open && styles.triggerTextOpen]}>{props.open ? "Close" : "Menu"}</Text></View>
        </Pressable>
      </View>
      {props.open && CORNER_ACTIONS.map((action) => {
        const disabled = action.requiresConnection && !props.connected;
        const highlighted = selected === action.key;
        return <Pressable
          key={action.key}
          onPress={() => activate(action.key)}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabels[action.key]}
          accessibilityState={{ disabled, selected: highlighted }}
          disabled={disabled}
          style={({ pressed }) => [styles.action, {
            right: right - action.x + (CORNER_TRIGGER_SIZE - CORNER_ACTION_SIZE) / 2,
            bottom: bottom - action.y + (CORNER_TRIGGER_SIZE - CORNER_ACTION_SIZE) / 2,
          }, (highlighted || pressed) && styles.highlighted, disabled && styles.disabled]}
        >
          <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1} style={[styles.actionText, highlighted && styles.highlightedText]}>{action.label}</Text>
        </Pressable>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 50 },
  backdrop: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: colors.backdrop },
  triggerPosition: { position: "absolute", width: CORNER_TRIGGER_SIZE, height: CORNER_TRIGGER_SIZE },
  trigger: { flex: 1, borderRadius: CORNER_TRIGGER_SIZE / 2, backgroundColor: colors.accent, borderWidth: 1, borderColor: colors.accent, alignItems: "center", justifyContent: "center" },
  triggerOpen: { backgroundColor: colors.surfaceHigh },
  triggerText: { color: colors.onAccent, fontSize: 13, fontWeight: "700" },
  triggerTextOpen: { color: colors.accent },
  action: { position: "absolute", width: CORNER_ACTION_SIZE, height: CORNER_ACTION_SIZE, borderRadius: CORNER_ACTION_SIZE / 2, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border },
  actionText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  highlighted: { backgroundColor: colors.accent, borderColor: colors.accent },
  highlightedText: { color: colors.onAccent },
  disabled: { opacity: 0.45 },
});
