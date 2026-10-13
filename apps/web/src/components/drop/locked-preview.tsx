'use client';

import { Button } from '@andrewbehma/glass-ui/button';
import { cn } from '@andrewbehma/glass-ui/cn';
import type { UnlockResult } from '@filesdrop/shared';
import { LoaderCircle, Timer, Unlock } from 'lucide-react';
import { AnimatePresence, motion, useAnimate } from 'motion/react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useId, useRef, useState } from 'react';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { useRemainingText } from './countdown-ring';
import { describeFailure, type ErrorKey } from './errors';
import { useNow } from './hooks';
import { apiBase } from './links';
import { announce } from './live-region';
import { GuardCat, LOCK_POSES, PasswordInput } from './lock';
import { PreviewBody } from './preview-body';

function isUnlockResult(value: unknown): value is UnlockResult {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.token === 'string' && typeof v.name === 'string';
}

/** Time left, from the expiry alone: a locked file shares nothing else. */
function TimeLeft({ expiresAt }: { expiresAt: string }) {
  const now = useNow(1000);
  const text = useRemainingText()(Math.max(0, Date.parse(expiresAt) - now));
  return (
    <p className="mt-5 inline-flex h-8 items-center gap-1.5 rounded-full bg-hover px-3 text-label font-semibold text-ink-2 tabular-nums">
      <Timer aria-hidden="true" className="size-3.5" />
      {/* Before the first tick there is no clock yet: keep the chip's height. */}
      <span>{now ? text.long : ' '}</span>
    </p>
  );
}

/**
 * `/v/<slug>` for a password-protected file: the cat on guard and a password
 * field. The right password turns into the normal preview, with every `/f/`
 * URL carrying the short-lived access token.
 */
export function LockedPreview({
  slug,
  expiresAt,
}: {
  slug: string;
  expiresAt: string;
}) {
  const t = useTranslations('Preview');
  const tDrop = useTranslations('Drop');
  const tErr = useTranslations('Errors');
  const tCat = useTranslations('Cat');
  const reduced = useReducedMotion();
  const inputId = useId();
  const errorId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [scope, animate] = useAnimate<HTMLFormElement>();

  const [password, setPassword] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [unlocked, setUnlocked] = useState<UnlockResult | null>(null);

  const refuse = (key: ErrorKey) => {
    setError(key);
    announce(tErr(key));
    if (!reduced && scope.current) {
      animate(
        scope.current,
        { x: [0, -12, 11, -8, 6, -3, 0] },
        { duration: 0.42, ease: 'easeOut' },
      );
    }
    input.current?.select();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (checking || password === '') return;
    setChecking(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBase()}/api/files/${encodeURIComponent(slug)}/unlock`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        },
      );
      const body: unknown = await res.json().catch(() => undefined);
      if (res.ok && isUnlockResult(body)) {
        setPassword('');
        setUnlocked(body);
        announce(t('unlockedLive'));
        return;
      }
      refuse(describeFailure(res.status, body).key);
    } catch {
      refuse(describeFailure(undefined, undefined, navigator.onLine).key);
    } finally {
      setChecking(false);
    }
  };

  if (unlocked) {
    return (
      <article className="flex flex-col items-center pt-6 sm:pt-10">
        <div className="relative z-raised -mb-3 w-40 sm:w-48">
          <GuardCat state="unlocked" label={tCat(LOCK_POSES.unlocked.pose)} />
        </div>
        <motion.div
          className="w-full"
          initial={
            reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }
          }
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={
            reduced
              ? { duration: 0.15 }
              : { type: 'spring', stiffness: 260, damping: 24 }
          }
        >
          <PreviewBody file={unlocked} token={unlocked.token} />
        </motion.div>
      </article>
    );
  }

  const wrong = error === 'wrongPassword';
  const limited = error === 'tooManyAttempts';

  return (
    <article className="flex flex-col items-center pt-6 sm:pt-10">
      <div className="relative z-raised -mb-4 w-48 sm:w-56">
        <GuardCat
          state={wrong ? 'wrong' : error ? 'refused' : 'locked'}
          label={t('lockedCat')}
        />
      </div>
      <div className="glass-strong flex w-full flex-col items-center rounded-sheet px-5 pt-9 pb-7 text-center sm:px-10 sm:pt-11 sm:pb-9">
        <h1 className="font-display text-[clamp(1.75rem,5vw,2.375rem)] leading-tight font-black tracking-[-0.02em] text-balance text-ink">
          {t('lockedTitle')}
        </h1>
        <p className="mt-2.5 max-w-[38ch] text-body text-balance text-ink-2">
          {t('lockedBody')}
        </p>

        <form
          ref={scope}
          noValidate
          onSubmit={submit}
          className="mt-6 flex w-full max-w-md flex-col gap-2 sm:flex-row"
        >
          <label htmlFor={inputId} className="sr-only">
            {t('passwordLabel')}
          </label>
          <PasswordInput
            id={inputId}
            inputRef={input}
            value={password}
            onChange={(v) => {
              setPassword(v);
              if (wrong) setError(null);
            }}
            placeholder={t('passwordLabel')}
            autoComplete="current-password"
            invalid={Boolean(error)}
            describedBy={error ? errorId : undefined}
            disabled={limited}
            showLabel={tDrop('lockShow')}
            hideLabel={tDrop('lockHide')}
          />
          <Button
            type="submit"
            variant="solid"
            disabled={checking || limited || password === ''}
            className="h-12 shrink-0 gap-2 rounded-full px-6 font-bold"
          >
            {checking ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-[18px] motion-safe:animate-spin"
              />
            ) : (
              <Unlock aria-hidden="true" className="size-[18px]" />
            )}
            {checking ? t('unlocking') : t('unlock')}
          </Button>
        </form>

        <div className="min-h-7 w-full max-w-md">
          <AnimatePresence initial={false}>
            {error ? (
              <motion.p
                key={error}
                id={errorId}
                role="alert"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  'mt-2 px-4 text-label text-balance text-danger',
                  'sm:text-left',
                )}
              >
                {tErr(error)}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>

        <TimeLeft expiresAt={expiresAt} />
      </div>
    </article>
  );
}
