import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ActivityItem } from "./activity";

const KEY = "activity-dismissals.v1";
let dismissed: Record<string, string> = {};
let loaded = false;
let loadPromise: Promise<Record<string, string>> | null = null;
let writes: Promise<void> = Promise.resolve();

export function loadActivityDismissals(): Promise<Record<string, string>> {
  if (loaded) return Promise.resolve(dismissed);
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(KEY).then((raw) => {
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)
        || Object.values(parsed).some((value) => typeof value !== "string")) {
        throw new Error("Saved Activity dismissals are invalid.");
      }
      dismissed = parsed as Record<string, string>;
      loaded = true;
      return dismissed;
    }).catch((error) => {
      loadPromise = null;
      throw error;
    });
  }
  return loadPromise;
}

export function dismissActivityItems(items: ActivityItem[]): Promise<Record<string, string>> {
  return updateDismissals((current) => ({
    ...current,
    ...Object.fromEntries(items.map((item) => [item.session.key, item.fingerprint])),
  }));
}

export function undoActivityItems(items: ActivityItem[]): Promise<Record<string, string>> {
  return updateDismissals((current) => {
    const next = { ...current };
    for (const item of items) {
      if (next[item.session.key] === item.fingerprint) delete next[item.session.key];
    }
    return next;
  });
}

function updateDismissals(update: (current: Record<string, string>) => Record<string, string>): Promise<Record<string, string>> {
  const write = writes.then(async () => {
    await loadActivityDismissals();
    const next = update(dismissed);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    dismissed = next;
    return next;
  });
  writes = write.then(() => {}, () => {});
  return write;
}
