'use client';

import { buttonClassName } from '@andrewbehma/glass-ui/button';
import type { FileMeta } from '@filesdrop/shared';
import { ExternalLink } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { FileGlyph } from './file-glyph';
import { formatBytes } from './format';
import { isThumbnailable, rawPath, withAccess } from './links';
import { PreviewActions, PreviewExpiry } from './preview-actions';

/** `/f/` for this file, with the access token when it was unlocked. */
export const fileSrc = (file: FileMeta, token?: string) =>
  token ? withAccess(rawPath(file), token) : rawPath(file);

function Media({ file, src }: { file: FileMeta; src: string }) {
  const frame =
    'block max-h-[min(68dvh,40rem)] w-full rounded-surface bg-raised object-contain';
  // `isThumbnailable` is false for any locked file; once unlocked, the
  // token makes it as showable as an open one.
  if (file.inline && isThumbnailable({ ...file, locked: false })) {
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

/**
 * The shared file itself: what it looks like, its name, size and type, the
 * time it has left, and how to take it. `token` is set for a file that was
 * just unlocked; every `/f/` URL here then carries it.
 */
export function PreviewBody({
  file,
  token,
}: {
  file: FileMeta;
  token?: string;
}) {
  const t = useTranslations('Preview');
  const locale = useLocale();
  const src = fileSrc(file, token);
  const isPdf = file.mime === 'application/pdf';

  return (
    <div className="glass-strong w-full rounded-sheet p-3 sm:p-4">
      <Media file={file} src={src} />
      <div className="flex flex-col items-center px-2 pt-5 pb-3 text-center">
        <h1 className="max-w-full font-display text-[clamp(1.375rem,4vw,1.875rem)] leading-tight font-extrabold tracking-[-0.01em] break-words text-ink">
          {file.name}
        </h1>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-label text-ink-2 tabular-nums">
          <span>{formatBytes(file.size, locale)}</span>
          <span>{file.mime}</span>
          <PreviewExpiry file={file} />
        </p>
        <div className="mt-5 flex flex-col items-center gap-2">
          <PreviewActions file={file} token={token} />
          {isPdf ? (
            <a
              href={src}
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
  );
}
