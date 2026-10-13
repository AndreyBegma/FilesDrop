'use client';

import { cn } from '@andrewbehma/glass-ui/cn';
import { FileItem } from '@andrewbehma/glass-ui/file-item';
import { toast } from '@andrewbehma/glass-ui/toast';
import { Check, Copy, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Cat } from '@/components/cat';
import { copyText } from '@/components/drop/actions';
import { CountdownRing, remaining } from '@/components/drop/countdown-ring';
import { cueMascot, useLinkMode } from '@/components/drop/hooks';
import { isThumbnailable, linkFor, rawPath } from '@/components/drop/links';
import { announce } from '@/components/drop/live-region';
import type { HistoryEntry } from './store';

/** True once the row has scrolled near the viewport: thumbnails load late. */
function useSeen<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: '120px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen] as const;
}

function ActionButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'grid size-11 shrink-0 place-items-center rounded-full text-ink-2 transition-colors hover:bg-hover hover:text-ink disabled:opacity-40',
        danger && 'hover:text-danger',
      )}
    >
      {children}
    </button>
  );
}

/**
 * One past upload: thumbnail (lazy, inline images only), name and size, a
 * countdown ring, copy and delete. An expired one fades and shows the
 * not-found cat until it drops out of the list.
 */
export function HistoryRow({
  entry,
  now,
  swiping,
  onDelete,
  onForget,
}: {
  entry: HistoryEntry;
  now: number;
  /** The delete is in flight: the cat is swiping it. */
  swiping: boolean;
  onDelete: (entry: HistoryEntry) => void;
  onForget: (entry: HistoryEntry) => void;
}) {
  const t = useTranslations('History');
  const tResult = useTranslations('Result');
  const mode = useLinkMode();
  const [ref, seen] = useSeen<HTMLDivElement>();
  const [copied, setCopied] = useState(false);
  const { expired, warn } = remaining(entry.createdAt, entry.expiresAt, now);

  const copy = async () => {
    const ok = await copyText(linkFor(entry, mode));
    if (!ok) {
      toast.error(tResult('copyFailed'));
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
    cueMascot('link-copied');
    toast(tResult('copiedToast'), { description: entry.name });
    announce(tResult('copiedToast'));
  };

  const thumbnail =
    !expired && seen && isThumbnailable(entry) ? rawPath(entry) : undefined;

  return (
    <div ref={ref} className="relative">
      <FileItem
        name={entry.name}
        size={entry.size}
        // An expired entry gets the glyph slot; the cat sits on top of it.
        mime={expired ? undefined : entry.mime}
        thumbnailUrl={thumbnail}
        status="done"
        className={cn(
          'min-h-16 gap-2.5 pr-1.5 pl-3',
          expired && 'opacity-55',
          warn && 'bg-warn/10',
          '[&_img]:aspect-square',
        )}
        meta={
          <CountdownRing
            createdAt={entry.createdAt}
            expiresAt={entry.expiresAt}
            now={now}
            size={36}
          />
        }
        actions={
          <div className="flex items-center">
            {expired ? (
              <ActionButton
                label={t('forget', { name: entry.name })}
                onClick={() => onForget(entry)}
              >
                <X aria-hidden="true" className="size-4" />
              </ActionButton>
            ) : (
              <>
                <ActionButton
                  label={t('copy', { name: entry.name })}
                  onClick={copy}
                >
                  {copied ? (
                    <Check aria-hidden="true" className="size-4 text-ok" />
                  ) : (
                    <Copy aria-hidden="true" className="size-4" />
                  )}
                </ActionButton>
                <ActionButton
                  label={t('delete', { name: entry.name })}
                  onClick={() => onDelete(entry)}
                  disabled={swiping}
                  danger
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </ActionButton>
              </>
            )}
          </div>
        }
      />
      {swiping ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 -left-1 z-raised -translate-y-1/2"
        >
          <Cat pose="delete" size={76} />
        </span>
      ) : expired ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 grid size-10 -translate-y-1/2 place-items-center overflow-hidden rounded-control bg-raised"
        >
          <Cat pose="not-found" size={48} />
        </span>
      ) : null}
      {expired ? <span className="sr-only">{t('expired')}</span> : null}
    </div>
  );
}
