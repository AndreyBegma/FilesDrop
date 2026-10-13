'use client';

import { Button } from '@andrewbehma/glass-ui/button';
import { History } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useShell } from './shell-context';

/** Opens and closes the uploads history. The history slot renders the panel. */
export function HistoryToggle() {
  const t = useTranslations('Shell');
  const { historyOpen, toggleHistory } = useShell();
  const label = historyOpen ? t('historyHide') : t('historyShow');

  return (
    <Button
      variant="ghost"
      icon
      onClick={toggleHistory}
      aria-pressed={historyOpen}
      aria-label={label}
      title={label}
      className={
        historyOpen
          ? 'size-11 rounded-full bg-hover text-ink'
          : 'size-11 rounded-full'
      }
    >
      <History aria-hidden="true" className="size-5" strokeWidth={2} />
    </Button>
  );
}
