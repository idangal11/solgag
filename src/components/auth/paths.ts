// Redirect-target helpers shared by the login page, the auth callback route and
// the account page. Pure functions: safe on both server and client.

/**
 * Returns `raw` only when it is a same-site path ("/…", not "//…" or "/\…"),
 * otherwise "/". Auth pages are never a valid target (avoids redirect loops).
 */
export function safeNextPath(raw: unknown): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string' || value.length > 2000) return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  // Browsers drop tabs/newlines and treat "\" like "/" in URLs, so "/\t/evil.com" could become "//evil.com".
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return '/';
  if (/^\/(login|auth)(\/|\?|#|$)/.test(value)) return '/';
  return value;
}

/** Onboarding step for accounts without a name: the account page continues to `next` after saving. */
export function welcomePath(next: string): string {
  return `/account?welcome=1&next=${encodeURIComponent(safeNextPath(next))}`;
}
