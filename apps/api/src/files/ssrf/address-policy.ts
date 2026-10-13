import ipaddr from 'ipaddr.js';

export type ResolvedAddress = { address: string; family: 4 | 6 };

/** Thrown when a URL or an address it resolves to may not be fetched. */
export class BlockedTargetError extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

const GLOBAL_UNICAST_V6 = ipaddr.IPv6.parseCIDR('2000::/3');

/**
 * Decision 8: only public unicast addresses. ipaddr's `range()` names every
 * special block (loopback, private, link-local, CGNAT, multicast, 0/8,
 * unique-local, reserved, 6to4/Teredo/NAT64 …); anything but `unicast` is
 * refused. IPv4-mapped IPv6 is unwrapped first, so `::ffff:127.0.0.1` is
 * judged as `127.0.0.1`. IPv6 must also sit in global unicast `2000::/3`,
 * which rules out the deprecated IPv4-compatible `::a.b.c.d` form.
 */
export const isPublicAddress = (address: string): boolean => {
  if (!ipaddr.isValid(address)) return false;
  const parsed = ipaddr.process(address);
  if (parsed.range() !== 'unicast') return false;
  return parsed.kind() === 'ipv4' || parsed.match(GLOBAL_UNICAST_V6);
};

/** Hostname as WHATWG URL returns it, without IPv6 brackets. */
export const bareHost = (url: URL): string =>
  url.hostname.startsWith('[') ? url.hostname.slice(1, -1) : url.hostname;

/**
 * Parses and checks everything that does not need DNS: scheme, port,
 * credentials, and IP-literal hosts. WHATWG parsing already canonicalises
 * odd IPv4 spellings (`0x7f000001`, `2130706433`, `0177.1`) to dotted quads.
 */
export const parseTargetUrl = (raw: string, base?: URL): URL => {
  let url: URL;
  try {
    url = base ? new URL(raw, base) : new URL(raw);
  } catch {
    throw new BlockedTargetError('invalid_url');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BlockedTargetError('scheme_not_allowed');
  }
  // `url.port` is "" for the scheme default (80 / 443).
  if (url.port !== '' && url.port !== '80' && url.port !== '443') {
    throw new BlockedTargetError('port_not_allowed');
  }
  if (url.username !== '' || url.password !== '') {
    throw new BlockedTargetError('credentials_not_allowed');
  }
  const host = bareHost(url);
  if (host === '') throw new BlockedTargetError('invalid_url');
  if (ipaddr.isValid(host) && !isPublicAddress(host)) {
    throw new BlockedTargetError('blocked_address');
  }
  return url;
};

/** IP literal → itself; otherwise `null` (needs DNS). */
export const literalAddress = (host: string): ResolvedAddress | null => {
  if (!ipaddr.isValid(host)) return null;
  const parsed = ipaddr.process(host);
  return {
    address: parsed.toString(),
    family: parsed.kind() === 'ipv6' ? 6 : 4,
  };
};
