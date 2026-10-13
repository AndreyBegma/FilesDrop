import { resolve } from 'node:path';

export const FILES_CONFIG = Symbol('FILES_CONFIG');

export type FilesConfig = {
  /** Absolute directory holding `<slug>` files and the `.tmp/` staging area. */
  uploadDir: string;
  /** Quota: the sum of `size` over non-expired files. */
  maxTotalBytes: number;
  /** Uploads (file + URL combined) per window per client IP. */
  rateLimit: number;
  rateWindowMs: number;
  /** Take the client IP from `CF-Connecting-IP` (only behind Cloudflare). */
  trustCfHeader: boolean;
  /** Total budget for an upload from URL, redirects and body included. */
  fetchTimeoutMs: number;
  maxRedirects: number;
};

type EnvReader = (key: string) => string | undefined;

const positiveInt = (env: EnvReader, key: string, fallback: number): number => {
  const raw = env(key);
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer, got "${raw}"`);
  }
  return value;
};

export const filesConfigFromEnv = (env: EnvReader): FilesConfig => ({
  uploadDir: resolve(env('UPLOAD_DIR') || './.uploads'),
  maxTotalBytes: positiveInt(env, 'MAX_TOTAL_BYTES', 10 * 1024 * 1024 * 1024),
  rateLimit: positiveInt(env, 'RATE_LIMIT', 30),
  rateWindowMs: positiveInt(env, 'RATE_WINDOW_MS', 10 * 60 * 1000),
  trustCfHeader: env('TRUST_CF_HEADER')?.trim().toLowerCase() === 'true',
  fetchTimeoutMs: 30_000,
  maxRedirects: 3,
});
