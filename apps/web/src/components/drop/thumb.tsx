'use client';

import { cn } from '@andrewbehma/glass-ui/cn';
import type { FileMeta } from '@filesdrop/shared';
import { useState } from 'react';
import { FileGlyph } from './file-glyph';
import { isThumbnailable, rawPath } from './links';

/** A square preview: the image itself when `/f/` shows it inline, else a glyph. */
export function Thumb({
  file,
  size,
  className,
}: {
  file: Pick<FileMeta, 'slug' | 'ext' | 'mime' | 'inline'>;
  size: number;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const box = cn(
    'shrink-0 overflow-hidden rounded-control bg-raised',
    className,
  );
  if (isThumbnailable(file) && !broken) {
    return (
      <img
        src={rawPath(file)}
        alt=""
        loading="lazy"
        decoding="async"
        width={size}
        height={size}
        onError={() => setBroken(true)}
        className={cn(box, 'object-cover')}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(box, 'grid place-items-center text-ink-2')}
      style={{ width: size, height: size }}
    >
      <FileGlyph
        mime={file.mime}
        ext={file.ext}
        className={size >= 48 ? 'size-6' : 'size-[18px]'}
      />
    </span>
  );
}
