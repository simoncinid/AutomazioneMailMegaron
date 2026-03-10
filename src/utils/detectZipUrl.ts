/**
 * Detects the ZIP download URL from query parameters.
 * Gestim may pass the URL in various parameter names.
 */
const PREFERRED_KEYS = ['callback', 'download_url', 'zip_url', 'url', 'zip', 'file'];

function looksLikeUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

export function detectZipUrl(query: Record<string, unknown>): string | null {
  // Priority 1: Known keys
  for (const key of PREFERRED_KEYS) {
    const value = query[key];
    if (value === undefined) continue;
    const candidate = Array.isArray(value) ? value[0] : value;
    if (looksLikeUrl(candidate)) return String(candidate).trim();
  }

  // Priority 2: Single param that looks like URL
  const keys = Object.keys(query);
  if (keys.length === 1) {
    const value = query[keys[0]];
    const candidate = Array.isArray(value) ? value[0] : value;
    if (looksLikeUrl(candidate)) return String(candidate).trim();
  }

  // Priority 3: First value that looks like URL
  for (const key of keys) {
    const value = query[key];
    const candidate = Array.isArray(value) ? value[0] : value;
    if (looksLikeUrl(candidate)) return String(candidate).trim();
  }

  return null;
}
