import {
  Cloud,
  Laptop,
  type LucideIcon,
  Mail,
  Send,
  Server,
} from 'lucide-react';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Cat } from '@/components/cat';
import { CONTACTS, GithubMark } from '@/components/shell/contacts';
import { routing } from '@/i18n/routing';

type Props = { params: Promise<{ locale: string }> };

const CLOUDFLARE_PRIVACY = 'https://www.cloudflare.com/privacypolicy/';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'Privacy' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: {
      canonical: `/${locale}/privacy`,
      languages: Object.fromEntries(
        routing.locales.map((code) => [code, `/${code}/privacy`]),
      ),
    },
    openGraph: {
      title: t('metaTitle'),
      description: t('metaDescription'),
      siteName: 'FilesDrop',
      locale,
      type: 'article',
    },
  };
}

/** A section is a heading and its blocks: paragraphs or one bulleted list. */
type Block = { p: string } | { list: string[] };
const SECTIONS: { id: string; blocks: Block[] }[] = [
  {
    id: 'store',
    blocks: [
      { p: 'intro' },
      { list: ['file', 'details', 'token', 'password'] },
      { p: 'nothingElse' },
    ],
  },
  { id: 'retention', blocks: [{ p: 'p1' }, { p: 'p2' }] },
  { id: 'access', blocks: [{ p: 'p1' }, { p: 'p2' }, { p: 'p3' }] },
  { id: 'ip', blocks: [{ p: 'p1' }, { p: 'p3' }, { p: 'p2' }] },
  { id: 'cookies', blocks: [{ p: 'p1' }, { p: 'p2' }] },
  {
    id: 'browser',
    blocks: [
      { p: 'intro' },
      { list: ['history', 'mode', 'panel'] },
      { p: 'outro' },
    ],
  },
  { id: 'infra', blocks: [{ p: 'p1' }, { p: 'p2' }, { p: 'p3' }] },
  { id: 'url', blocks: [{ p: 'p1' }] },
  { id: 'choices', blocks: [{ p: 'p1' }, { p: 'p2' }] },
  {
    id: 'rules',
    blocks: [
      { p: 'intro' },
      {
        list: [
          'asIs',
          'noStorage',
          'liability',
          'yours',
          'removal',
          'public',
          'reports',
          'changes',
        ],
      },
    ],
  },
];

const PLACES: { id: string; icon: LucideIcon }[] = [
  { id: 'server', icon: Server },
  { id: 'browser', icon: Laptop },
  { id: 'cloudflare', icon: Cloud },
];

const INLINE_LINK =
  'font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-current';

