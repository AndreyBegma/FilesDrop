'use client';

import { Toaster } from 'sonner';
import { useMediaQuery } from '@/components/drop/hooks';
import { useShell } from './shell-context';

/**
 * Wide enough that a toast fits in the gutter beside the page column
 * (50rem at `xl`, see AppShell) without touching it: 50rem + 2 × (18rem + 1rem).
 */
const ROOM_BESIDE_COLUMN = '(min-width: 90rem)';

/**
 * True when toasts sit in the side gutter, clear of every control on the
 * page. Otherwise they go to the top, over the sticky header, and the
 * caller should skip a toast whose news is already on screen (a copy: the
 * button turns into "Copied" and the cat holds up the link) so that nothing
 * ever lands on the button the visitor is about to press again.
 */
export function useSideToasts(): boolean {
  const roomy = useMediaQuery(ROOM_BESIDE_COLUMN);
  const { historyOpen } = useShell();
  // The open history panel takes the right gutter and narrows the left one.
  return roomy && !historyOpen;
}

/**
 * glass-ui's `Toaster`, placed for this layout. glass-ui only offers the
 * bottom-right and top-right corners; at most widths both overlap the page
 * column (the result card's Copy and Delete, the Fetch button). Same
 * material and class names as glass-ui's, so `toast()` from
 * `@andrewbehma/glass-ui/toast` (sonner's) looks the same.
 */
export function AppToaster({ label }: { label: string }) {
  const side = useSideToasts();
  return (
    <Toaster
      position={side ? 'bottom-right' : 'top-center'}
      containerAriaLabel={label}
      closeButton
      duration={6000}
      offset={side ? 16 : { top: 12 }}
      mobileOffset={{ top: 12, left: 12, right: 12 }}
      style={{ '--width': '18rem' } as React.CSSProperties}
      toastOptions={{
        classNames: {
          toast: '!glass-strong !rounded-surface !text-ink !font-sans',
          description: '!text-ink-2',
          actionButton: '!bg-ink !text-ground !rounded-control',
          cancelButton: '!bg-hover !text-ink !rounded-control',
          closeButton:
            '!bg-raised !text-ink !border-line hover:!border-line-strong',
          error: '!text-danger',
          success: '!text-ok',
        },
      }}
    />
  );
}
