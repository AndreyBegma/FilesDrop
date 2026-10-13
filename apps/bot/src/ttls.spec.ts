import { describe, expect, it } from 'bun:test';
import { DEFAULT_TTL, readTtls, TTLS, ttlLabel } from './ttls';

describe('readTtls', () => {
  it('takes the list from @filesdrop/shared, sorted by length', () => {
    expect(readTtls(['24h', '1h', '72h', '12h'])).toEqual([
      '1h',
      '12h',
      '24h',
      '72h',
    ]);
  });

  it('falls back to 1h, 12h, 24h when the export is missing or odd', () => {
    for (const source of [undefined, null, [], ['1h', 3], ['1d'], 'x']) {
      expect(readTtls(source)).toEqual(['1h', '12h', '24h']);
    }
  });

  it('reads the real package and keeps 24h as the default', () => {
    expect(TTLS).toContain('1h');
    expect(TTLS).toContain('24h');
    expect(DEFAULT_TTL).toBe('24h');
  });
});

describe('ttlLabel', () => {
  it('shows whole days above one day in days', () => {
    expect(ttlLabel('72h')).toBe('3d');
    expect(ttlLabel('48h')).toBe('2d');
  });

  it('keeps hours otherwise', () => {
    expect(ttlLabel('1h')).toBe('1h');
    expect(ttlLabel('12h')).toBe('12h');
    expect(ttlLabel('24h')).toBe('24h');
    expect(ttlLabel('36h')).toBe('36h');
  });
});
