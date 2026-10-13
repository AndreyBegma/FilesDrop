'use client';

import { Button, buttonClassName } from '@andrewbehma/glass-ui/button';
import { cn } from '@andrewbehma/glass-ui/cn';
import {
  SegmentedControl,
  SegmentedControlItem,
} from '@andrewbehma/glass-ui/segmented-control';
import { toast } from '@andrewbehma/glass-ui/toast';
import {
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import { Cat } from '@/components/cat';
import { type HistoryEntry, historyStore } from '@/components/history/store';
import { useSideToasts } from '@/components/shell/app-toaster';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { copyText, deleteRemote } from './actions';
import { CountdownRing } from './countdown-ring';
import { formatBytes } from './format';
import {
  cueMascot,
  setLinkMode,
  useLinkMode,
  useMediaQuery,
  useNow,
} from './hooks';
import { type LinkMode, linkFor } from './links';
import { announce } from './live-region';
import { LockBadge } from './lock';
import { PawConfetti } from './paw-confetti';
import { Thumb } from './thumb';

const MODES: LinkMode[] = ['direct', 'preview'];

/**
 * What a finished upload turns into: the file, the time it has left, and
 * its link with the Direct | Preview switch, copy, open, share and delete.
 */
export function ResultCard({
  entry,
  onDismiss,
}: {
  entry: HistoryEntry;
  onDismiss: () => void;
}) {
  const t = useTranslations('Result');
  const tErr = useTranslations('Errors');
  const locale = useLocale();
  const sharedMode = useLinkMode();
  // A locked file's direct link only leads to its lock, so its card starts
  // on Preview, and flipping it does not change the remembered choice.
  const [ownMode, setOwnMode] = useState<LinkMode | null>(null);
  const mode: LinkMode = entry.locked ? (ownMode ?? 'preview') : sharedMode;
  const chooseMode = (m: LinkMode) =>
    entry.locked ? setOwnMode(m) : setLinkMode(m);
  const noteId = useId();
  const reduced = useReducedMotion();
  const sideToasts = useSideToasts();
  const now = useNow(1000);
  const touch = useMediaQuery('(pointer: coarse)');
  const canShare =
    touch && typeof navigator !== 'undefined' && 'share' in navigator;
  const link = linkFor(entry, mode);
  const fieldId = useId();
  const switchId = useId();

  const copyRef = useRef<HTMLButtonElement>(null);
  const [burst, setBurst] = useState(0);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const copiedTimer = useRef(0);

  const copy = async () => {
    const ok = await copyText(link);
    if (!ok) {
      toast.error(t('copyFailed'));
      return;
    }
    const rect = copyRef.current?.getBoundingClientRect();
    if (rect) setOrigin({ x: rect.left + rect.width / 2, y: rect.top });
    setBurst((n) => n + 1);
    setCopied(true);
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), 2400);
    cueMascot('link-copied');
    // Away from the gutter a toast would sit on top of this card's own
    // buttons; the "Copied" button and the cat already say it.
    if (sideToasts) {
      toast(t('copiedToast'), {
        description: mode === 'direct' ? t('copiedDirect') : t('copiedPreview'),
      });
    }
    announce(t('copiedToast'));
  };

  const share = async () => {
    try {
      await navigator.share({ title: entry.name, url: link });
    } catch {
      // Dismissed: nothing to say.
    }
  };

  const remove = async () => {
    setDeleting(true);
    const result = await deleteRemote(entry.slug, entry.deleteToken);
    setDeleting(false);
    if (!result.ok) {
      cueMascot(result.failure.pose);
      toast.error(tErr(result.failure.key));
      announce(tErr(result.failure.key));
      return;
    }
    cueMascot('delete');
    historyStore.remove(entry.slug);
    toast(t('deletedToast', { name: entry.name }));
    announce(t('deletedToast', { name: entry.name }));
    onDismiss();
  };

  return (
    <div className="relative">
      {/* The cat pops up behind the card holding the link it just copied. */}
      <AnimatePresence>
        {copied ? (
          <motion.div
            key="peek"
            aria-hidden="true"
            className="pointer-events-none absolute -top-[3.9rem] right-16 w-20"
            initial={reduced ? { opacity: 0 } : { y: 56, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { y: 56, opacity: 0 }}
            transition={
              reduced
                ? { duration: 0.15 }
                : { type: 'spring', stiffness: 420, damping: 20 }
            }
          >
            <Cat pose="link-copied" />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <article
        aria-label={entry.name}
        className="glass-strong relative rounded-sheet p-4 sm:p-5"
      >
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('dismiss')}
          title={t('dismiss')}
          className="absolute top-2 right-2 grid size-11 place-items-center rounded-full text-ink-3 transition-colors hover:bg-hover hover:text-ink"
        >
          <X aria-hidden="true" className="size-4" />
        </button>

        <div className="flex items-center gap-3.5 pr-10 sm:gap-4">
          <Thumb file={entry} size={56} className="rounded-surface" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-[1.1875rem] leading-tight font-extrabold text-ink">
              {entry.name}
            </h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-label text-ink-2 tabular-nums">
              <span>{formatBytes(entry.size, locale)}</span>
              <span aria-hidden="true" className="text-ink-3">
                /
              </span>
              <span className="min-w-0 truncate">{entry.mime}</span>
              {entry.locked ? (
                <LockBadge label={t('locked')} className="ml-1" />
              ) : null}
            </p>
          </div>
          <CountdownRing
            createdAt={entry.createdAt}
            expiresAt={entry.expiresAt}
            now={now}
            size={52}
          />
        </div>

        <div className="mt-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor={fieldId}
              className="text-label font-semibold text-ink-2"
            >
              {t('linkLabel')}
            </label>
            <SegmentedControl
              variant="on-glass"
              role="radiogroup"
              aria-label={t('modeLabel')}
              className="rounded-full p-0.5 [&>div>span]:rounded-full"
            >
              {MODES.map((m) => (
                <SegmentedControlItem
                  key={m}
                  active={mode === m}
                  layoutId={`fd-mode-${switchId}`}
                >
                  {/* biome-ignore lint/a11y/useSemanticElements: a segmented radio, styled as a capsule. */}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    onClick={() => chooseMode(m)}
                    className={cn(
                      'relative z-10 h-9 rounded-full px-3.5 text-label font-bold',
                      mode !== m && 'text-ink-2 hover:text-ink',
                    )}
                  >
                    {m === 'direct' ? t('modeDirect') : t('modePreview')}
                  </button>
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id={fieldId}
              readOnly
              value={link}
              aria-describedby={entry.locked ? noteId : undefined}
              onFocus={(e) => e.currentTarget.select()}
              className="h-12 min-w-0 flex-1 rounded-control border border-line bg-content px-3.5 text-body text-ink outline-none select-all focus-visible:border-line-strong focus-visible:ring-2 focus-visible:ring-accent/60"
            />
            <Button
              ref={copyRef}
              variant="solid"
              onClick={copy}
              className="h-12 w-full shrink-0 gap-2 rounded-control px-4 font-bold sm:w-auto sm:min-w-[7.5rem] sm:px-5"
            >
              {copied ? (
                <Check
                  aria-hidden="true"
                  className="size-[18px]"
                  strokeWidth={2.5}
                />
              ) : (
                <Copy aria-hidden="true" className="size-[18px]" />
              )}
              <span>{copied ? t('copied') : t('copy')}</span>
            </Button>
          </div>
        </div>

        {entry.locked ? (
          <p
            id={noteId}
            className="mt-2.5 flex items-start gap-2 rounded-control bg-(--fd-butter)/60 px-3 py-2 text-label text-ink"
          >
            <KeyRound
              aria-hidden="true"
              className="mt-px size-4 shrink-0 text-ink-2"
            />
            {t('lockedNote')}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-1">
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClassName({
              variant: 'ghost',
              className: 'h-11 gap-2 rounded-full px-3.5',
            })}
          >
            <ExternalLink aria-hidden="true" className="size-4" />
            {t('open')}
          </a>
          {canShare ? (
            <Button
              variant="ghost"
              onClick={share}
              className="h-11 gap-2 rounded-full px-3.5"
            >
              <Share2 aria-hidden="true" className="size-4" />
              {t('share')}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            onClick={remove}
            disabled={deleting}
            className="ml-auto h-11 gap-2 rounded-full px-3.5 hover:text-danger"
          >
            <Trash2 aria-hidden="true" className="size-4" />
            {t('delete')}
          </Button>
        </div>

        <PawConfetti burst={burst} origin={origin} />
      </article>
    </div>
  );
}
