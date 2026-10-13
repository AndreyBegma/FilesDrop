'use client';

import { cn } from '@andrewbehma/glass-ui/cn';
import { PASSWORD_MAX } from '@filesdrop/shared';
import { Eye, EyeOff, KeyRound, Lock } from 'lucide-react';
import { type Ref, useState } from 'react';
import { Cat, type CatPose } from '@/components/cat';

/** Every state the lock screens show the cat in. */
export type LockState = 'locked' | 'wrong' | 'refused' | 'unlocked';

/**
 * The swap point: which pose each lock state shows, and whether it still
 * needs the padlock overlay because its pose does not carry one.
 *
 * `locked` and `wrong` have their own artboards (locked.svg,
 * wrong-password.svg) with the padlock drawn in. `refused` (too many
 * attempts, or the check failed) and `unlocked` are stand-ins until their
 * art lands (issue #20, Mascot): swap the pose and drop `padlock` then.
 */
export const LOCK_POSES = {
  locked: { pose: 'locked', padlock: false },
  wrong: { pose: 'wrong-password', padlock: false },
  refused: { pose: 'error', padlock: true },
  unlocked: { pose: 'download', padlock: false },
} as const satisfies Record<LockState, { pose: CatPose; padlock: boolean }>;

/** A small padlock, for a card, a row or a link field. */
export function LockBadge({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-(--fd-butter) px-2.5 text-label font-bold text-ink',
        className,
      )}
    >
      <Lock aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
      {label}
    </span>
  );
}

/**
 * The guard of a locked file in the given lock state. A stand-in pose gets
 * a padlock pinned to its box; like the cat, the padlock is part of the
 * sticker and keeps its light colours in the dark theme.
 */
export function GuardCat({
  state,
  label,
}: {
  state: LockState;
  label?: string;
}) {
  const { pose, padlock } = LOCK_POSES[state];
  return (
    <div className="relative">
      <Cat pose={pose} label={label} />
      {padlock ? (
        <span
          aria-hidden="true"
          className="absolute right-[6%] bottom-[10%] grid size-[24%] place-items-center rounded-full border-[3px] border-(--fd-ink) bg-[#ffe9a8] text-(--fd-ink) shadow-[0_3px_0_var(--fd-ink)]"
        >
          <Lock className="size-1/2" strokeWidth={2.75} />
        </span>
      ) : null}
    </div>
  );
}

/** A password field with a show/hide eye, in the URL field's capsule. */
export function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
  invalid,
  describedBy,
  disabled,
  inputRef,
  showLabel,
  hideLabel,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete: 'new-password' | 'current-password';
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  showLabel: string;
  hideLabel: string;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={cn('relative min-w-0 flex-1', className)}>
      <KeyRound
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3"
      />
      <input
        ref={inputRef}
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        autoCapitalize="off"
        spellCheck={false}
        maxLength={PASSWORD_MAX}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-12 w-full rounded-full border bg-content pr-12 pl-10 text-body text-ink outline-none placeholder:text-ink-3 disabled:opacity-60',
          invalid
            ? 'border-danger/60'
            : 'border-line focus-visible:border-line-strong',
          'focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-0',
        )}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        aria-label={visible ? hideLabel : showLabel}
        title={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        aria-controls={id}
        className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-full text-ink-2 transition-colors hover:bg-hover hover:text-ink disabled:opacity-40"
      >
        {visible ? (
          <EyeOff aria-hidden="true" className="size-4" />
        ) : (
          <Eye aria-hidden="true" className="size-4" />
        )}
      </button>
    </div>
  );
}
