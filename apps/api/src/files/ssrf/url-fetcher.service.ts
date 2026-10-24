import type { Readable } from 'node:stream';
import { Inject, Injectable } from '@nestjs/common';
import { apiError } from '../api-error';
import { FILES_CONFIG, type FilesConfig } from '../files.config';
import {
  BlockedTargetError,
  bareHost,
  isPublicAddress,
  literalAddress,
  parseTargetUrl,
  type ResolvedAddress,
} from './address-policy';
import {
  DNS_RESOLVER,
  type DnsResolver,
  PINNED_REQUEST,
  type PinnedRequest,
} from './pinned-request';

export type FetchedResource = {
  /** The URL that finally answered 2xx (after redirects). */
  url: URL;
  body: Readable;
  contentLength: number | null;
};

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const firstHeader = (
  value: string | string[] | undefined,
): string | undefined => (Array.isArray(value) ? value[0] : value);

/**
 * Opens a remote URL under Decision 8: http(s) on 80/443 only, every
 * resolved address public unicast, the connection pinned to the checked
 * address, and each redirect (at most `maxRedirects`) re-validated from
 * scratch. Body size and the overall timeout are the caller's job, since
 * they span the body stream.
 */
@Injectable()
export class UrlFetcher {
  constructor(
    @Inject(DNS_RESOLVER) private readonly resolveHost: DnsResolver,
    @Inject(PINNED_REQUEST) private readonly request: PinnedRequest,
    @Inject(FILES_CONFIG) private readonly config: FilesConfig,
  ) {}

  async open(rawUrl: string, signal: AbortSignal): Promise<FetchedResource> {
    let url = this.check(() => parseTargetUrl(rawUrl));
    for (let redirects = 0; ; redirects++) {
      const pin = await this.resolve(url, signal);
      const response = await this.request(url, pin, signal).catch(
        (error: unknown) => {
          if (signal.aborted) throw error;
          throw apiError(422, 'fetch_failed');
        },
      );

      if (REDIRECT_STATUSES.has(response.statusCode)) {
        response.body.destroy();
        const location = firstHeader(response.headers.location);
        if (!location) throw apiError(422, 'redirect_without_location');
        if (redirects >= this.config.maxRedirects) {
          throw apiError(400, 'too_many_redirects');
        }
        const from = url;
        url = this.check(() => parseTargetUrl(location, from));
        continue;
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.body.destroy();
        throw apiError(422, 'remote_status');
      }

      const length = Number(firstHeader(response.headers['content-length']));
      return {
        url,
        body: response.body,
        contentLength:
          Number.isSafeInteger(length) && length >= 0 ? length : null,
      };
    }
  }

  private check<T>(step: () => T): T {
    try {
      return step();
    } catch (error) {
      if (error instanceof BlockedTargetError) {
        throw apiError(400, error.reason);
      }
      throw error;
    }
  }

  /** Bound the request's wait for DNS; lookup itself may finish later. */
  private resolveBeforeAbort(
    host: string,
    signal: AbortSignal,
  ): Promise<ResolvedAddress[]> {
    return new Promise((resolve, reject) => {
      const onAbort = () => reject(signal.reason);
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
      Promise.resolve()
        .then(() => this.resolveHost(host))
        .then(
          (addresses) => {
            signal.removeEventListener('abort', onAbort);
            resolve(addresses);
          },
          (error: unknown) => {
            signal.removeEventListener('abort', onAbort);
            reject(error);
          },
        );
    });
  }

  /** Every address the host resolves to must be public; the first is pinned. */
  private async resolve(
    url: URL,
    signal: AbortSignal,
  ): Promise<ResolvedAddress> {
    signal.throwIfAborted();
    const host = bareHost(url);
    const literal = literalAddress(host);
    if (literal) {
      if (!isPublicAddress(literal.address)) {
        throw apiError(400, 'blocked_address');
      }
      return literal;
    }
    let addresses: ResolvedAddress[];
    try {
      addresses = await this.resolveBeforeAbort(host, signal);
    } catch (error) {
      if (signal.aborted) throw error;
      throw apiError(400, 'dns_failed');
    }
    if (addresses.length === 0) throw apiError(400, 'dns_failed');
    if (!addresses.every((entry) => isPublicAddress(entry.address))) {
      throw apiError(400, 'blocked_address');
    }
    return addresses[0];
  }
}
