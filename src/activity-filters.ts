import AsyncStorage from "@react-native-async-storage/async-storage";
import { ACTIVITY_KIND_LABELS, EMPTY_ACTIVITY_FILTERS, type ActivityFilters } from "./activity";

const KEY = "activity-filters.v1";
let writes: Promise<void> = Promise.resolve();

function validatedFilters(value: unknown): ActivityFilters {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Saved Activity filters are invalid.");
  }
  const saved = value as Record<string, unknown>;
  const kind = saved.kind === undefined ? null : saved.kind;
  if ((saved.machine !== null && typeof saved.machine !== "string")
    || (saved.space !== null && typeof saved.space !== "string")
    || (kind !== null && (typeof kind !== "string" || !Object.hasOwn(ACTIVITY_KIND_LABELS, kind)))) {
    throw new Error("Saved Activity filters are invalid.");
  }
  return { machine: saved.machine as string | null, space: saved.space as string | null, kind: kind as ActivityFilters["kind"] };
}

export async function loadActivityFilters(): Promise<ActivityFilters> {
  // Returning to the list must not read storage before an in-flight save finishes.
  await writes;
  const raw = await AsyncStorage.getItem(KEY);
  return raw === null ? { ...EMPTY_ACTIVITY_FILTERS } : validatedFilters(JSON.parse(raw));
}

export function saveActivityFilters(filters: ActivityFilters): Promise<void> {
  const next = validatedFilters(filters);
  const write = writes.then(() => AsyncStorage.setItem(KEY, JSON.stringify(next)));
  writes = write.then(() => {}, () => {});
  return write;
}
