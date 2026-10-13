import { buttonClassName } from '@andrewbehma/glass-ui/button';
import type { FileMeta } from '@filesdrop/shared';
import { ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Cat } from '@/components/cat';
import { FileGlyph } from '@/components/drop/file-glyph';
import { formatBytes } from '@/components/drop/format';
import { isThumbnailable, rawPath } from '@/components/drop/links';
import {
  PreviewActions,
  PreviewExpiry,
} from '@/components/drop/preview-actions';
import { lookupFile, webOrigin } from './meta';

type Props = { params: Promise<{ slug: string }> };

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations('Preview');
  const found = await lookupFile(slug);
  const robots = { index: false, follow: false };
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

function Media({ file }: { file: FileMeta }) {
  const src = rawPath(file);
  const frame =
    'block max-h-[min(68dvh,40rem)] w-full rounded-surface bg-raised object-contain';
  if (file.inline && isThumbnailable(file)) {
    return <img src={src} alt={file.name} className={frame} />;
  }
  if (file.inline && file.mime.startsWith('video/')) {
    return (
      // biome-ignore lint/a11y/useMediaCaption: user uploads carry no captions.
      <video
        src={src}
        controls
        playsInline
        preload="metadata"
        className={frame}
      />
    );
  }
  if (file.inline && file.mime.startsWith('audio/')) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-surface bg-raised px-5 py-8">
        <FileGlyph
          mime={file.mime}
          ext={file.ext}
          className="size-14 text-ink-2"
        />
        {/* biome-ignore lint/a11y/useMediaCaption: user uploads carry no captions. */}
        <audio src={src} controls preload="metadata" className="w-full" />
      </div>
    );
  }
  return (
    <div className="grid place-items-center rounded-surface bg-raised px-6 py-14">
      <FileGlyph
        mime={file.mime}
        ext={file.ext}
        className="size-24 text-ink-2"
      />
      {file.ext ? (
        <span className="mt-3 rounded-full bg-hover px-3 py-1 text-label font-bold text-ink-2">
          .{file.ext}
        </span>
      ) : null}
    </div>
  );
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
  const locale = await getLocale();

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
  const isPdf = meta.mime === 'application/pdf';

  return (
    <article className="flex flex-col items-center pt-6 sm:pt-10">
      <div className="relative z-raised -mb-3 w-40 sm:w-48">
        <Cat pose="download" label={tCat('download')} />
      </div>
      <div className="glass-strong w-full rounded-sheet p-3 sm:p-4">
        <Media file={meta} />
        <div className="flex flex-col items-center px-2 pt-5 pb-3 text-center">
          <h1 className="max-w-full font-display text-[clamp(1.375rem,4vw,1.875rem)] leading-tight font-extrabold tracking-[-0.01em] break-words text-ink">
            {meta.name}
          </h1>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-label text-ink-2 tabular-nums">
            <span>{formatBytes(meta.size, locale)}</span>
            <span>{meta.mime}</span>
            <PreviewExpiry file={meta} />
          </p>
          <div className="mt-5 flex flex-col items-center gap-2">
            <PreviewActions file={meta} />
            {isPdf ? (
              <a
                href={rawPath(meta)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClassName({
                  variant: 'ghost',
                  className: 'h-11 gap-2 rounded-full px-4',
                })}
              >
                <ExternalLink aria-hidden="true" className="size-4" />
                {t('openPdf')}
              </a>
            ) : null}
          </div>
        </div>
      </div>
      <p className="mt-6 text-label text-ink-2">
        <Link
          href="/"
          className="font-semibold text-ink underline-offset-4 hover:underline"
        >
          {t('dropYourOwn')}
        </Link>
      </p>
    </article>
  );
}
