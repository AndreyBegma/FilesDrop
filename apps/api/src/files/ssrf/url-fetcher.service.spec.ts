import { Readable } from 'node:stream';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { MAX_FILE_BYTES, type UploadResult } from '@filesdrop/shared';
import type { FilesConfig } from '../files.config';
import {
  createFilesTestApp,
  type FilesTestApp,
  pngBytes,
} from '../testing/files-test-app';
import type { ResolvedAddress } from './address-policy';
import type {
  DnsResolver,
  PinnedRequest,
  PinnedResponse,
} from './pinned-request';
import { UrlFetcher } from './url-fetcher.service';

const PUBLIC_V4: ResolvedAddress = { address: '93.184.215.14', family: 4 };

const respond = (
  statusCode: number,
  body: Readable | Buffer = Buffer.alloc(0),
  headers: PinnedResponse['headers'] = {},
): PinnedResponse => ({
  statusCode,
  headers,
  body: Buffer.isBuffer(body) ? Readable.from([body]) : body,
});

/** Emits `total` zero bytes in 1 MB chunks, never announcing a length. */
const endless = (total: number): Readable => {
  const chunk = Buffer.alloc(1024 * 1024);
  let sent = 0;
  return new Readable({
    read() {
      if (sent >= total) {
        this.push(null);
        return;
      }
      sent += chunk.length;
      this.push(chunk);
    },
  });
};