/** Tags the policy text may use, in every language. */
const rich = {
  code: (chunks: ReactNode) => (
    <code className="rounded-md bg-hover px-1.5 py-0.5 font-mono text-[0.875em] text-ink break-all">
      {chunks}
    </code>
  ),
  b: (chunks: ReactNode) => (
    <strong className="font-semibold text-ink">{chunks}</strong>
  ),
  cf: (chunks: ReactNode) => (
    <a
      href={CLOUDFLARE_PRIVACY}
      target="_blank"
      rel="noopener noreferrer"
      className={INLINE_LINK}
    >
      {chunks}
    </a>
  ),
  src: (chunks: ReactNode) => (
    <a
      href={CONTACTS.source}
      target="_blank"
      rel="noopener noreferrer"
      className={INLINE_LINK}
    >
      {chunks}
    </a>
  ),
  contact: (chunks: ReactNode) => (
    <a href="#contact" className={INLINE_LINK}>
      {chunks}
    </a>
  ),
};

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Privacy');
  const tCat = await getTranslations('Cat');
  const tShell = await getTranslations('Shell');
  const newTab = tShell('newTab');

  const contacts = [
    {
      key: 'email',
      href: `mailto:${CONTACTS.email}`,
      label: t('contact.email'),
      value: CONTACTS.email,
      icon: <Mail aria-hidden="true" className="size-5" />,
      external: false,
    },
    {
      key: 'telegram',
      href: CONTACTS.telegram,
      label: t('contact.telegram'),
      value: CONTACTS.telegramHandle,
      icon: <Send aria-hidden="true" className="size-5" />,
      external: true,
    },
    {
      key: 'github',
      href: CONTACTS.github,
      label: t('contact.github'),
      value: CONTACTS.githubHandle,
      icon: <GithubMark className="size-5" />,
      external: true,
    },
  ];

  return (
    <article className="pt-8 sm:pt-12">
      <header className="flex flex-col items-center text-center">
        <div className="w-36 sm:w-44">
          <Cat pose="empty" label={tCat('empty')} />
        </div>
        <h1 className="mt-1 font-display text-[clamp(2.25rem,6vw,3.25rem)] leading-[1.05] font-black tracking-[-0.03em] text-balance text-ink">
          {t('title')}
        </h1>
        <p className="mt-2 text-label text-ink-2">
          <time dateTime="2026-10-14">{t('updated')}</time>
        </p>
        <p className="mt-4 max-w-[46ch] text-[1.0625rem] leading-relaxed text-balance text-ink-2">
          {t('lead')}
        </p>
      </header>

      <section aria-labelledby="places-title" className="mt-10">
        <h2 id="places-title" className="sr-only">
          {t('placesTitle')}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {PLACES.map(({ id, icon: Icon }) => (
            <li key={id} className="glass rounded-surface p-4 sm:p-5">
              <Icon aria-hidden="true" className="size-5 text-ink-2" />
              <h3 className="mt-3 font-display text-[1.125rem] leading-snug font-extrabold text-ink">
                {t(`places.${id}.title`)}
              </h3>
              <p className="mt-1 text-body leading-relaxed text-ink-2">
                {t(`places.${id}.body`)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="glass-strong mt-4 rounded-sheet px-5 py-8 sm:px-10 sm:py-10">
        {SECTIONS.map(({ id, blocks }) => (
          <section
            key={id}
            id={id}
            aria-labelledby={`${id}-title`}
            className="mt-9 scroll-mt-24 first:mt-0"
          >
            <h2
              id={`${id}-title`}
              className="font-display text-[1.375rem] leading-tight font-extrabold tracking-[-0.01em] text-balance text-ink"
            >
              {t(`${id}.title`)}
            </h2>
            {blocks.map((block) =>
              'p' in block ? (
                <p
                  key={block.p}
                  className="mt-3 max-w-[65ch] text-[0.9375rem] leading-[1.7] text-ink-2"
                >
                  {t.rich(`${id}.${block.p}`, rich)}
                </p>
              ) : (
                <ul
                  key={block.list.join()}
                  className="mt-3 max-w-[65ch] list-disc space-y-2 pl-5 text-[0.9375rem] leading-[1.7] text-ink-2 marker:text-ink-2/60"
                >
                  {block.list.map((item) => (
                    <li key={item}>{t.rich(`${id}.${item}`, rich)}</li>
                  ))}
                </ul>
              ),
            )}
          </section>
        ))}

        <section
          id="contact"
          aria-labelledby="contact-title"
          className="mt-9 scroll-mt-24"
        >
          <h2
            id="contact-title"
            className="font-display text-[1.375rem] leading-tight font-extrabold tracking-[-0.01em] text-ink"
          >
            {t('contact.title')}
          </h2>
          <p className="mt-3 max-w-[65ch] text-[0.9375rem] leading-[1.7] text-ink-2">
            {t('contact.p1')}
          </p>
          <ul className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {contacts.map((c) => (
              <li key={c.key}>
                <a
                  href={c.href}
                  {...(c.external
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                  aria-label={
                    c.external
                      ? `${c.label}: ${c.value} ${newTab}`
                      : `${c.label}: ${c.value}`
                  }
                  className="flex min-h-12 items-center gap-3 rounded-full bg-hover py-2 pr-5 pl-3.5 text-ink transition-colors duration-(--dur-fast) hover:bg-raised"
                >
                  <span className="text-ink-2">{c.icon}</span>
                  <span className="flex flex-col text-left leading-tight">
                    <span className="text-label text-ink-2">{c.label}</span>
                    <span className="text-[0.9375rem] font-semibold break-all">
                      {c.value}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-[65ch] text-[0.9375rem] leading-[1.7] text-ink-2">
            {t('contact.closing')}
          </p>
        </section>
      </div>
    </article>
  );
}
