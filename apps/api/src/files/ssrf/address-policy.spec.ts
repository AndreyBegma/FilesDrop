import {
  isPublicAddress,
  literalAddress,
  parseTargetUrl,
} from './address-policy';

describe('isPublicAddress', () => {
  it.each([
    '127.0.0.1',
    '127.255.255.254',
    '10.0.0.5',
    '172.16.0.1',
    '172.17.0.1', // default docker bridge
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '100.127.255.255',
    '0.0.0.0',
    '0.1.2.3',
    '224.0.0.1',
    '239.255.255.250',
    '255.255.255.255',
    '192.0.2.1',
    '198.18.0.1',
    '240.0.0.1',
    '::',
    '::1',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:10.0.0.5',
    '::ffff:192.168.1.1',
    '::ffff:169.254.169.254',
    '::127.0.0.1', // deprecated IPv4-compatible form
    '64:ff9b::7f00:1', // NAT64 of 127.0.0.1
    '2002:7f00:1::', // 6to4 of 127.0.0.1
    '2001:db8::1',
    'not-an-ip',
  ])('rejects %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each([
    '93.184.215.14',
    '1.1.1.1',
    '8.8.8.8',
    '::ffff:1.1.1.1',
    '2606:4700:4700::1111',
    '2a00:1450:4001::200e',
  ])('accepts %s', (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });
});

describe('parseTargetUrl', () => {
  it.each([
    ['http://0x7f000001/', 'blocked_address'],
    ['http://0x7f.0.0.1/', 'blocked_address'],
    ['http://017700000001/', 'blocked_address'],
    ['http://127.1/', 'blocked_address'],
    ['http://[0:0:0:0:0:ffff:7f00:1]/', 'blocked_address'],
    ['https://10.0.0.5:443/', 'blocked_address'],
    ['gopher://example.com/', 'scheme_not_allowed'],
    ['data:text/plain,hi', 'scheme_not_allowed'],
    ['http://example.com:22/', 'port_not_allowed'],
    ['https://example.com:8443/', 'port_not_allowed'],
    ['http://a@example.com/', 'credentials_not_allowed'],
    ['http://', 'invalid_url'],
  ])('refuses %s (%s)', (url, reason) => {
    expect(() => parseTargetUrl(url)).toThrow(
      expect.objectContaining({ reason }),
    );
  });

  it.each([
    'http://example.com/',
    'https://example.com/x',
    'http://example.com:80/',
    'https://example.com:443/',
    'http://example.com:443/',
    'https://1.1.1.1/',
  ])('allows %s', (url) => {
    expect(parseTargetUrl(url)).toBeInstanceOf(URL);
  });

  it('resolves a relative redirect against the previous URL', () => {
    expect(
      parseTargetUrl('/next', new URL('https://example.com/a/b')).href,
    ).toBe('https://example.com/next');
  });
});

describe('literalAddress', () => {
  it('returns IP literals and leaves hostnames to DNS', () => {
    expect(literalAddress('1.1.1.1')).toEqual({
      address: '1.1.1.1',
      family: 4,
    });
    expect(literalAddress('2606:4700::1111')).toEqual({
      address: '2606:4700::1111',
      family: 6,
    });
    expect(literalAddress('::ffff:1.1.1.1')).toEqual({
      address: '1.1.1.1',
      family: 4,
    });
    expect(literalAddress('example.com')).toBeNull();
  });
});
