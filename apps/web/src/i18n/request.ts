import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { negotiateLocale } from './negotiate';
import { isLocale, LOCALE_COOKIE, type Locale } from './routing';

/**
 * Pages under `/[locale]` get their locale from the segment (the proxy sets
 * it on the request). Routes outside it — `/f/*` and `/v/*`, which carry no
 * prefix by design (Decision 11) — fall back to the visitor's own choice:
 * the `NEXT_LOCALE` cookie, then `Accept-Language`, then English.
 */
async function resolveUnprefixedLocale(): Promise<Locale> {
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  return negotiateLocale((await headers()).get('accept-language'));
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isLocale(requested)
    ? requested
    : await resolveUnprefixedLocale();

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
