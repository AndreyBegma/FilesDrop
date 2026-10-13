import { Injectable } from '@nestjs/common';

export type UnlockLimits = {
  /** Wrong passwords per slug + client IP per window. */
  perClient: number;
  /** Wrong passwords per slug from everyone, per window. */
  perSlug: number;
  windowMs: number;
};

export const DEFAULT_UNLOCK_LIMITS: UnlockLimits = {
  perClient: 10,
  perSlug: 50,
  windowMs: 15 * 60 * 1000,
};

/** Above this many tracked keys, stale ones are swept on the next write. */
const SWEEP_AT = 10_000;

/**
 * Counts wrong unlock attempts in memory only (nothing is written to disk or
 * the database). An attempt is reserved before the password is checked, so
 * parallel guesses can't slip past the limit, and released if it was right.
 */
@Injectable()
export class UnlockLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly limits: UnlockLimits = DEFAULT_UNLOCK_LIMITS;

  /**
   * Reserves one attempt for `slug` from `client`. Returns a release function
   * (call it when the password was right), or `null` when the limit is hit.
   */
  reserve(slug: string, client: string, now = Date.now()): (() => void) | null {
    const clientKey = `c:${slug}:${client}`;
    const slugKey = `s:${slug}`;
    const clientHits = this.live(clientKey, now);
    const slugHits = this.live(slugKey, now);
    if (
      clientHits.length >= this.limits.perClient ||
      slugHits.length >= this.limits.perSlug
    ) {
      return null;
    }
    if (this.hits.size > SWEEP_AT) this.sweep(now);
    clientHits.push(now);
    slugHits.push(now);
    this.hits.set(clientKey, clientHits);
    this.hits.set(slugKey, slugHits);
    return () => {
      this.drop(clientKey, now);
      this.drop(slugKey, now);
    };
  }

  private live(key: string, now: number): number[] {
    const since = now - this.limits.windowMs;
    return (this.hits.get(key) ?? []).filter((t) => t > since);
  }

  private drop(key: string, stamp: number): void {
    const list = this.hits.get(key);
    if (!list) return;
    const at = list.lastIndexOf(stamp);
    if (at >= 0) list.splice(at, 1);
    if (list.length === 0) this.hits.delete(key);
  }

  private sweep(now: number): void {
    for (const key of [...this.hits.keys()]) {
      const live = this.live(key, now);
      if (live.length === 0) this.hits.delete(key);
      else this.hits.set(key, live);
    }
  }
}
