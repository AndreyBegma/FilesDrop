/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import {
  EXPIRED_GRACE_MS,
  HISTORY_MAX,
  type HistoryEntry,
  parseHistory,
  prune,
} from './store';

const HOUR = 3_600_000;
const NOW = Date.parse('2026-10-13T12:00:00Z');

function entry(slug: string, expiresInMs: number): HistoryEntry {
  return {
    slug,
    name: `${slug}.png`,
    ext: 'png',
    mime: 'image/png',
    size: 10,
    createdAt: new Date(NOW - HOUR).toISOString(),
    expiresAt: new Date(NOW + expiresInMs).toISOString(),
    inline: true,
    locked: false,
    deleteToken: `token-${slug}`,
    source: 'file',
  };
}

describe('prune', () => {
  test('keeps live and recently expired entries, drops those past the grace day', () => {
    const kept = prune(
      [
        entry('live', HOUR),
        entry('fresh-expired', -HOUR),
        entry('old-expired', -(EXPIRED_GRACE_MS + HOUR)),
      ],
      NOW,
    );
    expect(kept.map((e) => e.slug)).toEqual(['live', 'fresh-expired']);
  });

  test(`caps the list at ${HISTORY_MAX}, newest first`, () => {
    const many = Array.from({ length: HISTORY_MAX + 5 }, (_, i) =>
      entry(`s${i}`, HOUR),
    );
    const kept = prune(many, NOW);
    expect(kept).toHaveLength(HISTORY_MAX);
    expect(kept[0].slug).toBe('s0');
  });

  test('drops duplicate slugs, keeping the first', () => {
    const kept = prune([entry('a', HOUR), entry('a', 2 * HOUR)], NOW);
    expect(kept).toHaveLength(1);
    expect(kept[0].expiresAt).toBe(entry('a', HOUR).expiresAt);
  });
});

describe('parseHistory', () => {
  test('survives garbage', () => {
    expect(parseHistory(null)).toEqual([]);
    expect(parseHistory('not json')).toEqual([]);
    expect(parseHistory('{"a":1}')).toEqual([]);
  });

  test('keeps only well-formed entries, delete token included', () => {
    const good = entry('good', HOUR);
    const raw = JSON.stringify([good, { slug: 'broken' }, 42]);
    const parsed = parseHistory(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].deleteToken).toBe('token-good');
  });

  test('entries saved before passwords existed read as unlocked', () => {
    const { locked: _locked, ...old } = entry('old', HOUR);
    const [parsed] = parseHistory(JSON.stringify([old]));
    expect(parsed.locked).toBe(false);
    const [locked] = parseHistory(
      JSON.stringify([{ ...entry('new', HOUR), locked: true }]),
    );
    expect(locked.locked).toBe(true);
  });
});
