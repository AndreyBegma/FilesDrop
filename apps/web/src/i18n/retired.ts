/** Locales the site once served. Their links redirect to English for good. */
export const RETIRED_LOCALES: readonly string[] = ['ru'];

/**
 * `/ru` → `/en`, `/ru/privacy` → `/en/privacy`. Returns null for every path
 * that does not start with a retired locale.
 */
export function retiredLocaleRedirect(pathname: string): string | null {
  const [, first = '', ...rest] = pathname.split('/');
  if (!RETIRED_LOCALES.includes(first)) return null;
  return rest.length ? `/en/${rest.join('/')}` : '/en';
}
