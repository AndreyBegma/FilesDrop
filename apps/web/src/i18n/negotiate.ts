import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from './routing';

/**
 * Picks a locale from an `Accept-Language` header, honouring q-values.
 * `uk-UA` matches `uk`; anything unknown falls through to the default.
 */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      return {
        base: tag.toLowerCase().split('-')[0],
        q: q ? Number.parseFloat(q.slice(2)) || 0 : 1,
        index,
      };
    })
    .filter((entry) => entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  const hit = ranked.find((entry) => LOCALES.includes(entry.base as Locale));
  return hit && isLocale(hit.base) ? hit.base : DEFAULT_LOCALE;
}
