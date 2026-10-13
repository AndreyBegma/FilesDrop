import {
  deleteTokenMatches,
  generateDeleteToken,
  generateSlug,
  hashDeleteToken,
  SLUG_PATTERN,
} from './secrets';

describe('secrets', () => {
  it('generates 8-char base62 slugs', () => {
    const slugs = new Set(Array.from({ length: 1000 }, generateSlug));
    for (const slug of slugs) expect(slug).toMatch(SLUG_PATTERN);
    expect(slugs.size).toBe(1000);
  });

  it('generates 32-byte base64url delete tokens', () => {
    const token = generateDeleteToken();
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateDeleteToken()).not.toBe(token);
  });

  it('stores sha256 hex and compares tokens against it', () => {
    const token = generateDeleteToken();
    const hash = hashDeleteToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(deleteTokenMatches(token, hash)).toBe(true);
    expect(deleteTokenMatches(generateDeleteToken(), hash)).toBe(false);
    expect(deleteTokenMatches('', hash)).toBe(false);
    expect(deleteTokenMatches(token, 'not-hex')).toBe(false);
  });
});
