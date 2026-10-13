/** Lifetimes a file can be uploaded with. */
export const TTLS = ['1h', '12h', '24h', '72h'] as const;
export type Ttl = (typeof TTLS)[number];

/** TTL used when the client does not send one. */
export const DEFAULT_TTL: Ttl = '24h';

/** Per-file limit: Cloudflare Free caps request bodies at 100 MB. */
export const MAX_FILE_BYTES = 95 * 1024 * 1024;

export type FileMeta = {
  slug: string;
  name: string;
  ext: string;
  mime: string;
  size: number;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  expiresAt: string;
  /** Whether `/f/` serves it inline (otherwise as an attachment). */
  inline: boolean;
  /** Password-protected: `/f/` needs an access token from `unlock`. */
  locked: boolean;
};

/** What `GET /api/files/:slug` tells anyone about a locked file. */
export type LockedFileMeta = {
  slug: string;
  locked: true;
  /** ISO 8601 */
  expiresAt: string;
};

/** `GET /api/files/:slug`: the full meta, or only the lock for a locked file. */
export type FileLookup = FileMeta | LockedFileMeta;

/** `POST /api/files/:slug/unlock`: a short-lived token for `/f/` plus the meta. */
export type UnlockResult = FileMeta & {
  /** Send as `?k=<token>` or `X-File-Access: <token>`. */
  token: string;
  expiresInSec: number;
};

/** Password length accepted at upload and unlock. */
export const PASSWORD_MIN = 4;
export const PASSWORD_MAX = 128;

export type UploadResult = FileMeta & { deleteToken: string };

export type ApiError = { statusCode: number; error: string; reason?: string };

/** Milliseconds per TTL value. */
export const ttlToMs = (ttl: Ttl): number =>
  ({
    '1h': 3_600_000,
    '12h': 43_200_000,
    '24h': 86_400_000,
    '72h': 259_200_000,
  })[ttl];
