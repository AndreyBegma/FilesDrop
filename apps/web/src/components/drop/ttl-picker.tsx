'use client';

import { cn } from '@andrewbehma/glass-ui/cn';
import {
  SegmentedControl,
  SegmentedControlItem,
} from '@andrewbehma/glass-ui/segmented-control';
import type { Ttl } from '@filesdrop/shared';
import { Timer } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type KeyboardEvent, useId } from 'react';

/** 1h · 12h · 24h · 3d, as a radio group (arrow keys move the choice). */
export function TtlPicker({
  value,
  onChange,
  options,
}: {
  value: Ttl;
  onChange: (ttl: Ttl) => void;
  options: readonly Ttl[];
}) {
  const t = useTranslations('Drop');
  const labelId = useId();

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const index = options.indexOf(value);
    const next = options[(index + step + options.length) % options.length];
    onChange(next);
    const el = e.currentTarget.querySelector<HTMLButtonElement>(
      `[data-ttl="${next}"]`,
    );
    el?.focus();
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 pl-2 sm:h-12 sm:flex-nowrap sm:justify-start">
      <span
        id={labelId}
        className="flex items-center gap-1.5 text-label font-semibold whitespace-nowrap text-ink-2"
      >
        <Timer aria-hidden="true" className="size-4" />
        {t('ttlLabel')}
      </span>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: arrow keys for the radio group inside. */}
      <div onKeyDown={onKeyDown}>
        <SegmentedControl
          variant="on-glass"
          role="radiogroup"
          aria-labelledby={labelId}
          className="rounded-full p-0.5 [&>div>span]:rounded-full"
        >
          {options.map((ttl) => (
            <SegmentedControlItem
              key={ttl}
              active={value === ttl}
              layoutId="fd-ttl"
            >
              {/* biome-ignore lint/a11y/useSemanticElements: a segmented radio, styled as a capsule. */}
              <button
                type="button"
                role="radio"
                data-ttl={ttl}
                aria-checked={value === ttl}
                tabIndex={value === ttl ? 0 : -1}
                onClick={() => onChange(ttl)}
                className={cn(
                  'relative z-10 h-11 min-w-12 rounded-full px-2.5 text-body font-bold whitespace-nowrap tabular-nums sm:min-w-14 sm:px-3',
                  value !== ttl && 'text-ink-2 hover:text-ink',
                )}
              >
                {t(`ttl.${ttl}`)}
              </button>
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </div>
    </div>
  );
}
