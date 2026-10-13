'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

const getSnapshot = (): boolean => window.matchMedia(QUERY).matches;

/** The server cannot know the visitor's setting, so it renders motion on. */
const getServerSnapshot = (): boolean => false;

/**
 * `prefers-reduced-motion`, hydration-safe.
 *
 * motion's own `useReducedMotion` returns `null` on the server and the real
 * value on the client's first render, so a visitor with reduced motion
 * hydrated different markup than the server sent (animated vs still parts of
 * the cat) and React logged a hydration mismatch. `useSyncExternalStore`
 * hydrates with the server snapshot, then re-renders with the real one before
 * anything animates, and follows the setting if it changes later.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