describe('POST /api/files/from-url', () => {
  let t: FilesTestApp;
  let resolver: jest.MockedFunction<DnsResolver>;
  let request: jest.MockedFunction<PinnedRequest>;

  const fromUrl = (url: string, ttl?: string) =>
    fetch(`${t.baseUrl}/api/files/from-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ttl ? { url, ttl } : { url }),
    });

  beforeEach(async () => {
    resolver = jest.fn<ReturnType<DnsResolver>, Parameters<DnsResolver>>();
    request = jest.fn<ReturnType<PinnedRequest>, Parameters<PinnedRequest>>();
    t = await createFilesTestApp({ resolver, pinnedRequest: request });
  });

  afterEach(async () => {
    await t.close();
  });

  it.each([
    ['http://127.0.0.1/', 'blocked_address'],
    ['http://10.0.0.5/', 'blocked_address'],
    ['http://[::1]/', 'blocked_address'],
    ['http://169.254.169.254/', 'blocked_address'],
    ['http://0x7f000001/', 'blocked_address'],
    ['http://2130706433/', 'blocked_address'],
    ['http://0177.0.0.1/', 'blocked_address'],
    ['http://[::ffff:127.0.0.1]/', 'blocked_address'],
    ['http://[::ffff:a00:5]/', 'blocked_address'],
    ['http://0.0.0.0/', 'blocked_address'],
    ['http://100.64.0.1/', 'blocked_address'],
    ['http://172.17.0.1/', 'blocked_address'],
    ['http://[fd00::1]/', 'blocked_address'],
    ['http://[fe80::1]/', 'blocked_address'],
    ['http://224.0.0.1/', 'blocked_address'],
    ['ftp://example.com/file.png', 'scheme_not_allowed'],
    ['file:///etc/passwd', 'scheme_not_allowed'],
    ['http://example.com:8080/', 'port_not_allowed'],
    ['http://user:pass@example.com/', 'credentials_not_allowed'],
    ['not a url', 'invalid_url'],
  ])('rejects %s with 400 (%s) and makes no outbound connection', async (url, reason) => {
    const res = await fromUrl(url);

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ statusCode: 400, reason });
    expect(request).not.toHaveBeenCalled();
  });

  it('rejects a hostname resolving to 192.168.1.1 with 400 and no connection', async () => {
    resolver.mockResolvedValue([{ address: '192.168.1.1', family: 4 }]);

    const res = await fromUrl('http://intranet.example/');

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ reason: 'blocked_address' });
    expect(resolver).toHaveBeenCalledWith('intranet.example');
    expect(request).not.toHaveBeenCalled();
  });

  it('rejects a hostname when any one of its addresses is private', async () => {
    resolver.mockResolvedValue([
      PUBLIC_V4,
      { address: '::ffff:10.0.0.1', family: 6 },
    ]);

    const res = await fromUrl('https://mixed.example/');

    expect(res.status).toBe(400);
    expect(request).not.toHaveBeenCalled();
  });

  it('answers 400 dns_failed when the host does not resolve', async () => {
    resolver.mockRejectedValue(
      Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }),
    );

    const res = await fromUrl('https://nowhere.example/');

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ reason: 'dns_failed' });
    expect(request).not.toHaveBeenCalled();
  });

  it('fetches a public URL through the address it checked and stores it', async () => {
    resolver.mockResolvedValue([PUBLIC_V4]);
    const bytes = pngBytes(2048);
    request.mockResolvedValue(
      respond(200, bytes, { 'content-length': '2048' }),
    );

    const res = await fromUrl('https://images.example/cats/tom.png?x=1', '12h');

    expect(res.status).toBe(201);
    const body = (await res.json()) as UploadResult;
    expect(body).toMatchObject({
      name: 'tom.png',
      ext: 'png',
      mime: 'image/png',
      size: 2048,
      inline: true,
    });
    expect(request).toHaveBeenCalledTimes(1);
    const [url, pin] = request.mock.calls[0];
    expect(url.href).toBe('https://images.example/cats/tom.png?x=1');
    expect(pin).toEqual(PUBLIC_V4);
    expect(t.repository.rows.get(body.slug)).toMatchObject({
      source: 'URL',
      sourceUrl: 'https://images.example/cats/tom.png?x=1',
    });

    const raw = await fetch(`${t.baseUrl}/f/${body.slug}.png`);
    expect(Buffer.from(await raw.arrayBuffer()).equals(bytes)).toBe(true);
  });

  it('rejects a public URL that redirects to http://127.0.0.1/ at the redirect', async () => {
    resolver.mockResolvedValue([PUBLIC_V4]);
    request.mockResolvedValueOnce(
      respond(302, Buffer.alloc(0), { location: 'http://127.0.0.1/' }),
    );

    const res = await fromUrl('https://public.example/go');

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ reason: 'blocked_address' });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][1]).toEqual(PUBLIC_V4);
  });

  it('re-resolves and re-checks a redirect to another hostname', async () => {
    resolver.mockImplementation(async (host) =>
      host === 'public.example'
        ? [PUBLIC_V4]
        : [{ address: '10.9.8.7', family: 4 }],
    );
    request.mockResolvedValueOnce(
      respond(301, Buffer.alloc(0), { location: '//internal.example/' }),
    );

    const res = await fromUrl('https://public.example/');

    expect(res.status).toBe(400);
    expect(resolver).toHaveBeenCalledWith('internal.example');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('follows up to 3 redirects and refuses the 4th', async () => {
    resolver.mockResolvedValue([PUBLIC_V4]);
    request.mockImplementation(async (url) =>
      respond(302, Buffer.alloc(0), { location: `${url.pathname}x` }),
    );

    const res = await fromUrl('https://loop.example/r');

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ reason: 'too_many_redirects' });
    expect(request).toHaveBeenCalledTimes(4);
  });

  it('stores the target of 3 redirects', async () => {
    resolver.mockResolvedValue([PUBLIC_V4]);
    request
      .mockResolvedValueOnce(respond(301, Buffer.alloc(0), { location: '/a' }))
      .mockResolvedValueOnce(respond(302, Buffer.alloc(0), { location: '/b' }))
      .mockResolvedValueOnce(
        respond(307, Buffer.alloc(0), { location: '/final.txt' }),
      )
      .mockResolvedValueOnce(respond(200, Buffer.from('meow')));

    const res = await fromUrl('https://hops.example/start');

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ name: 'final.txt', size: 4 });
  });

  it('answers 422 when the remote answers non-2xx', async () => {
    resolver.mockResolvedValue([PUBLIC_V4]);
    request.mockResolvedValue(respond(404, Buffer.from('nope')));

    const res = await fromUrl('https://public.example/missing.png');

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ reason: 'remote_status' });
  });

  it('aborts a body that streams past 95 MB without Content-Length with 413', async () => {
    resolver.mockResolvedValue([PUBLIC_V4]);
    const body = endless(MAX_FILE_BYTES + 5 * 1024 * 1024);
    request.mockResolvedValue(respond(200, body));

    const res = await fromUrl('https://huge.example/blob');

    expect(res.status).toBe(413);
    expect(body.destroyed).toBe(true);
    expect(t.repository.rows.size).toBe(0);
    expect(await t.tmpEntries()).toEqual([]);
    expect(await t.storedEntries()).toEqual([]);
  }, 60_000);

  it('aborts past 95 MB even when Content-Length lies', async () => {
    resolver.mockResolvedValue([PUBLIC_V4]);
    request.mockResolvedValue(
      respond(200, endless(MAX_FILE_BYTES + 1024 * 1024), {
        'content-length': '10',
      }),
    );

    const res = await fromUrl('https://liar.example/blob');

    expect(res.status).toBe(413);
    expect(await t.tmpEntries()).toEqual([]);
  }, 60_000);

  it('refuses up front when Content-Length is over 95 MB', async () => {
    resolver.mockResolvedValue([PUBLIC_V4]);
    const body = endless(1024);
    request.mockResolvedValue(
      respond(200, body, { 'content-length': String(MAX_FILE_BYTES + 1) }),
    );

    const res = await fromUrl('https://big.example/blob');

    expect(res.status).toBe(413);
    expect(body.destroyed).toBe(true);
  });

  it('applies the executable denylist to fetched files', async () => {
    resolver.mockResolvedValue([PUBLIC_V4]);
    request.mockResolvedValueOnce(respond(200, Buffer.from('MZ\x90\x00')));

    const res = await fromUrl('https://public.example/setup.png');

    expect(res.status).toBe(415);
    expect(await t.tmpEntries()).toEqual([]);
  });

  it('applies the extension denylist to fetched files', async () => {
    resolver.mockResolvedValue([PUBLIC_V4]);
    request.mockResolvedValueOnce(respond(200, Buffer.from('alert(1)')));

    const res = await fromUrl('https://public.example/app.js');

    expect(res.status).toBe(415);
  });

  it('rejects a bad ttl with 400 before any lookup', async () => {
    const res = await fromUrl('https://public.example/a.png', '7d');

    expect(res.status).toBe(400);
    expect(resolver).not.toHaveBeenCalled();
  });
});

describe('POST /api/files/from-url limits', () => {
  let t: FilesTestApp;

  afterEach(async () => {
    await t.close();
  });

  it('applies the quota (507)', async () => {
    const request = jest.fn<
      ReturnType<PinnedRequest>,
      Parameters<PinnedRequest>
    >(async () => respond(200, Buffer.alloc(2048)));
    t = await createFilesTestApp({
      config: { maxTotalBytes: 1024 },
      resolver: async () => [PUBLIC_V4],
      pinnedRequest: request,
    });

    const res = await fetch(`${t.baseUrl}/api/files/from-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://public.example/a.bin' }),
    });

    expect(res.status).toBe(507);
    expect(await t.tmpEntries()).toEqual([]);
  });

  it('answers 408 when the whole fetch exceeds the timeout', async () => {
    const stalled = new Readable({ read() {} });
    t = await createFilesTestApp({
      config: { fetchTimeoutMs: 200 },
      resolver: async () => [PUBLIC_V4],
      pinnedRequest: async () => respond(200, stalled),
    });

    const res = await fetch(`${t.baseUrl}/api/files/from-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://slow.example/a.bin' }),
    });

    expect(res.status).toBe(408);
    expect(await res.json()).toMatchObject({ reason: 'timeout' });
    expect(await t.tmpEntries()).toEqual([]);
  });

  it('answers 408 while DNS is still pending', async () => {
    let finishDns!: (addresses: ResolvedAddress[]) => void;
    const dns = new Promise<ResolvedAddress[]>((resolve) => {
      finishDns = resolve;
    });
    const request = jest.fn<
      ReturnType<PinnedRequest>,
      Parameters<PinnedRequest>
    >(async () => respond(200));
    t = await createFilesTestApp({
      config: { fetchTimeoutMs: 200 },
      resolver: () => dns,
      pinnedRequest: request,
    });

    try {
      const res = await fetch(`${t.baseUrl}/api/files/from-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://slow-dns.example/a.bin' }),
        signal: AbortSignal.timeout(2000),
      });

      expect(res.status).toBe(408);
      expect(await res.json()).toMatchObject({ reason: 'timeout' });
      expect(request).not.toHaveBeenCalled();
      expect(t.repository.rows.size).toBe(0);
      expect(await t.tmpEntries()).toEqual([]);
    } finally {
      finishDns([PUBLIC_V4]);
    }
  });
});

