import type { ParsedGestimFilename } from '../types';

/**
 * Parses Gestim XML filenames to extract agency_code, site_code, and file kind.
 * Examples:
 *   3898_270_annunci.xml -> { agencyCode: "3898", siteCode: "270", kind: "annunci" }
 *   3898_270_lookup.xml  -> { agencyCode: "3898", siteCode: "270", kind: "lookup" }
 *   270_lookup.xml       -> { agencyCode: null, siteCode: "270", kind: "lookup" }
 */
export function parseGestimFilename(filename: string): ParsedGestimFilename | null {
  const base = filename.replace(/\.xml$/i, '').trim();
  if (!base) return null;

  const parts = base.split('_');
  if (parts.length < 2) return null;

  const kindMatch = base.match(/_?(annunci|agenzie|agenti|lookup)$/i);
  const kind = kindMatch?.[1]?.toLowerCase() as 'annunci' | 'agenzie' | 'agenti' | 'lookup' | undefined;
  if (!kind || !['annunci', 'agenzie', 'agenti', 'lookup'].includes(kind)) return null;

  const beforeKind = base.replace(new RegExp(`_?${kind}$`, 'i'), '');
  const codes = beforeKind.split('_').filter(Boolean);

  if (codes.length === 2) {
    return { agencyCode: codes[0], siteCode: codes[1], kind };
  }
  if (codes.length === 1) {
    return { agencyCode: null, siteCode: codes[0], kind };
  }

  return null;
}
