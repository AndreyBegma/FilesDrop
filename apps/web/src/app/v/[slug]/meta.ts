import type { FileMeta } from '@filesdrop/shared';
import { cache } from 'react';

export type MetaLookup =
  | { status: 'ok'; meta: FileMeta }
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
    return { status: 'ok', meta: (await res.json()) as FileMeta };
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
