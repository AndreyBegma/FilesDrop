import { createHash, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerModuleOptions } from '@nestjs/throttler';
import type { Request } from 'express';
import ipaddr from 'ipaddr.js';
import { apiError } from './api-error';
import type { FilesConfig } from './files.config';

export const UPLOAD_THROTTLER = 'uploads';

/** A Telegram user id: a positive integer, at most 20 digits. */
const TELEGRAM_USER_ID = /^[1-9]\d{0,19}$/;

const header = (req: Request, name: string): string | undefined => {
  const value = req.headers[name];
  return (Array.isArray(value) ? value[0] : value)?.trim();
};

/**
 * Decision 5: the client is `CF-Connecting-IP` only when the deployment says
 * it sits behind Cloudflare (`TRUST_CF_HEADER=true`); otherwise `req.ip`.
 */
export const clientIp = (req: Request, trustCfHeader: boolean): string => {
  if (trustCfHeader) {
    const value = header(req, 'cf-connecting-ip');
    if (value && ipaddr.isValid(value)) return ipaddr.process(value).toString();
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
};

/**
 * Constant-time comparison. Both sides are hashed first so that the buffers
 * have equal length and the comparison leaks neither the key nor its length.
 */
const sameSecret = (given: string, expected: string): boolean =>
  timingSafeEqual(
    createHash('sha256').update(given).digest(),
    createHash('sha256').update(expected).digest(),
  );

/**
 * Issue #20: the Telegram bot uploads over the internal network, so all of its
 * uploads come from one IP. When it proves itself with `X-Bot-Key` (equal to
 * BOT_API_KEY), the budget is per Telegram user instead: `tg:<X-Bot-User>`.
 * Without BOT_API_KEY the feature is off. A wrong or missing key, or a user id
 * that is not a number, means an ordinary client: `X-Bot-User` is ignored and
 * the caller is counted by IP.
 */
export const botTracker = (
  req: Request,
  botApiKey: string | undefined,
): string | undefined => {
  if (!botApiKey) return undefined;
  const key = header(req, 'x-bot-key');
  if (!key || !sameSecret(key, botApiKey)) return undefined;
  const user = header(req, 'x-bot-user');
  if (!user || !TELEGRAM_USER_ID.test(user)) return undefined;
  return `tg:${user}`;
};

export const uploadTracker = (
  req: Request,
  trustCfHeader: boolean,
  botApiKey: string | undefined,
): string => botTracker(req, botApiKey) ?? clientIp(req, trustCfHeader);

/**
 * BOT_API_KEY is read here rather than through FilesConfig because only this
 * guard uses it. ConfigModule has loaded apps/api/.env into process.env by the
 * time the throttler module's factory runs (it is called with FILES_CONFIG
 * only, so the default below applies).
 */
export const uploadThrottlerOptions = (
  config: FilesConfig,
  botApiKey: string | undefined = process.env.BOT_API_KEY?.trim() || undefined,
): ThrottlerModuleOptions => ({
  throttlers: [
    {
      name: UPLOAD_THROTTLER,
      limit: config.rateLimit,
      ttl: config.rateWindowMs,
    },
  ],
  getTracker: (req) =>
    uploadTracker(req as Request, config.trustCfHeader, botApiKey),
  // File and URL uploads share one budget: the key ignores the route.
  generateKey: (_context, tracker, name) => `${name}:${tracker}`,
});

/** Applied only to the two upload routes. Answers 429 as an `ApiError`. */
@Injectable()
export class UploadThrottlerGuard extends ThrottlerGuard {
  protected override async throwThrottlingException(): Promise<void> {
    throw apiError(429, 'rate_limited');
  }
}
