'use client';

import { Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CONTACTS } from '@/components/shell/contacts';

/**
 * A quiet line under the controls: the same drop, from Telegram. Kept to
 * label size and ink-2 so it never competes with the drop zone above it.
 */
export function BotHint() {
  const t = useTranslations('Drop');
  const tShell = useTranslations('Shell');

  return (
    <p className="flex justify-center">
      <a
        href={CONTACTS.bot}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex min-h-11 max-w-full items-center gap-2 rounded-full px-4 py-1.5 text-label text-balance text-ink-2 transition-colors duration-(--dur-fast) hover:bg-hover hover:text-ink"
      >
        <Send
          aria-hidden="true"
          className="size-4 shrink-0 transition-transform duration-(--dur-fast) group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:transform-none"
        />
        <span>
          {t.rich('botHint', {
            bot: (chunks) => (
              <strong className="font-semibold text-ink underline decoration-line-strong underline-offset-4 group-hover:decoration-current">
                {chunks}
              </strong>
            ),
          })}
          <span className="sr-only"> {tShell('newTab')}</span>
        </span>
      </a>
    </p>
  );
}
