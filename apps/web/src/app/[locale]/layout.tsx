import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { DocumentLang } from '@/components/shell/document-lang';
import { routing } from '@/i18n/routing';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Omit<Props, 'children'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'Meta' });
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((code) => [code, `/${code}`]),
      ),
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      siteName: 'FilesDrop',
      locale,
      type: 'website',
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <NextIntlClientProvider>
      <DocumentLang locale={locale} />
      <AppShell>{children}</AppShell>
    </NextIntlClientProvider>
  );
}
