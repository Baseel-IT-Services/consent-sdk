/**
 * Deletes first-party cookies whose names start with any of the prefixes, e.g. `['_ga', '_clck']`
 * when the user withdraws Analytics. Only reaches cookies on the merchant's own domain;
 * cookies on vendor domains cannot be removed from the page. Returns the names it removed.
 */
export function deleteCookiesByPrefix(prefixes: string[]): string[] {
  if (typeof document === 'undefined' || !Array.isArray(prefixes)) return [];
  const wanted = prefixes.filter(p => typeof p === 'string' && p !== '');
  if (wanted.length === 0) return [];

  const names = document.cookie
    .split(';')
    .map(c => c.split('=')[0].trim())
    .filter(n => n !== '' && wanted.some(p => n.startsWith(p)));

  // A cookie set for ".example.com" must be expired with that same domain attribute.
  const parts = location.hostname.split('.');
  const domains = parts.map((_, i) => parts.slice(i).join('.')).filter(d => d.includes('.'));

  for (const name of names) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/; domain=.${domain}`;
    }
  }
  return names;
}
