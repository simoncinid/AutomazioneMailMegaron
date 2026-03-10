/**
 * Defensive XML parsing helpers for Gestim.
 * TODO: Adjust tag mappings after inspecting real Gestim XML structure.
 */

export function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function getNestedValue(
  obj: Record<string, unknown> | undefined | null,
  path: string[]
): unknown {
  if (!obj) return undefined;
  let current: unknown = obj;
  for (const key of path) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export function toNullableString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

export function toNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}
