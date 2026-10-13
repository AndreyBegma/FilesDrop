'use client';

import type { UploadItem } from '@andrewbehma/glass-ui/use-file-upload';
import { RotateCcw, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { describeFailure } from './errors';
import { FileRow } from './file-row';

/** A local preview for an image that is still on its way up. */
function useObjectUrl(file: File) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-11 shrink-0 place-items-center rounded-full text-ink-2 transition-colors hover:bg-hover hover:text-ink"
    >
      {children}
    </button>
  );
}

function Row({
  item,
  onCancel,
  onRetry,
  onRemove,
}: {
  item: UploadItem;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const t = useTranslations('Drop');
  const tErr = useTranslations('Errors');
  const thumb = useObjectUrl(item.file);
  const { state } = item;
  const status =
    state.status === 'queued' || state.status === 'uploading'
      ? 'uploading'
      : state.status === 'done'
        ? 'done'
        : state.status;
  const progress =
    state.status === 'uploading'
      ? state.total > 0
        ? state.loaded / state.total
        : undefined
      : state.status === 'queued'
        ? 0
        : undefined;
  const errorText =
    state.status === 'error'
      ? tErr(
          describeFailure(state.httpStatus, state.body, navigator.onLine).key,
        )
      : undefined;

  return (
    <FileRow
      name={item.file.name}
      size={item.file.size}
      mime={item.file.type}
      thumbnailUrl={thumb}
      status={status}
      progress={progress}
      errorText={errorText}
      className="min-h-16 px-3"
      meta={
        state.status === 'queued' ? (
          <span className="text-label text-ink-3">{t('queued')}</span>
        ) : state.status === 'canceled' ? (
          <span className="text-label text-ink-3">{t('canceled')}</span>
        ) : null
      }
      actions={
        <div className="flex items-center">
          {status === 'uploading' ? (
            <IconButton label={t('cancel')} onClick={() => onCancel(item.id)}>
              <X aria-hidden="true" className="size-4" />
            </IconButton>
          ) : (
            <>
              <IconButton label={t('retry')} onClick={() => onRetry(item.id)}>
                <RotateCcw aria-hidden="true" className="size-4" />
              </IconButton>
              <IconButton
                label={t('dismissRow')}
                onClick={() => onRemove(item.id)}
              >
                <X aria-hidden="true" className="size-4" />
              </IconButton>
            </>
          )}
        </div>
      }
    />
  );
}

/** What is still on its way up, or failed to get there. */
export function UploadRows({
  items,
  onCancel,
  onRetry,
  onRemove,
}: {
  items: UploadItem[];
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const t = useTranslations('Drop');
  const reduced = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {items.length > 0 ? (
        <motion.ul
          key="rows"
          aria-label={t('uploadsLabel')}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="divide-y divide-line overflow-hidden rounded-sheet border border-line bg-content"
        >
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <motion.li
                key={item.id}
                layout={!reduced}
                initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: reduced ? 0.12 : 0.22 }}
              >
                <Row
                  item={item}
                  onCancel={onCancel}
                  onRetry={onRetry}
                  onRemove={onRemove}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      ) : null}
    </AnimatePresence>
  );
}
