import { buttonClassName } from '@andrewbehma/glass-ui/button';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Cat } from '@/components/cat';
import { formatBytes } from '@/components/drop/format';
import { isThumbnailable, rawPath } from '@/components/drop/links';
import { LockedPreview } from '@/components/drop/locked-preview';
import { PreviewBody } from '@/components/drop/preview-body';
import { lookupFile, webOrigin } from './meta';

type Props = { params: Promise<{ slug: string }> };

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations('Preview');
  const found = await lookupFile(slug);
  const robots = { index: false, follow: false };
  if (found.status === 'locked') {
    // Nothing about the file itself: a generic title and the cat card.
    const image = `${webOrigin()}/v/${found.slug}/og`;
    const title = t('lockedOgTitle');
    const description = t('lockedOgDescription');
    return {
      title: `${title} · FilesDrop`,
      description,
      robots,
      openGraph: {
        title,
        description,
        siteName: 'FilesDrop',
        type: 'website',
        url: `${webOrigin()}/v/${found.slug}`,
        images: [{ url: image, alt: title }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [image],
      },
    };
  }
  if (found.status !== 'ok') {
    return { title: `${t('goneTitle')} · FilesDrop`, robots };
  }
  const { meta } = found;
  const locale = await getLocale();
  const image = isThumbnailable(meta)
    ? `${webOrigin()}${rawPath(meta)}`
    : `${webOrigin()}/v/${meta.slug}/og`;
  const description = t('ogDescription', {
    size: formatBytes(meta.size, locale),
  });
  return {
    title: `${meta.name} · FilesDrop`,
    description,
    robots,
    openGraph: {
      title: meta.name,
      description,
      siteName: 'FilesDrop',
      type: 'website',
      url: `${webOrigin()}/v/${meta.slug}`,
      images: [{ url: image, alt: meta.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.name,
      description,
      images: [image],
    },
  };
}

async function Gone({ expired }: { expired: boolean }) {
  const t = await getTranslations('Preview');
  const tCat = await getTranslations('Cat');
  return (
    <div className="flex flex-col items-center pt-10 text-center sm:pt-16">
      <div className="w-56 sm:w-64">
        <Cat pose="not-found" label={tCat('not-found')} />
      </div>
      <h1 className="mt-2 font-display text-[clamp(1.75rem,5vw,2.5rem)] leading-tight font-black tracking-[-0.02em] text-balance text-ink">
        {expired ? t('expiredTitle') : t('notFoundTitle')}
      </h1>
      <p className="mt-3 max-w-[38ch] text-body text-balance text-ink-2">
        {expired ? t('expiredBody') : t('notFoundBody')}
      </p>
      <Link
        href="/"
        className={buttonClassName({
          variant: 'solid',
          className: 'mt-7 h-12 rounded-full px-6 font-bold',
        })}
      >
        {t('dropYourOwn')}
      </Link>
    </div>
  );
}

export default async function PreviewPage({ params }: Props) {
  const { slug } = await params;
  const found = await lookupFile(slug);
  const t = await getTranslations('Preview');
  const tCat = await getTranslations('Cat');

  const dropYourOwn = (
    <p className="mt-6 text-center text-label text-ink-2">
      <Link
        href="/"
        className="font-semibold text-ink underline-offset-4 hover:underline"
      >
        {t('dropYourOwn')}
      </Link>
    </p>
  );

  if (found.status === 'locked') {
    return (
      <>
        <LockedPreview slug={found.slug} expiresAt={found.expiresAt} />
        {dropYourOwn}
      </>
    );
  }
  if (found.status === 'not-found') return <Gone expired={false} />;
  if (found.status === 'expired') return <Gone expired />;
  if (found.status === 'unavailable') {
    return (
      <div className="flex flex-col items-center pt-16 text-center">
        <div className="w-56">
          <Cat pose="offline" label={tCat('offline')} />
        </div>
        <h1 className="mt-2 font-display text-[2rem] font-black text-ink">
          {t('unavailableTitle')}
        </h1>
        <p className="mt-3 max-w-[38ch] text-body text-ink-2">
          {t('unavailableBody')}
        </p>
      </div>
    );
  }

  const { meta } = found;

  return (
    <article className="flex flex-col items-center pt-6 sm:pt-10">
      <div className="relative z-raised -mb-3 w-40 sm:w-48">
        <Cat pose="download" label={tCat('download')} />
      </div>
      <PreviewBody file={meta} />
      {dropYourOwn}
    </article>
  );
}
