'use client';

import { Button } from '@andrewbehma/glass-ui/button';
import { cn } from '@andrewbehma/glass-ui/cn';
import { Link2, LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type RefObject, useId } from 'react';

/** "or paste a link": the server fetches the file for you. */
export function UrlField({
  inputRef,
  value,
  onChange,
  onSubmit,
  busy,
  error,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  error?: string;
}) {
  const t = useTranslations('Drop');
  const id = useId();
  const errorId = useId();

  return (
    // `noValidate`: the browser's own bubble ("Please enter a URL.") is in
    // the browser's language and skips the cat; our check says it instead.
    <form
      noValidate
      className="flex min-w-0 flex-1 flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy && value.trim()) onSubmit();
      }}
    >
      <label htmlFor={id} className="sr-only">
        {t('urlLabel')}
      </label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Link2
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3"
          />
          <input
            ref={inputRef}
            id={id}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder={t('urlPlaceholder')}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              'h-12 w-full rounded-full border bg-content pr-4 pl-10 text-body text-ink outline-none placeholder:text-ink-3',
              error
                ? 'border-danger/60'
                : 'border-line focus-visible:border-line-strong',
              'focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-0',
            )}
          />
        </div>
        <Button
          type="submit"
          variant="glass"
          disabled={busy || value.trim() === ''}
          className="h-12 shrink-0 gap-2 rounded-full px-5 font-bold"
        >
          {busy ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-4 motion-safe:animate-spin"
            />
          ) : null}
          {busy ? t('urlBusy') : t('urlSubmit')}
        </Button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="px-4 text-label text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
