'use client';

import { cn } from '@andrewbehma/glass-ui/cn';
import { useTranslations } from 'next-intl';

const HOUR = 3_600_000;
const MINUTE = 60_000;

export type Remaining = {
  /** Milliseconds left, never negative. */
  left: number;
  /** 1 = freshly uploaded, 0 = gone. */
  fraction: number;
  expired: boolean;
  /** Under an hour to go. */
  warn: boolean;
};

export function remaining(
  createdAt: string,
  expiresAt: string,
  now: number,
): Remaining {
  const start = Date.parse(createdAt);
  const end = Date.parse(expiresAt);
  const total = Math.max(1, end - start);
  const left = Math.max(0, end - now);
  return {
    left,
    fraction: Math.min(1, left / total),
    expired: now > 0 && left === 0,
    warn: left > 0 && left < HOUR,
  };
}

/** `23h` / `45m` for the ring, and a sentence for the screen reader. */
export function useRemainingText() {
  const t = useTranslations('Time');
  return (left: number) => {
    if (left <= 0) return { short: t('goneShort'), long: t('gone') };
    const h = Math.floor(left / HOUR);
    const m = Math.floor((left % HOUR) / MINUTE);
    if (h > 0)
      return { short: t('hShort', { n: h }), long: t('leftHM', { h, m }) };
    if (m > 0) return { short: t('mShort', { n: m }), long: t('leftM', { m }) };
    return { short: t('lessMinuteShort'), long: t('lessMinute') };
  };
}

/**
 * Time left as a ring that empties. Amber while there is time, the warn tone
 * in the last hour, ink-3 once the file is gone.
 */
export function CountdownRing({
  createdAt,
  expiresAt,
  now,
  size = 40,
  className,
}: {
  createdAt: string;
  expiresAt: string;
  now: number;
  size?: number;
  className?: string;
}) {
  const r = remaining(createdAt, expiresAt, now);
  const text = useRemainingText()(r.left);
  const stroke = Math.max(3, size / 11);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // Before the first tick (`now` = 0) draw it full rather than empty.
  const fraction = now === 0 ? 1 : r.fraction;

  return (
    <span
      role="img"
      aria-label={text.long}
      title={text.long}
      className={cn(
        'relative inline-grid shrink-0 place-items-center',
        r.expired ? 'text-ink-3' : r.warn ? 'text-warn' : 'text-ink-2',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-line-strong"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className={cn(
            'motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700',
            r.expired
              ? 'stroke-ink-3'
              : r.warn
                ? 'stroke-warn'
                : 'stroke-accent',
          )}
        />
      </svg>
      <span
        aria-hidden="true"
        className="absolute text-[0.6875rem] leading-none font-bold tabular-nums"
        style={{ fontSize: size >= 56 ? '0.875rem' : undefined }}
      >
        {text.short}
      </span>
    </span>
  );
}
