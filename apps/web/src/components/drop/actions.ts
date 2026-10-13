'use client';

import { describeFailure, type Failure } from './errors';
import { apiBase } from './links';

/** Copies text, with the old `execCommand` path for insecure origins. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the textarea.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * `DELETE /api/files/:slug` with the entry's token. A file that is already
 * gone (404/410) counts as deleted: the history entry should go either way.
 */
export async function deleteRemote(
  slug: string,
  token: string,
): Promise<{ ok: true } | { ok: false; failure: Failure }> {
  try {
    const res = await fetch(
      `${apiBase()}/api/files/${encodeURIComponent(slug)}`,
      { method: 'DELETE', headers: { 'X-Delete-Token': token } },
    );
    if (res.ok || res.status === 404 || res.status === 410) return { ok: true };
    const body: unknown = await res.json().catch(() => undefined);
    return { ok: false, failure: describeFailure(res.status, body) };
  } catch {
    return {
      ok: false,
      failure: describeFailure(undefined, undefined, navigator.onLine),
    };
  }
}
