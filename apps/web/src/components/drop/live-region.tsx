'use client';

import { useEffect, useState } from 'react';

const listeners = new Set<(message: string) => void>();

/** Says `message` through the page's polite live region. */
export function announce(message: string) {
  for (const listener of listeners) listener(message);
}

/**
 * One polite region for progress and results. The text is cleared and set
 * again so the same sentence twice is still read twice.
 */
export function LiveRegion() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    let frame = 0;
    const listener = (next: string) => {
      setMessage('');
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setMessage(next));
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
