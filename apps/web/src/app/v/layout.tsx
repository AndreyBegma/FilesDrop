import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { DocumentLang } from '@/components/shell/document-lang';

/**
 * `/v/*` has no locale prefix (Decision 11): a shared link opens in the
 * recipient's language — the `NEXT_LOCALE` cookie, then `Accept-Language`,
 * then English, as resolved by i18n/request.ts. Same frame as the home page.
 */
export default async function PreviewLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = await getLocale();
  return (
    <NextIntlClientProvider>
      <DocumentLang locale={locale} />
      <AppShell>{children}</AppShell>
    </NextIntlClientProvider>
  );
}
