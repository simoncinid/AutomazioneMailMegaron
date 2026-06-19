/**
 * Detects the ZIP download URL from query parameters.
 * Gestim may pass the URL in various parameter names.
 */
const PREFERRED_KEYS = ['download_url', 'zip_url', 'url', 'zip', 'file', 'callback'];

function scoreCandidate(url: string): number {
  const lower = url.toLowerCase();
  let score = 0;
  if (lower.includes('/feeds/sites/')) score += 100;
  if (lower.endsWith('.zip') || lower.includes('.zip?')) score += 60;
  if (lower.includes('gestim')) score += 20;
  if (lower.includes('/webhooks/')) score -= 80;
  if (lower.includes('callback=')) score -= 20;
  return score;
}

function looksLikeUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

export function detectZipUrl(query: Record<string, unknown>): string | null {
  const candidates: Array<{ key: string; url: string; score: number; priority: number }> = [];

  const pushCandidate = (key: string, value: unknown): void => {
    if (value === undefined) return;
    const candidate = Array.isArray(value) ? value[0] : value;
    if (!looksLikeUrl(candidate)) return;
    const url = String(candidate).trim();
    const priority = PREFERRED_KEYS.indexOf(key);
    candidates.push({
      key,
      url,
      score: scoreCandidate(url),
      priority: priority >= 0 ? priority : Number.MAX_SAFE_INTEGER,
    });
  };

  // Priority 1: Known keys
  for (const key of PREFERRED_KEYS) {
    pushCandidate(key, query[key]);
  }

  // Priority 2: Any other value that looks like URL
  const keys = Object.keys(query);
  for (const key of keys) {
    if (PREFERRED_KEYS.includes(key)) continue;
    pushCandidate(key, query[key]);
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.priority - b.priority;
  });

  const best = candidates[0];
  if (!best) return null;

  if (best.score < 0) {
    const nonNegative = candidates.find((c) => c.score >= 0);
    if (nonNegative) return nonNegative.url;
  }

  return best.url;
}
