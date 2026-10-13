'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { CatPose } from '@/components/cat';
import type { LinkMode } from './links';

/* ---------------------------------------------------------------- online */

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

/** `navigator.onLine`, live. True on the server. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/* ----------------------------------------------------------- media query */

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', cb);
      return () => list.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/* ------------------------------------------------------------------ clock */

/** `Date.now()`, refreshed every `every` ms. 0 on the server. */
export function useNow(every = 1000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), every);
    return () => window.clearInterval(id);
  }, [every]);
  return now;
}

/* -------------------------------------------------------------- link mode */

const LINK_MODE_KEY = 'filesdrop:link-mode:v1';
const modeListeners = new Set<() => void>();
let memoryMode: LinkMode | null = null;

function readMode(): LinkMode {
  if (memoryMode) return memoryMode;
  try {
    return window.localStorage.getItem(LINK_MODE_KEY) === 'preview'
      ? 'preview'
      : 'direct';
  } catch {
    return 'direct';
  }
}

export function setLinkMode(mode: LinkMode) {
  memoryMode = mode;
  try {
    window.localStorage.setItem(LINK_MODE_KEY, mode);
  } catch {
    // Remembered for this tab only.
  }
  for (const cb of modeListeners) cb();
}

/** Direct | Preview (Decision 3). Persisted; Direct by default. */
export function useLinkMode(): LinkMode {
  return useSyncExternalStore(
    (cb) => {
      modeListeners.add(cb);
      const onStorage = (e: StorageEvent) => {
        if (e.key === LINK_MODE_KEY) {
          memoryMode = null;
          cb();
        }
      };
      window.addEventListener('storage', onStorage);
      return () => {
        modeListeners.delete(cb);
        window.removeEventListener('storage', onStorage);
      };
    },
    readMode,
    () => 'direct',
  );
}

/* ------------------------------------------------------------ mascot bus */

/**
 * Moments that happen away from the drop zone (a delete in the history
 * panel, a copy in a result card) but that the big cat should act out.
 */
type MascotListener = (pose: CatPose) => void;
const mascotListeners = new Set<MascotListener>();

export function cueMascot(pose: CatPose) {
  for (const listener of mascotListeners) listener(pose);
}

export function useMascotCue(listener: MascotListener) {
  useEffect(() => {
    mascotListeners.add(listener);
    return () => {
      mascotListeners.delete(listener);
    };
  }, [listener]);
}
