import type { LookupMap } from '../types';
import type { LookupInsertRow } from '../repositories/lookupRepository';

/**
 * Builds an in-memory lookup map from persisted lookup rows.
 * Keys: lookup_group -> lookup_key -> lookup_value
 */
export function buildLookupMap(lookups: Array<{ lookup_group: string; lookup_key: string; lookup_value: string }>): LookupMap {
  const map: LookupMap = {};
  for (const l of lookups) {
    if (!map[l.lookup_group]) map[l.lookup_group] = {};
    map[l.lookup_group][l.lookup_key] = l.lookup_value;
  }
  return map;
}

/**
 * Resolves a value using the lookup map.
 * Tries common group names for zone/area.
 */
export function resolveLookup(
  map: LookupMap,
  rawValue: string | number | null | undefined,
  groups: string[]
): string | null {
  if (rawValue == null || rawValue === '') return null;
  const key = String(rawValue).trim();
  if (!key) return null;
  for (const group of groups) {
    const resolved = map[group]?.[key];
    if (resolved) return resolved;
  }
  return null;
}

/**
 * Zone/area resolution - most important business field.
 * TODO: Adjust group names after seeing real lookup XML.
 */
export const ZONE_LOOKUP_GROUPS = [
  'zona', 'zone', 'zone_affari', 'area', 'aree', 'quartiere', 'localita',
];

/**
 * Property type resolution.
 */
export const PROPERTY_TYPE_LOOKUP_GROUPS = [
  'tipo_immobile', 'tipologia', 'property_type', 'categoria',
];

/**
 * Contract type resolution.
 */
export const CONTRACT_TYPE_LOOKUP_GROUPS = [
  'tipo_contratto', 'contratto', 'contract_type',
];
