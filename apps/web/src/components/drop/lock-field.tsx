'use client';

import { cn } from '@andrewbehma/glass-ui/cn';
import { Toggle } from '@andrewbehma/glass-ui/toggle';
import { Lock } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { type RefObject, useId } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { PasswordInput } from './lock';

/**
 * "Protect with a password": a switch, and when it is on, the password every
 * upload from here on is locked with (files and links alike).
 */
export function LockField({
  enabled,
  onEnabledChange,
  value,
  onChange,
  error,
  disabled,
  inputRef,
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  /** Already localized. */
  error?: string;
  /** While something uploads: the lock it was sent with must not change. */
  disabled: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const t = useTranslations('Drop');
  const reduced = useReducedMotion();
  const labelId = useId();
  const inputId = useId();
  const noteId = useId();

  return (
    <fieldset
      disabled={disabled}
      className="border-t border-line px-2 pt-2 disabled:opacity-70"
    >
      <div className="flex items-center justify-between gap-3 sm:justify-start">
        <span
          id={labelId}
          className={cn(
            'flex items-center gap-1.5 text-label font-semibold',
            enabled ? 'text-ink' : 'text-ink-2',
          )}
        >
          <Lock aria-hidden="true" className="size-4" />
          {t('lockToggle')}
        </span>
        <Toggle
          checked={enabled}
          onChange={(next) => {
            onEnabledChange(next);
            if (next) window.setTimeout(() => inputRef.current?.focus(), 60);
          }}
          labelledBy={labelId}
        />
      </div>
      <AnimatePresence initial={false}>
        {enabled ? (
          <motion.div
            key="password"
            initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: reduced ? 0.12 : 0.2 }}
            className="-mx-1 overflow-hidden px-1"
          >
            <div className="flex flex-col gap-1.5 pt-1 pb-1.5 sm:flex-row sm:items-center sm:gap-3">
              <label htmlFor={inputId} className="sr-only">
                {t('lockLabel')}
              </label>
              <PasswordInput
                id={inputId}
                inputRef={inputRef}
                value={value}
                onChange={onChange}
                placeholder={t('lockPlaceholder')}
                autoComplete="new-password"
                invalid={Boolean(error)}
                describedBy={noteId}
                showLabel={t('lockShow')}
                hideLabel={t('lockHide')}
                className="sm:max-w-xs"
              />
              <p
                id={noteId}
                role={error ? 'alert' : undefined}
                className={cn(
                  'px-4 text-label sm:px-0',
                  error ? 'text-danger' : 'text-ink-2',
                )}
              >
                {error ?? t('lockHint')}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </fieldset>
  );
}
