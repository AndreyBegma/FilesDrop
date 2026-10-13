import type { UploadResult } from '@filesdrop/shared';
import { useSyncExternalStore } from 'react';

/**
 * The uploader's history lives only in this browser (Summary: no accounts).
 * Every entry keeps its `deleteToken`, the one secret that can remove the
 * file early. Storage may be missing (private mode, blocked site data), so
 * every access is wrapped and the list simply lives in memory then.
 */
export const HISTORY_KEY = 'filesdrop:history:v1';
export const HISTORY_MAX = 200;
/** Expired entries stay visible (faded) for another day, then drop out. */
export const EXPIRED_GRACE_MS = 24 * 60 * 60 * 1000;

export type HistoryEntry = UploadResult & {
  /** Where it came from: a picked/dropped/pasted file or a URL. */
  source: 'file' | 'url';
};

const EMPTY: readonly HistoryEntry[] = Object.freeze([]);

function isEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.slug === 'string' &&
    typeof v.name === 'string' &&
    typeof v.ext === 'string' &&
    typeof v.mime === 'string' &&
    typeof v.size === 'number' &&
    typeof v.createdAt === 'string' &&
    typeof v.expiresAt === 'string' &&
    typeof v.deleteToken === 'string'
  );
}

/** Newest first, capped, with entries past their grace period removed. */
export function prune(
  entries: readonly HistoryEntry[],
  now = Date.now(),
): HistoryEntry[] {
  const seen = new Set<string>();
  const kept: HistoryEntry[] = [];
  for (const entry of entries) {
    if (seen.has(entry.slug)) continue;
    const expires = Date.parse(entry.expiresAt);
    if (Number.isFinite(expires) && now - expires > EXPIRED_GRACE_MS) continue;
    seen.add(entry.slug);
    kept.push(entry);
    if (kept.length >= HISTORY_MAX) break;
  }
  return kept;
}

export function parseHistory(raw: string | null): HistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).map((e) => ({
      ...e,
      inline: Boolean(e.inline),
      locked: e.locked === true,
      source: e.source === 'url' ? 'url' : 'file',
    }));
  } catch {
    return [];
  }
}

let cache: readonly HistoryEntry[] | null = null;
const listeners = new Set<() => void>();
/** Told about a single entry removed on purpose (a delete, not a clear). */
const removedListeners = new Set<(slug: string) => void>();

function load(): readonly HistoryEntry[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(HISTORY_KEY);
  } catch {
    // Storage unavailable: keep whatever is in memory.
    return cache ?? EMPTY;
  }
  const parsed = parseHistory(raw);
  const kept = prune(parsed);
  if (kept.length !== parsed.length) {
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(kept));
    } catch {
      // Read-only storage: prune again next time.
    }
  }
  return kept;
}

function save(next: readonly HistoryEntry[]) {
  cache = next;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Quota or privacy mode: the list still works for this tab.
  }
  for (const listener of listeners) listener();
}

function snapshot(): readonly HistoryEntry[] {
  if (cache === null) cache = load();
  return cache;
}

function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== HISTORY_KEY) return;
  cache = load();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

export const historyStore = {
  get: snapshot,
  add(entry: HistoryEntry) {
    save(prune([entry, ...snapshot().filter((e) => e.slug !== entry.slug)]));
  },
  remove(slug: string) {
    save(snapshot().filter((e) => e.slug !== slug));
    for (const listener of removedListeners) listener(slug);
  },
  onRemove(listener: (slug: string) => void) {
    removedListeners.add(listener);
    return () => {
      removedListeners.delete(listener);
    };
  },
  clear() {
    save([]);
  },
  /** Drops entries whose grace period has passed. */
  sweep() {
    const current = snapshot();
    const next = prune(current);
    if (next.length !== current.length) save(next);
  },
};

/** The history, newest first. Empty on the server and before hydration. */
export function useHistory(): readonly HistoryEntry[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
