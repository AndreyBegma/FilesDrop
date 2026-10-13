import { describe, expect, it } from 'bun:test';
import {
  CALLBACK_DATA_MAX_BYTES,
  decodeCallback,
  encodeCallback,
} from './callback-data';

const TTLS = ['1h', '12h', '24h', '72h'];

describe('callback data', () => {
  it('round-trips every action', () => {
    for (const ttl of TTLS) {
      expect(
        decodeCallback(encodeCallback({ kind: 'ttl', ttl }), TTLS),
      ).toEqual({ kind: 'ttl', ttl });
    }
    expect(decodeCallback(encodeCallback({ kind: 'delete' }), TTLS)).toEqual({
      kind: 'delete',
    });
  });

  it('fits Telegram’s 64 bytes and carries no secret', () => {
    for (const data of [
      encodeCallback({ kind: 'delete' }),
      ...TTLS.map((ttl) => encodeCallback({ kind: 'ttl', ttl })),
    ]) {
      expect(new TextEncoder().encode(data).length).toBeLessThanOrEqual(
        CALLBACK_DATA_MAX_BYTES,
      );
      expect(data).toMatch(/^fd1:(d|t:\d+h)$/);
    }
  });

  it('refuses a payload that would not fit', () => {
    expect(() =>
      encodeCallback({ kind: 'ttl', ttl: 'x'.repeat(80) }),
    ).toThrow();
  });

  it('ignores foreign, malformed or unoffered payloads', () => {
    for (const data of [
      undefined,
      '',
      'fd1',
      'fd1:t',
      'fd1:t:5h',
      'fd1:t:72h:extra',
      'fd1:d:x',
      'fd0:d',
      'something else',
    ]) {
      expect(decodeCallback(data, TTLS)).toBeUndefined();
    }
    // 72h buttons from before a downgrade stop working instead of erroring.
    expect(decodeCallback('fd1:t:72h', ['1h', '12h', '24h'])).toBeUndefined();
  });
});
