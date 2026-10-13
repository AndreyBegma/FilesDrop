import {
  FILE_ACCESS_TTL_SEC,
  FileAccessTokens,
  fileAccessSecretFromEnv,
} from './file-access';
import { UnlockLimiter } from './unlock-limiter';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const tokens = new FileAccessTokens(Buffer.from('k'.repeat(48)));

describe('file access tokens', () => {
  it('issues a slug.exp.sig token valid for 10 minutes', () => {
    const { token, expiresInSec } = tokens.issue('Abcd1234', NOW);
    expect(expiresInSec).toBe(FILE_ACCESS_TTL_SEC);
    expect(token).toMatch(/^Abcd1234\.\d+\.[A-Za-z0-9_-]{43}$/);
    expect(Number(token.split('.')[1])).toBe(NOW / 1000 + 600);
    expect(tokens.verify(token, 'Abcd1234', NOW)).toBe(true);
    expect(tokens.verify(token, 'Abcd1234', NOW + 599_000)).toBe(true);
  });

  it('expires after 10 minutes', () => {
    const { token } = tokens.issue('Abcd1234', NOW);
    expect(tokens.verify(token, 'Abcd1234', NOW + 600_000)).toBe(false);
  });

  it('a token for slug A does not open slug B, even with B written into it', () => {
    const { token } = tokens.issue('AAAAAAAA', NOW);
    expect(tokens.verify(token, 'BBBBBBBB', NOW)).toBe(false);
    const swapped = token.replace('AAAAAAAA', 'BBBBBBBB');
    expect(tokens.verify(swapped, 'BBBBBBBB', NOW)).toBe(false);
  });

  it('rejects a pushed-out expiry, another secret and junk', () => {
    const { token } = tokens.issue('Abcd1234', NOW);
    const [slug, exp, sig] = token.split('.');
    expect(
      tokens.verify(`${slug}.${Number(exp) + 3600}.${sig}`, slug, NOW),
    ).toBe(false);
    const other = new FileAccessTokens(Buffer.from('x'.repeat(48)));
    expect(other.verify(token, slug, NOW)).toBe(false);
    for (const junk of [undefined, '', 'a.b', 'a.b.c', `${slug}.-1.${sig}`]) {
      expect(tokens.verify(junk, slug, NOW)).toBe(false);
    }
  });
});

describe('FILE_ACCESS_SECRET', () => {
  const envOf =
    (vars: Record<string, string>) =>
    (key: string): string | undefined =>
      vars[key];

  it('uses the configured secret', () => {
    const secret = 's'.repeat(40);
    const warn = jest.fn();
    expect(
      fileAccessSecretFromEnv(envOf({ FILE_ACCESS_SECRET: secret }), warn),
    ).toEqual(Buffer.from(secret));
    expect(warn).not.toHaveBeenCalled();
  });

  it('refuses to start in production without it', () => {
    expect(() =>
      fileAccessSecretFromEnv(envOf({ NODE_ENV: 'production' }), jest.fn()),
    ).toThrow(/FILE_ACCESS_SECRET is required/);
    expect(() =>
      fileAccessSecretFromEnv(envOf({ APP_ENV: 'production' }), jest.fn()),
    ).toThrow(/FILE_ACCESS_SECRET is required/);
  });

  it('refuses a short secret', () => {
    expect(() =>
      fileAccessSecretFromEnv(
        envOf({ FILE_ACCESS_SECRET: 'short' }),
        jest.fn(),
      ),
    ).toThrow(/at least 32/);
  });

  it('falls back to a random per-boot secret in development, with a warning', () => {
    const warn = jest.fn();
    const a = fileAccessSecretFromEnv(envOf({ APP_ENV: 'development' }), warn);
    const b = fileAccessSecretFromEnv(envOf({}), warn);
    expect(a).toHaveLength(32);
    expect(a.equals(b)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('unlock limiter', () => {
  it('allows 10 wrong attempts per slug and client in 15 minutes', () => {
    const limiter = new UnlockLimiter();
    for (let i = 0; i < 10; i++) {
      expect(limiter.reserve('S', '1.1.1.1', NOW)).not.toBeNull();
    }
    expect(limiter.reserve('S', '1.1.1.1', NOW)).toBeNull();
    // Another client and another file are counted separately.
    expect(limiter.reserve('S', '2.2.2.2', NOW)).not.toBeNull();
    expect(limiter.reserve('T', '1.1.1.1', NOW)).not.toBeNull();
    // The window slides.
    expect(
      limiter.reserve('S', '1.1.1.1', NOW + 15 * 60_000 + 1),
    ).not.toBeNull();
  });

  it('allows 50 wrong attempts per slug from everyone', () => {
    const limiter = new UnlockLimiter();
    for (let i = 0; i < 50; i++) {
      expect(limiter.reserve('S', `10.0.0.${i}`, NOW)).not.toBeNull();
    }
    expect(limiter.reserve('S', '10.0.1.1', NOW)).toBeNull();
  });

  it('does not count an attempt that was released (right password)', () => {
    const limiter = new UnlockLimiter();
    for (let i = 0; i < 20; i++) {
      const release = limiter.reserve('S', '1.1.1.1', NOW);
      expect(release).not.toBeNull();
      release?.();
    }
  });
});
