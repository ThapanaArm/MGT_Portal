import legacyLabels from "./legacy-English.json";

// Normalize known demo values without discarding records entered by the user.
export function englishData<T>(value: T): T {
  if (typeof value === "string") {
    return ((legacyLabels as Record<string, string>)[value] ?? value) as T;
  }
  if (Array.isArray(value)) return value.map(item => englishData(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, englishData(item)])) as T;
  }
  return value;
}
