import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { HistoryPanel } from '@/components/history/history-panel';
import { ShellProvider } from './shell-context';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';
import { parseTheme, THEME_COOKIE } from './theme';

/**
 * The app frame: skip link, the glass header, one centred column, the footer.
 * `#main-content` is the element glass-ui's depth effect pushes back under a
 * sheet; the sky stays outside it (mounted by the root layout).
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const t = await getTranslations('Shell');
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <ShellProvider>
      <a
        href="#content"
        className="sr-only z-top rounded-full bg-paper px-4 py-2 text-body font-semibold text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t('skipToContent')}
      </a>
      <div
        id="main-content"
        className="mx-auto flex min-h-dvh w-full max-w-[46rem] flex-col xl:max-w-[50rem] px-4 sm:px-6"
      >
        <SiteHeader theme={theme} />
        <main id="content" tabIndex={-1} className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </div>
      <HistoryPanel />
    </ShellProvider>
  );
}
