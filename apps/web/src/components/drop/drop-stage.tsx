'use client';

import { cn } from '@andrewbehma/glass-ui/cn';
import { ClipboardPaste, Hand, MousePointerClick } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { Cat, type CatPose } from '@/components/cat';
import type { StageMessage } from './drop-experience';

type Ring =
  | { kind: 'determinate'; value: number }
  | { kind: 'indeterminate' }
  | null;

/** The yarn ring around the cat: real progress, or a chasing arc. */
function YarnRing({ ring }: { ring: Ring }) {
  const size = 100;
  const r = 47;
  const c = 2 * Math.PI * r;
  if (!ring) return null;
  const determinate = ring.kind === 'determinate';
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 size-full -rotate-90',
        !determinate && 'motion-safe:animate-[spin_1.6s_linear_infinite]',
      )}
    >
      <circle
        cx={50}
        cy={50}
        r={r}
        fill="none"
        strokeWidth={2.2}
        style={{
          stroke: 'color-mix(in oklab, var(--fd-yarn) 22%, transparent)',
        }}
      />
      <circle
        cx={50}
        cy={50}
        r={r}
        fill="none"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={
          determinate ? c * (1 - Math.max(0.02, ring.value)) : c * 0.75
        }
        style={{
          stroke: 'var(--fd-yarn)',
          transition: determinate
            ? 'stroke-dashoffset 240ms ease-out'
            : undefined,
        }}
      />
    </svg>
  );
}

function useStageText(message: StageMessage) {
  const t = useTranslations('Drop');
  const home = useTranslations('Home');
  const tErr = useTranslations('Errors');
  switch (message.kind) {
    case 'idle':
      return { title: home('dropTitle'), sub: home('dropLimits') };
    case 'drag':
      return { title: t('dragTitle'), sub: t('dragSub') };
    case 'uploading':
      return {
        title: t('uploadingTitle', { count: message.count }),
        sub: t('uploadingSub', { percent: message.percent }),
      };
    case 'fetching':
      return { title: t('fetchingTitle'), sub: t('fetchingSub') };
    case 'success':
      return { title: t('successTitle'), sub: t('successSub') };
    case 'copied':
      return { title: t('copiedTitle'), sub: t('copiedSub') };
    case 'deleted':
      return { title: t('deletedTitle'), sub: t('deletedSub') };
    case 'offline':
      return { title: t('offlineTitle'), sub: tErr('offline') };
    case 'error':
      if (message.key === 'tooBig')
        return { title: t('tooBigTitle'), sub: tErr('tooBig') };
      if (message.key === 'boxFull')
        return { title: t('boxFullTitle'), sub: tErr('boxFull') };
      return { title: t('errorTitle'), sub: tErr(message.key) };
  }
}

/**
 * What the drop zone holds: the cat on its butter spotlight, the yarn ring
 * while something moves, and a line of words for the state.
 */
export function DropStage({
  pose,
  message,
  lookAt,
  ring,
  busy,
}: {
  pose: CatPose;
  message: StageMessage;
  lookAt?: { x: number; y: number };
  ring: Ring;
  busy: boolean;
}) {
  const tCat = useTranslations('Cat');
  const t = useTranslations('Drop');
  const reduced = useReducedMotion();
  const text = useStageText(message);
  const textKey = `${message.kind}:${text.title}`;
  const lifted = pose === 'drag-over';

  return (
    <div className="flex w-full flex-col items-center">
      <motion.div
        className="relative size-[13.5rem] sm:size-[16.5rem] xl:size-[19rem]"
        animate={
          reduced ? undefined : { scale: lifted ? 1.06 : 1, y: lifted ? -6 : 0 }
        }
        transition={{ type: 'spring', stiffness: 320, damping: 18 }}
      >
        <span
          aria-hidden="true"
          className="absolute inset-[7%] rounded-full"
          style={{
            background:
              'radial-gradient(closest-side, color-mix(in oklab, var(--fd-butter) 90%, transparent) 0%, color-mix(in oklab, var(--fd-butter) 55%, transparent) 62%, transparent 100%)',
          }}
        />
        <YarnRing ring={ring} />
        <div className="absolute inset-[9%]">
          <Cat pose={pose} lookAt={lookAt} label={tCat(pose)} />
        </div>
      </motion.div>

      <div className="mt-1 flex min-h-[4.75rem] flex-col items-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={textKey}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: reduced ? 0.12 : 0.18 }}
            className="flex flex-col items-center"
          >
            <p className="font-display text-[1.5rem] leading-tight font-extrabold tracking-[-0.01em] text-balance text-ink sm:text-[1.75rem] xl:text-[2rem]">
              {text.title}
            </p>
            <p
              className={cn(
                'mt-1.5 max-w-[36ch] text-body text-balance',
                message.kind === 'error' ? 'text-danger' : 'text-ink-2',
                busy && 'tabular-nums',
              )}
            >
              {text.sub}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <ul
        aria-hidden="true"
        className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-label text-ink-2"
      >
        {[
          { icon: Hand, label: t('wayDrop') },
          { icon: ClipboardPaste, label: t('wayPaste') },
          { icon: MousePointerClick, label: t('wayClick') },
        ].map(({ icon: Icon, label }) => (
          <li
            key={label}
            className="flex h-8 items-center gap-1.5 rounded-full bg-hover px-3 font-semibold"
          >
            <Icon aria-hidden="true" className="size-3.5" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
