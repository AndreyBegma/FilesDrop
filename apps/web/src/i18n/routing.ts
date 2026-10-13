import { defineRouting } from 'next-intl/routing';

export const LOCALES = ['en', 'uk'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'NEXT_LOCALE';
/** One year: the choice is remembered, nothing else is (Decision 12). */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
  localeCookie: {
    name: LOCALE_COOKIE,
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: 'lax',
  },
});

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && LOCALES.includes(value as Locale);
}
