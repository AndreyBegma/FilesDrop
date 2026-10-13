'use client';

import { Button, buttonClassName } from '@andrewbehma/glass-ui/button';
import { toast } from '@andrewbehma/glass-ui/toast';
import type { FileMeta } from '@filesdrop/shared';
import { Check, Download, Link2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { copyText } from './actions';
import { CountdownRing, remaining, useRemainingText } from './countdown-ring';
import { useNow } from './hooks';
import { rawLink, rawPath } from './links';
import { announce } from './live-region';
import { PawConfetti } from './paw-confetti';

/** The time a shared file has left, as a ring and a sentence. */
export function PreviewExpiry({ file }: { file: FileMeta }) {
  const now = useNow(1000);
  const text = useRemainingText()(
    remaining(file.createdAt, file.expiresAt, now || Date.parse(file.createdAt))
      .left,
  );
  return (
    <span className="inline-flex items-center gap-2">
      <CountdownRing
        createdAt={file.createdAt}
        expiresAt={file.expiresAt}
        now={now}
        size={36}
      />
      <span className="text-label text-ink-2" aria-hidden="true">
        {now ? text.long : ''}
      </span>
    </span>
  );
}

/** Download (the primary) and copy-the-file-link, with paw confetti. */
export function PreviewActions({ file }: { file: FileMeta }) {
  const t = useTranslations('Preview');
  const tResult = useTranslations('Result');
  const ref = useRef<HTMLButtonElement>(null);
  const [burst, setBurst] = useState(0);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const ok = await copyText(rawLink(file));
    if (!ok) {
      toast.error(tResult('copyFailed'));
      return;
    }
    const rect = ref.current?.getBoundingClientRect();
    if (rect) setOrigin({ x: rect.left + rect.width / 2, y: rect.top });
    setBurst((n) => n + 1);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
    toast(tResult('copiedToast'));
    announce(tResult('copiedToast'));
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <a
        href={rawPath(file)}
        download={file.name}
        className={buttonClassName({
          variant: 'solid',
          className: 'h-12 gap-2 rounded-full px-6 font-bold',
        })}
      >
        <Download aria-hidden="true" className="size-[18px]" />
        {t('download')}
      </a>
      <Button
        ref={ref}
        variant="glass"
        onClick={copy}
        className="h-12 gap-2 rounded-full px-5 font-bold"
      >
        {copied ? (
          <Check aria-hidden="true" className="size-[18px]" />
        ) : (
          <Link2 aria-hidden="true" className="size-[18px]" />
        )}
        {copied ? tResult('copied') : t('copyLink')}
      </Button>
      <PawConfetti burst={burst} origin={origin} />
    </div>
  );
}
