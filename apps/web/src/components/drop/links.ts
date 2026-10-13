import type { FileMeta } from '@filesdrop/shared';

/** Where the browser uploads to (Decision 2: straight to the API host). */
export function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7347').replace(
    /\/+$/,
    '',
  );
}

/** Public origin links are built on; the page's own origin as a fallback. */
export function webBase(): string {
  const configured = process.env.NEXT_PUBLIC_WEB_URL;
  if (configured) return configured.replace(/\/+$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:4747';
}

type Linkable = Pick<FileMeta, 'slug' | 'ext'>;

/** `/f/<slug>.<ext>` — the extension is cosmetic, but it helps a recipient. */
export function rawPath({ slug, ext }: Linkable): string {
  return `/f/${slug}${ext ? `.${ext}` : ''}`;
}

export function previewPath({ slug }: Pick<FileMeta, 'slug'>): string {
  return `/v/${slug}`;
}

export const rawLink = (file: Linkable) => `${webBase()}${rawPath(file)}`;
export const previewLink = (file: Pick<FileMeta, 'slug'>) =>
  `${webBase()}${previewPath(file)}`;

export type LinkMode = 'direct' | 'preview';

export const linkFor = (file: Linkable, mode: LinkMode) =>
  mode === 'direct' ? rawLink(file) : previewLink(file);

/** `/f/` for a locked file, carrying the access token from `unlock`. */
export function withAccess(path: string, token: string): string {
  return `${path}?k=${encodeURIComponent(token)}`;
}

/**
 * Images the browser can show as a thumbnail (`/f/` serves them inline). A
 * locked file never is: without a token `/f/` only sends you to its lock.
 */
export function isThumbnailable(
  file: Pick<FileMeta, 'mime' | 'inline'> & { locked?: boolean },
) {
  return (
    !file.locked &&
    file.inline &&
    file.mime.startsWith('image/') &&
    file.mime !== 'image/svg+xml'
  );
}
