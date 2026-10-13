import * as shared from '@filesdrop/shared';

/** What the API accepted before issue #20 added 72h. */
const FALLBACK_TTLS: readonly string[] = ['1h', '12h', '24h'];
const TTL_PATTERN = /^([1-9]\d{0,3})h$/;

/**
 * The lifetimes come from @filesdrop/shared at run time instead of being
 * written down here, so a new value there (72h, issue #20) becomes a button
 * without touching the bot. Anything unexpected falls back to the old list.
 */
export const readTtls = (source: unknown): string[] => {
  if (
    Array.isArray(source) &&
    source.length > 0 &&
    source.every((ttl) => typeof ttl === 'string' && TTL_PATTERN.test(ttl))
  ) {
    return [...(source as string[])].sort((a, b) => ttlHours(a) - ttlHours(b));
  }
  return [...FALLBACK_TTLS];
};

export const ttlHours = (ttl: string): number =>
  Number(TTL_PATTERN.exec(ttl)?.[1] ?? Number.NaN);

/** 72h → 3d; anything that is not whole days above one day stays in hours. */
export const ttlLabel = (ttl: string): string => {
  const hours = ttlHours(ttl);
  return hours > 24 && hours % 24 === 0 ? `${hours / 24}d` : ttl;
};

const exported = shared as unknown as Record<string, unknown>;

export const TTLS: readonly string[] = readTtls(exported.TTLS);

export const DEFAULT_TTL: string =
  typeof exported.DEFAULT_TTL === 'string' &&
  TTLS.includes(exported.DEFAULT_TTL)
    ? exported.DEFAULT_TTL
    : TTLS.includes('24h')
      ? '24h'
      : (TTLS[TTLS.length - 1] as string);

export const MAX_FILE_BYTES: number =
  typeof exported.MAX_FILE_BYTES === 'number'
    ? exported.MAX_FILE_BYTES
    : 95 * 1024 * 1024;
