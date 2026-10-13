import type { ApiError } from '@filesdrop/shared';
import type { CatPose } from '@/components/cat';

/** Every message key under `Errors` in messages/*.json. */
export type ErrorKey =
  | 'tooBig'
  | 'boxFull'
  | 'denied'
  | 'rateLimited'
  | 'offline'
  | 'network'
  | 'invalidUrl'
  | 'blockedAddress'
  | 'dnsFailed'
  | 'tooManyRedirects'
  | 'fetchFailed'
  | 'remoteStatus'
  | 'timeout'
  | 'notFound'
  | 'expired'
  | 'wrongToken'
  | 'passwordTooShort'
  | 'passwordTooLong'
  | 'wrongPassword'
  | 'tooManyAttempts'
  | 'locked'
  | 'unknown';

export type Failure = { key: ErrorKey; pose: CatPose };

const BY_REASON: Record<string, ErrorKey> = {
  too_large: 'tooBig',
  quota_exceeded: 'boxFull',
  denied_extension: 'denied',
  executable_content: 'denied',
  rate_limited: 'rateLimited',
  invalid_url: 'invalidUrl',
  scheme_not_allowed: 'invalidUrl',
  port_not_allowed: 'invalidUrl',
  credentials_not_allowed: 'invalidUrl',
  blocked_address: 'blockedAddress',
  dns_failed: 'dnsFailed',
  too_many_redirects: 'tooManyRedirects',
  redirect_without_location: 'fetchFailed',
  fetch_failed: 'fetchFailed',
  remote_status: 'remoteStatus',
  timeout: 'timeout',
  not_found: 'notFound',
  expired: 'expired',
  wrong_token: 'wrongToken',
  wrong_password: 'wrongPassword',
  too_many_attempts: 'tooManyAttempts',
  locked: 'locked',
};

const BY_STATUS: Record<number, ErrorKey> = {
  403: 'wrongToken',
  404: 'notFound',
  408: 'timeout',
  410: 'expired',
  413: 'tooBig',
  415: 'denied',
  422: 'fetchFailed',
  429: 'rateLimited',
  507: 'boxFull',
};

const POSE: Partial<Record<ErrorKey, CatPose>> = {
  tooBig: 'too-big',
  boxFull: 'empty',
  offline: 'offline',
  notFound: 'not-found',
  expired: 'not-found',
};

function reasonOf(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const { reason } = body as Partial<ApiError>;
  return typeof reason === 'string' ? reason : undefined;
}

/**
 * What went wrong, in words the UI has, and the pose the cat takes for it.
 * `status` undefined means the request never got an answer.
 */
export function describeFailure(
  status: number | undefined,
  body: unknown,
  online = true,
): Failure {
  let key: ErrorKey;
  if (status === undefined || status === 0) {
    key = online ? 'network' : 'offline';
  } else {
    const reason = reasonOf(body);
    key =
      (reason && BY_REASON[reason]) ||
      BY_STATUS[status] ||
      (status === 400 ? 'invalidUrl' : 'unknown');
  }
  return { key, pose: POSE[key] ?? 'error' };
}