describe('UrlFetcher DNS cancellation', () => {
  const config: FilesConfig = {
    uploadDir: '/unused',
    maxTotalBytes: MAX_FILE_BYTES,
    rateLimit: 1000,
    rateWindowMs: 600_000,
    trustCfHeader: false,
    fetchTimeoutMs: 30_000,
    maxRedirects: 3,
  };

  it.each([
    'resolve',
    'reject',
  ] as const)('stops waiting on abort and handles a late DNS %s', async (lateResult) => {
    let finishDns!: (addresses: ResolvedAddress[]) => void;
    let failDns!: (error: Error) => void;
    let started!: () => void;
    const dnsStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const dns = new Promise<ResolvedAddress[]>((resolve, reject) => {
      finishDns = resolve;
      failDns = reject;
    });
    const resolver: DnsResolver = () => {
      started();
      return dns;
    };
    const request = jest.fn<
      ReturnType<PinnedRequest>,
      Parameters<PinnedRequest>
    >(async () => respond(200));
    const controller = new AbortController();
    const settled = jest.fn();
    const pending = new UrlFetcher(resolver, request, config)
      .open('https://slow-dns.example/', controller.signal)
      .then(settled, settled);

    await dnsStarted;
    controller.abort();
    try {
      await nextTurn();
      expect(settled).toHaveBeenCalledWith(controller.signal.reason);
      expect(request).not.toHaveBeenCalled();
    } finally {
      if (lateResult === 'resolve') finishDns([PUBLIC_V4]);
      else failDns(new Error('late ENOTFOUND'));
      await pending;
      await nextTurn();
    }
    expect(settled).toHaveBeenCalledTimes(1);
    expect(request).not.toHaveBeenCalled();
  });

  it('does not start DNS or HTTP for an already aborted request', async () => {
    const resolver = jest.fn<ReturnType<DnsResolver>, Parameters<DnsResolver>>(
      async () => [PUBLIC_V4],
    );
    const request = jest.fn<
      ReturnType<PinnedRequest>,
      Parameters<PinnedRequest>
    >(async () => respond(200));
    const controller = new AbortController();
    controller.abort();

    await expect(
      new UrlFetcher(resolver, request, config).open(
        'https://public.example/',
        controller.signal,
      ),
    ).rejects.toBe(controller.signal.reason);
    expect(resolver).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });
});
