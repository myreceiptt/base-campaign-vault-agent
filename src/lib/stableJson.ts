export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stableStringify(value: Json): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: Json): Json {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!isPlainObject(value)) return value;

  const keys = Object.keys(value).sort();
  const out: Record<string, Json> = {};
  for (const key of keys) {
    out[key] = sortJson(value[key] as Json);
  }
  return out;
}

