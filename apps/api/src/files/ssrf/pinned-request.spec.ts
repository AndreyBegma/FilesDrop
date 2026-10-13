import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { text } from 'node:stream/consumers';
import { pinnedLookup, undiciPinnedRequest } from './pinned-request';

describe('undiciPinnedRequest', () => {
  let server: Server;
  let port: number;
  const seenHosts: string[] = [];

  beforeAll(async () => {
    server = createServer((req, res) => {
      seenHosts.push(req.headers.host ?? '');
      res.end(`hello from ${req.url}`);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('connects to the pinned address and never resolves the hostname itself', async () => {
    // `.invalid` can never resolve (RFC 6761): reaching the server proves the pin.
    const url = new URL(`http://pinned.invalid:${port}/cat?x=1`);
    const response = await undiciPinnedRequest(
      url,
      { address: '127.0.0.1', family: 4 },
      new AbortController().signal,
    );

    expect(response.statusCode).toBe(200);
    expect(await text(response.body)).toBe('hello from /cat?x=1');
    expect(seenHosts).toContain(`pinned.invalid:${port}`);
  });

  it('honours the abort signal', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      undiciPinnedRequest(
        new URL(`http://pinned.invalid:${port}/`),
        { address: '127.0.0.1', family: 4 },
        controller.signal,
      ),
    ).rejects.toThrow();
  });
});

describe('pinnedLookup', () => {
  const pin = { address: '93.184.215.14', family: 4 as const };

  it('answers the pinned address in single form', (done) => {
    pinnedLookup(pin)('evil.example', {}, (error, address, family) => {
      expect(error).toBeNull();
      expect(address).toBe('93.184.215.14');
      expect(family).toBe(4);
      done();
    });
  });

  it('answers the pinned address in `all` form', (done) => {
    pinnedLookup(pin)('evil.example', { all: true }, (error, addresses) => {
      expect(error).toBeNull();
      expect(addresses).toEqual([{ address: '93.184.215.14', family: 4 }]);
      done();
    });
  });
});
