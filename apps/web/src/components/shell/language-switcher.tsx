'use client';

import {
  SegmentedControl,
  SegmentedControlItem,
} from '@andrewbehma/glass-ui/segmented-control';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { MouseEvent } from 'react';
import {
  isLocale,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALES,
  type Locale,
} from '@/i18n/routing';

/** What the switch shows, and the language's own name for a screen reader.
    Ukrainian shows `UA`: `UK` reads as the United Kingdom. */
const LANGUAGES: Record<Locale, { short: string; name: string }> = {
  en: { short: 'EN', name: 'English' },
  uk: { short: 'UA', name: 'Українська' },
};

/** `/uk/v/x` → `['uk', '/v/x']`; `/v/x` → `[null, '/v/x']`. */
function splitLocale(pathname: string): [Locale | null, string] {
  const [, first = '', ...rest] = pathname.split('/');
  return isLocale(first) ? [first, `/${rest.join('/')}`] : [null, pathname];
}

function rememberLocale(locale: Locale) {
  // biome-ignore lint/suspicious/noDocumentCookie: one cookie, no library needed.
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * Rewrites the locale prefix and remembers the choice in `NEXT_LOCALE`
 * (Decision 11). On a route without a prefix (`/v/…`) it only sets the
 * cookie and re-renders, so a shared link keeps its URL.
 */
export function LanguageSwitcher() {
  const t = useTranslations('Shell');
  const current = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [prefix, rest] = splitLocale(pathname);

  const hrefFor = (locale: Locale) =>
    prefix ? `/${locale}${rest === '/' ? '' : rest}` : pathname;

  const onSelect = (event: MouseEvent<HTMLAnchorElement>, locale: Locale) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    if (locale === current) return;
    rememberLocale(locale);
    if (prefix) {
      const { search, hash } = window.location;
      router.replace(`${hrefFor(locale)}${search}${hash}`, { scroll: false });
    } else {
      router.refresh();
    }
  };

  return (
    <nav aria-label={t('language')}>
      <SegmentedControl
        variant="on-glass"
        className="rounded-full border-transparent p-0 [&>li>span]:rounded-full"
      >
        {LOCALES.map((locale) => {
          const active = locale === current;
          const { short, name } = LANGUAGES[locale];
          return (
            <SegmentedControlItem
              key={locale}
              active={active}
              layoutId="fd-language"
            >
              <Link
                href={hrefFor(locale)}
                hrefLang={locale}
                lang={locale}
                aria-label={name}
                title={name}
                aria-current={active ? 'true' : undefined}
                onClick={(event) => onSelect(event, locale)}
                prefetch={false}
                className={
                  active
                    ? 'relative z-10 flex h-11 min-w-11 items-center justify-center rounded-full px-2 sm:px-2.5 text-label font-bold tracking-wide'
                    : 'relative z-10 flex h-11 min-w-11 items-center justify-center rounded-full px-2 sm:px-2.5 text-label font-bold tracking-wide text-ink-2 transition-colors duration-(--dur-fast) hover:text-ink'
                }
              >
                {short}
              </Link>
            </SegmentedControlItem>
          );
        })}
      </SegmentedControl>
    </nav>
  );
}
