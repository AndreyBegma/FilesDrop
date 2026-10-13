import type { ErrorKey } from './i18n';

/**
 * What a failed API call means for the person in the chat. `reason` is the
 * ApiError's machine-readable field; the status decides when it is absent.
 */
export const errorKeyFor = (status: number, reason?: string): ErrorKey => {
  if (status === 413 || reason === 'too_large') return 'too_large';
  if (
    status === 415 ||
    reason === 'denied_extension' ||
    reason === 'executable_content'
  ) {
    return 'unsupported';
  }
  if (status === 429 || reason === 'rate_limited') return 'rate_limited';
  if (status === 507 || reason === 'quota_exceeded') return 'quota';
  if (status === 404 || status === 410) return 'gone';
  return 'generic';
};
