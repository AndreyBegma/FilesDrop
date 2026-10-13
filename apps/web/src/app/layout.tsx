import type { Metadata } from 'next';
import { Inter, Nunito } from 'next/font/google';
import { cookies } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { SkyBackdrop } from '@/components/shell/sky-backdrop';
import {
  parseTheme,
  THEME_COOKIE,
  themeAttribute,
} from '@/components/shell/theme';
import './globals.css';

/** Display face: rounded, like the mascot's line. */
const nunito = Nunito({
  subsets: ['latin', 'cyrillic'],
  weight: ['700', '800', '900'],
  variable: '--font-nunito',
  display: 'swap',
});

/** glass-ui's default UI stack reads `var(--font-inter)` after SF Pro. */
const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:4747',
  ),
  applicationName: 'FilesDrop',
  title: 'FilesDrop',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // `[locale]` pages get it from the segment; `/f` and `/v` from the cookie
  // or Accept-Language (see i18n/request.ts).
  const locale = await getLocale();

  // Theme follows the system (Decision 12) unless the visitor forced light or
  // dark with the header switch: then `data-theme` is rendered here, on the
  // server, so the first paint is already right.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang={locale}
      data-theme={themeAttribute(theme)}
      data-accent="amber"
      className={`${nunito.variable} ${inter.variable}`}
    >
      <body className="font-sans text-body">
        <SkyBackdrop />
        {children}
      </body>
    </html>
  );
}
