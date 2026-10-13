import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerModuleOptions } from '@nestjs/throttler';
import type { Request } from 'express';
import ipaddr from 'ipaddr.js';
import { apiError } from './api-error';
import type { FilesConfig } from './files.config';

export const UPLOAD_THROTTLER = 'uploads';

/**
 * Decision 5: the client is `CF-Connecting-IP` only when the deployment says
 * it sits behind Cloudflare (`TRUST_CF_HEADER=true`); otherwise `req.ip`.
 */
export const clientIp = (req: Request, trustCfHeader: boolean): string => {
  if (trustCfHeader) {
    const header = req.headers['cf-connecting-ip'];
    const value = (Array.isArray(header) ? header[0] : header)?.trim();
    if (value && ipaddr.isValid(value)) return ipaddr.process(value).toString();
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
};

export const uploadThrottlerOptions = (
  config: FilesConfig,
): ThrottlerModuleOptions => ({
  throttlers: [
    {
      name: UPLOAD_THROTTLER,
      limit: config.rateLimit,
      ttl: config.rateWindowMs,
    },
  ],
  getTracker: (req) => clientIp(req as Request, config.trustCfHeader),
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
