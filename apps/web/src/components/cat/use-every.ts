'use client';

import { useEffect, useRef } from 'react';

/**
 * Calls `fn` again and again, waiting a random `minMs`…`maxMs` between calls.
 * Runs only in the browser (never during render), so server and client
 * markup stay identical.
 */
export function useEvery(
  fn: () => void,
  minMs: number,
  maxMs: number,
  enabled: boolean,
) {
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(
        () => {
          latest.current();
          schedule();
        },
        minMs + Math.random() * (maxMs - minMs),
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, [minMs, maxMs, enabled]);
}
