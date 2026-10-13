import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** How long an unlock lets `/f/` serve a locked file. */
export const FILE_ACCESS_TTL_SEC = 600;
/** A hand-written secret shorter than this is refused. */
export const FILE_ACCESS_SECRET_MIN = 32;

const EXP_PATTERN = /^\d{1,12}$/;

/**
 * Short-lived proof that someone knew a locked file's password:
 * `<slug>.<exp>.<HMAC-SHA256(secret, "<slug>.<exp>")>`, exp in Unix seconds.
 * Stateless: nothing is stored, and a token for one slug never verifies
 * against another because the slug is part of what is signed.
 */
export class FileAccessTokens {
  constructor(private readonly secret: Buffer) {}

  issue(
    slug: string,
    now = Date.now(),
  ): { token: string; expiresInSec: number } {
    const exp = Math.floor(now / 1000) + FILE_ACCESS_TTL_SEC;
    const payload = `${slug}.${exp}`;
    return {
      token: `${payload}.${this.sign(payload).toString('base64url')}`,
      expiresInSec: FILE_ACCESS_TTL_SEC,
    };
  }

  /** Whether `token` grants access to `slug` at `now`. */
  verify(token: string | undefined, slug: string, now = Date.now()): boolean {
    if (!token || token.length > 200) return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [, exp, sig] = parts;
    if (!EXP_PATTERN.test(exp)) return false;
    // Signed over the slug being asked for, not the one in the token.
    const expected = this.sign(`${slug}.${exp}`);
    const actual = Buffer.from(sig, 'base64url');
    const signed =
      actual.length === expected.length && timingSafeEqual(actual, expected);
    return signed && Number(exp) > Math.floor(now / 1000);
  }

  private sign(payload: string): Buffer {
    return createHmac('sha256', this.secret).update(payload, 'utf8').digest();
  }
}

type EnvReader = (key: string) => string | undefined;

export const isProduction = (env: EnvReader): boolean =>
  env('NODE_ENV') === 'production' || env('APP_ENV') === 'production';

/**
 * `FILE_ACCESS_SECRET` as key bytes. Required in production; in development a
 * random per-boot secret stands in (tokens die with the process).
 */
export const fileAccessSecretFromEnv = (
  env: EnvReader,
  warn: (message: string) => void,
): Buffer => {
  const raw = env('FILE_ACCESS_SECRET')?.trim();
  if (raw) {
    if (raw.length < FILE_ACCESS_SECRET_MIN) {
      throw new Error(
        `FILE_ACCESS_SECRET must be at least ${FILE_ACCESS_SECRET_MIN} characters`,
      );
    }
    return Buffer.from(raw, 'utf8');
  }
  if (isProduction(env)) {
    throw new Error(
      'FILE_ACCESS_SECRET is required in production (openssl rand -base64 48)',
    );
  }
  warn(
    'FILE_ACCESS_SECRET is not set: using a random per-boot secret. Unlocked links stop working on restart.',
  );
  return randomBytes(32);
};
