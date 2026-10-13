'use client';

import { cn } from '@andrewbehma/glass-ui/cn';
import { progressFill } from '@andrewbehma/glass-ui/progress';
import { rowActionsHost } from '@andrewbehma/glass-ui/row-actions';
import { Skeleton } from '@andrewbehma/glass-ui/skeleton';
import { File as FileIcon } from 'lucide-react';
import { useLocale } from 'next-intl';
import type { ReactNode } from 'react';
import { formatBytes } from './format';

export type FileRowStatus = 'uploading' | 'done' | 'error' | 'canceled';

function Thumbnail({ url, mime }: { url?: string; mime?: string }) {
  const box = 'size-10 shrink-0 rounded-control';
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={cn(box, 'bg-raised object-contain')}
        decoding="async"
      />
    );
  }
  if (mime?.startsWith('image/')) return <Skeleton className={box} />;
  return (
    <div
      aria-hidden="true"
      className={cn(box, 'grid place-items-center bg-raised text-ink-3')}
    >
      <FileIcon size={18} />
    </div>
  );
}

/**
 * glass-ui's `FileItem`, with the size in the page's locale and our units.
 *
 * `FileItem` formats the size itself with `Intl`'s `short` byte unit and the
 * browser's locale, which reads `21 byte` and ignores the `/uk` the visitor
 * picked. Same markup, same slots (`meta`, `actions`), same progressbar; only
 * the size line is ours (`formatBytes`).
 */
export function FileRow({
  name,
  size,
  mime,
  thumbnailUrl,
  progress,
  status,
  meta,
  actions,
  errorText,
  className,
}: {
  name: string;
  size: number;
  mime?: string;
  thumbnailUrl?: string;
  /** 0..1. Omitted while uploading is indeterminate. */
  progress?: number;
  status: FileRowStatus;
  meta?: ReactNode;
  actions?: ReactNode;
  errorText?: string;
  className?: string;
}) {
  const locale = useLocale();
  const pct =
    progress === undefined
      ? undefined
      : Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <div
      data-status={status}
      className={cn(
        rowActionsHost,
        'flex min-h-(--size-row) items-center gap-3 px-3 py-2',
        status === 'canceled' && 'opacity-60',
        className,
      )}
    >
      <Thumbnail url={thumbnailUrl} mime={mime} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-body text-ink">{name}</span>
          <span className="shrink-0 text-label text-ink-3 tabular-nums">
            {formatBytes(size, locale)}
          </span>
        </div>
        {status === 'uploading' ? (
          <div
            role="progressbar"
            aria-label={name}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="h-1.5 w-full overflow-hidden rounded-full bg-hover"
          >
            <div
              className={cn(
                progressFill({ tone: 'neutral' }),
                pct === undefined && 'w-1/3 motion-safe:animate-pulse',
              )}
              style={pct === undefined ? undefined : { width: `${pct}%` }}
            />
          </div>
        ) : null}
        {status === 'error' && errorText ? (
          <span role="alert" className="text-label text-danger">
            {errorText}
          </span>
        ) : null}
      </div>
      {meta ? <div className="flex shrink-0 items-center">{meta}</div> : null}
      {actions}
    </div>
  );
}
