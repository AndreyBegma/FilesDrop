import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const SLUG_LENGTH = 8;
export const SLUG_PATTERN = /^[0-9A-Za-z]{8}$/;

/** 8 base62 characters from the CSPRNG, without modulo bias. */
export const generateSlug = (): string => {
  let slug = '';
  while (slug.length < SLUG_LENGTH) {
    for (const byte of randomBytes(16)) {
      // 248 = 4 * 62: bytes at or above it would bias the distribution.
      if (byte < 248 && slug.length < SLUG_LENGTH) slug += BASE62[byte % 62];
    }
  }
  return slug;
};

/** Random 32-byte delete token, base64url. Only its hash is stored. */
export const generateDeleteToken = (): string =>
  randomBytes(32).toString('base64url');

export const hashDeleteToken = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex');

/** Compares a presented token with a stored SHA-256 hex digest in constant time. */
export const deleteTokenMatches = (
  presented: string,
  storedHash: string,
): boolean => {
  const expected = Buffer.from(storedHash, 'hex');
  const actual = Buffer.from(hashDeleteToken(presented), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};
