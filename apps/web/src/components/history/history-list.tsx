'use client';

import { Button } from '@andrewbehma/glass-ui/button';
import { DialogContent, DialogRoot } from '@andrewbehma/glass-ui/dialog';
import { toast } from '@andrewbehma/glass-ui/toast';
import { Trash2 } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Cat } from '@/components/cat';
import { deleteRemote } from '@/components/drop/actions';
import { cueMascot, useNow } from '@/components/drop/hooks';
import { announce } from '@/components/drop/live-region';
import { HistoryRow } from './history-row';
import { type HistoryEntry, historyStore, useHistory } from './store';

/** How long the cat's swipe plays before the row leaves. */
const SWIPE_MS = 650;

export function HistoryList() {
  const t = useTranslations('History');
  const tErr = useTranslations('Errors');
  const entries = useHistory();
  const now = useNow(30_000);
  const reduced = useReducedMotion();
  const [swiping, setSwiping] = useState<ReadonlySet<string>>(new Set());
  const [confirming, setConfirming] = useState(false);

  // Entries a day past their expiry drop out on their own.
  useEffect(() => {
    if (now > 0) historyStore.sweep();
  }, [now]);

  const remove = async (entry: HistoryEntry) => {
    setSwiping((s) => new Set(s).add(entry.slug));
    cueMascot('delete');
    const [result] = await Promise.all([
      deleteRemote(entry.slug, entry.deleteToken),
      new Promise((r) => setTimeout(r, reduced ? 0 : SWIPE_MS)),
    ]);
    setSwiping((s) => {
      const next = new Set(s);
      next.delete(entry.slug);
      return next;
    });
    if (!result.ok) {
      cueMascot(result.failure.pose);
      toast.error(tErr(result.failure.key), { description: entry.name });
      announce(tErr(result.failure.key));
      return;
    }
    historyStore.remove(entry.slug);
    announce(t('deletedLive', { name: entry.name }));
  };

  const forget = (entry: HistoryEntry) => {
    historyStore.remove(entry.slug);
    announce(t('forgotLive', { name: entry.name }));
  };

  const clear = () => {
    historyStore.clear();
    setConfirming(false);
    announce(t('clearedLive'));
  };

  if (entries.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <div className="w-40">
          <Cat pose="empty" label={t('emptyCat')} />
        </div>
        <p className="mt-3 font-display text-[1.25rem] font-extrabold text-ink">
          {t('emptyTitle')}
        </p>
        <p className="mt-1.5 max-w-[30ch] text-body text-balance text-ink-2">
          {t('emptyBody')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="min-h-0 flex-1 divide-y divide-line overflow-x-hidden overflow-y-auto">
        <AnimatePresence initial={false}>
          {entries.map((entry) => (
            <motion.li
              key={entry.slug}
              layout={!reduced}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0, x: 0, rotate: 0 }}
              exit={
                reduced
                  ? { opacity: 0, transition: { duration: 0.12 } }
                  : {
                      opacity: 0,
                      x: '105%',
                      rotate: 6,
                      transition: { duration: 0.32, ease: [0.4, 0, 1, 1] },
                    }
              }
            >
              <HistoryRow
                entry={entry}
                now={now}
                swiping={swiping.has(entry.slug)}
                onDelete={remove}
                onForget={forget}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <div className="shrink-0 border-t border-line px-3 pt-2 pb-1">
        <Button
          variant="ghost"
          onClick={() => setConfirming(true)}
          className="h-11 w-full gap-2 rounded-full hover:text-danger"
        >
          <Trash2 aria-hidden="true" className="size-4" />
          {t('clear')}
        </Button>
      </div>

      <DialogRoot open={confirming} onOpenChange={setConfirming}>
        <DialogContent
          title={t('clearTitle')}
          description={t('clearBody', { count: entries.length })}
          footer={
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setConfirming(false)}
                className="h-11 rounded-full px-5"
              >
                {t('clearCancel')}
              </Button>
              <Button
                variant="danger"
                onClick={clear}
                className="h-11 rounded-full px-5 font-bold"
              >
                {t('clearConfirm')}
              </Button>
            </div>
          }
        >
          <div className="mx-auto w-32">
            <Cat pose="delete" />
          </div>
        </DialogContent>
      </DialogRoot>
    </div>
  );
}
