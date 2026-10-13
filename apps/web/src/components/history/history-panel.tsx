'use client';

import { SheetContent, SheetRoot } from '@andrewbehma/glass-ui/sheet';
import { SidePanel, useSidePanel } from '@andrewbehma/glass-ui/side-panel';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useMediaQuery } from '@/components/drop/hooks';
import { LiveRegion } from '@/components/drop/live-region';
import { AppToaster } from '@/components/shell/app-toaster';
import { useShell } from '@/components/shell/shell-context';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { HistoryList } from './history-list';
import { useHistory } from './store';

/** Dragging the panel shut closes the history, rather than leaving a strip. */
function CloseOnCollapse({ onClose }: { onClose: () => void }) {
  const { collapsed } = useSidePanel();
  useEffect(() => {
    if (collapsed) onClose();
  }, [collapsed, onClose]);
  return null;
}

/**
 * Makes room for the panel: its width goes to `--fd-panel-w` and
 * `data-history-open` on <html>, and globals.css pads the page by that much,
 * so the column re-centres (and narrows if it must) beside the panel instead
 * of disappearing under it.
 */
function PushPage() {
  const { width } = useSidePanel();
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--fd-panel-w', `${width}px`);
    root.setAttribute('data-history-open', '');
  }, [width]);
  useEffect(
    () => () => {
      const root = document.documentElement;
      root.removeAttribute('data-history-open');
      root.style.removeProperty('--fd-panel-w');
    },
    [],
  );
  return null;
}

function Heading({ onClose }: { onClose?: () => void }) {
  const t = useTranslations('History');
  const count = useHistory().length;
  return (
    <div className="flex shrink-0 items-center gap-2 px-4 pt-3 pb-2">
      <h2 className="font-display text-[1.25rem] font-extrabold text-ink">
        {t('title')}
      </h2>
      {count > 0 ? (
        <span className="rounded-full bg-hover px-2 py-0.5 text-label font-bold text-ink-2 tabular-nums">
          {count}
        </span>
      ) : null}
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          title={t('close')}
          className="ml-auto grid size-11 place-items-center rounded-full text-ink-2 transition-colors hover:bg-hover hover:text-ink"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * The uploads history, opened by the header's toggle: a side panel that
 * pushes the page aside on a wide screen (80rem and up, where the column and
 * the panel both fit), a sheet from the right on a tablet or a narrow
 * desktop, and a bottom sheet on a phone. Also hosts the page's toaster, since it
 * is mounted once on every page, and the polite live region for the same reason.
 */
export function HistoryPanel() {
  const t = useTranslations('History');
  const { historyOpen, setHistoryOpen } = useShell();
  const wide = useMediaQuery('(min-width: 80rem)');
  const tablet = useMediaQuery('(min-width: 40rem)');
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!historyOpen || !wide) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHistoryOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [historyOpen, wide, setHistoryOpen]);

  const close = () => setHistoryOpen(false);

  return (
    <>
      <LiveRegion />
      <AppToaster label={t('notifications')} />
      {wide ? (
        <AnimatePresence>
          {historyOpen ? (
            <motion.div
              key="panel"
              className="fixed top-[5.75rem] right-4 bottom-4 z-chrome flex"
              initial={reduced ? { opacity: 0 } : { opacity: 0, x: 48 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: 48 }}
              transition={
                reduced
                  ? { duration: 0.15 }
                  : { type: 'spring', stiffness: 360, damping: 34 }
              }
            >
              <SidePanel
                storageKey="filesdrop:history-panel:v1"
                aria-label={t('title')}
                labels={{ resize: t('resize'), expand: t('expand') }}
                side="end"
                material="glass-strong"
                minWidth={300}
                maxWidth={480}
                defaultWidth={320}
                override={false}
                className="h-full overflow-hidden rounded-sheet"
              >
                <CloseOnCollapse onClose={close} />
                <PushPage />
                <Heading onClose={close} />
                <HistoryList />
              </SidePanel>
            </motion.div>
          ) : null}
        </AnimatePresence>
      ) : (
        <SheetRoot open={historyOpen} onOpenChange={setHistoryOpen}>
          <SheetContent
            title={t('title')}
            hideTitle
            pad="none"
            side={tablet ? 'right' : 'bottom'}
          >
            <div
              className={
                tablet ? 'flex h-full flex-col' : 'flex min-h-[50dvh] flex-col'
              }
            >
              <Heading onClose={tablet ? close : undefined} />
              <HistoryList />
            </div>
          </SheetContent>
        </SheetRoot>
      )}
    </>
  );
}
