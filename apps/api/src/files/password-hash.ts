import {
  randomBytes,
  type ScryptOptions,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';

/**
 * File passwords are stored only as a salted scrypt hash, self-describing so
 * the cost can be raised later without breaking stored ones:
 *
 *   scrypt$<N>$<r>$<p>$<salt base64url>$<hash base64url>
 */

const SCHEME = 'scrypt';
/** 2^15 × 8 × 128 B = 32 MiB per hash: ~50–100 ms, fine in a 512 MB box. */
const DEFAULT_COST = { N: 2 ** 15, r: 8, p: 1 } as const;
const SALT_BYTES = 16;
const KEY_BYTES = 32;
const MAX_MEM = 64 * 1024 * 1024;

/** Bounds on params read back from the database, so a bad row can't DoS us. */
const MAX_N = 2 ** 17;
const MAX_R = 16;
const MAX_P = 4;

type Cost = { N: number; r: number; p: number };

const derive = (
  password: string,
  salt: Buffer,
  keylen: number,
  cost: Cost,
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const options: ScryptOptions = { ...cost, maxmem: MAX_MEM };
    scrypt(password.normalize('NFC'), salt, keylen, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });

export const hashPassword = async (
  password: string,
  cost: Cost = DEFAULT_COST,
): Promise<string> => {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, KEY_BYTES, cost);
  return [
    SCHEME,
    cost.N,
    cost.r,
    cost.p,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$');
};

const isPowerOfTwo = (n: number) => n > 1 && (n & (n - 1)) === 0;

const parse = (
  encoded: string,
): { cost: Cost; salt: Buffer; key: Buffer } | null => {
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== SCHEME) return null;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (
    !Number.isSafeInteger(N) ||
    !Number.isSafeInteger(r) ||
    !Number.isSafeInteger(p) ||
    !isPowerOfTwo(N) ||
    N > MAX_N ||
    r < 1 ||
    r > MAX_R ||
    p < 1 ||
    p > MAX_P
  ) {
    return null;
  }
  const salt = Buffer.from(parts[4], 'base64url');
  const key = Buffer.from(parts[5], 'base64url');
  if (salt.length < 8 || key.length < 16) return null;
  return { cost: { N, r, p }, salt, key };
};

/** Recomputes the hash with the stored params and compares in constant time. */
export const verifyPassword = async (
  password: string,
  encoded: string,
): Promise<boolean> => {
  const stored = parse(encoded);
  if (!stored) return false;
  const actual = await derive(
    password,
    stored.salt,
    stored.key.length,
    stored.cost,
  );
  return timingSafeEqual(actual, stored.key);
};
