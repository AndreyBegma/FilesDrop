import { lookup } from 'node:dns/promises';
import type { LookupFunction } from 'node:net';
import type { Readable } from 'node:stream';
import { Agent } from 'undici';
import type { ResolvedAddress } from './address-policy';

export const DNS_RESOLVER = Symbol('DNS_RESOLVER');
export const PINNED_REQUEST = Symbol('PINNED_REQUEST');

/** Resolves a hostname to every address it has. */
export type DnsResolver = (hostname: string) => Promise<ResolvedAddress[]>;

export type PinnedResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: Readable;
};

/** One GET to `url`, connecting only to `pin` (never resolving the host again). */
export type PinnedRequest = (
  url: URL,
  pin: ResolvedAddress,
  signal: AbortSignal,
) => Promise<PinnedResponse>;

export const systemDnsResolver: DnsResolver = async (hostname) => {
  const addresses = await lookup(hostname, { all: true, order: 'verbatim' });
  return addresses.map(({ address, family }) => ({
    address,
    family: family === 6 ? 6 : 4,
  }));
};

/**
 * A `net`/`tls` lookup that ignores the hostname and always answers with the
 * address that was already checked, so DNS rebinding between the check and
 * the connect cannot swap the target.
 */
export const pinnedLookup =
  (pin: ResolvedAddress): LookupFunction =>
  (_hostname, options, callback) => {
    if (options.all) {
      callback(null, [{ address: pin.address, family: pin.family }]);
    } else {
      callback(null, pin.address, pin.family);
    }
  };

export const undiciPinnedRequest: PinnedRequest = async (url, pin, signal) => {
  const agent = new Agent({
    connect: { lookup: pinnedLookup(pin) },
    connections: 1,
  });
  try {
    const response = await agent.request({
      origin: url.origin,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      signal,
      headers: {
        'user-agent': 'FilesDrop/1.0 (+https://filesdrop.luna-realm.com)',
        accept: '*/*',
        'accept-encoding': 'identity',
      },
    });
    response.body.once('close', () => {
      void agent.destroy();
    });
    return {
      statusCode: response.statusCode,
      headers: response.headers,
      body: response.body,
    };
  } catch (error) {
    await agent.destroy();
    throw error;
  }
};
