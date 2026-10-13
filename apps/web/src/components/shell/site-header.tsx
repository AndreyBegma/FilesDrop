'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { HistoryToggle } from './history-toggle';
import { LanguageSwitcher } from './language-switcher';
import { LogoMark } from './logo-mark';

/**
 * The glass capsule on top: brand on the left, language and history on the
 * right. `logo` is the slot the mascot's head takes over later.
 */
export function SiteHeader({ logo }: { logo?: ReactNode }) {
  const t = useTranslations('Shell');
  const locale = useLocale();

  return (
    <header className="sticky top-3 z-chrome sm:top-5">
      <div className="glass flex h-14 items-center gap-1 rounded-full py-1.5 pr-1.5 pl-1.5 sm:gap-3 sm:pl-2">
        <Link
          href={`/${locale}`}
          aria-label={t('home')}
          className="flex h-11 items-center gap-2 rounded-full pr-2 pl-1"
        >
          {logo ?? <LogoMark className="size-9" />}
          <span className="font-display text-[1.3rem] font-extrabold tracking-[-0.02em] text-ink max-[22rem]:sr-only">
            FilesDrop
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-0.5 sm:gap-2">
          <LanguageSwitcher />
          <span
            aria-hidden="true"
            className="hidden h-6 w-px bg-line-strong sm:block"
          />
          <HistoryToggle />
        </div>
      </div>
    </header>
  );
}
