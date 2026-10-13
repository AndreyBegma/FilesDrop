import type { FileLookup, FileMeta } from '@filesdrop/shared';
import { cache } from 'react';

export type MetaLookup =
  | { status: 'ok'; meta: FileMeta }
  /** Password-protected: only the slug and expiry are known until unlocked. */
  | { status: 'locked'; slug: string; expiresAt: string }
  | { status: 'not-found' }
  | { status: 'expired' }
  | { status: 'unavailable' };

const SLUG = /^[A-Za-z0-9]{1,32}$/;

/**
 * `GET /api/files/:slug` from the server side (`API_INTERNAL_URL`), once
 * per request: `generateMetadata`, the page and the OG card share it.
 */
export const lookupFile = cache(async (slug: string): Promise<MetaLookup> => {
  if (!SLUG.test(slug)) return { status: 'not-found' };
  const base = (
    process.env.API_INTERNAL_URL ?? 'http://localhost:7347'
  ).replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/api/files/${slug}`, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    if (res.status === 404) return { status: 'not-found' };
    if (res.status === 410) return { status: 'expired' };
    if (!res.ok) return { status: 'unavailable' };
    const body = (await res.json()) as FileLookup;
    if (!('name' in body)) {
      return { status: 'locked', slug: body.slug, expiresAt: body.expiresAt };
    }
    return { status: 'ok', meta: body };
  } catch {
    return { status: 'unavailable' };
  }
});

export function webOrigin(): string {
  return (process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:4747').replace(
    /\/+$/,
    '',
  );
}
