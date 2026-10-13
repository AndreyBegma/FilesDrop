import type { Request } from 'express';
import {
  createFilesTestApp,
  type FilesTestApp,
  uploadForm,
} from './testing/files-test-app';
import { clientIp } from './upload-throttler.guard';

describe('upload rate limit', () => {
  let t: FilesTestApp;

  const upload = (headers: Record<string, string> = {}) =>
    fetch(`${t.baseUrl}/api/files`, {
      method: 'POST',
      headers,
      body: uploadForm(Buffer.from('hello'), 'hello.txt'),
    });

  afterEach(async () => {
    await t?.close();
  });

  it('answers 429 to the 31st upload from one IP within the window', async () => {
    t = await createFilesTestApp({
      config: { rateLimit: 30, rateWindowMs: 600_000 },
    });

    for (let i = 0; i < 30; i++) {
      expect((await upload()).status).toBe(201);
    }
    const res = await upload();
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      statusCode: 429,
      error: 'Too Many Requests',
      reason: 'rate_limited',
    });
    expect(t.repository.rows.size).toBe(30);
  });

  it('counts file and URL uploads against one shared budget', async () => {
    t = await createFilesTestApp({ config: { rateLimit: 2 } });

    expect((await upload()).status).toBe(201);
    expect((await upload()).status).toBe(201);
    const fromUrl = await fetch(`${t.baseUrl}/api/files/from-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://127.0.0.1/' }),
    });
    expect(fromUrl.status).toBe(429);
  });

  it('does not throttle reads', async () => {
    t = await createFilesTestApp({ config: { rateLimit: 1 } });
    for (let i = 0; i < 5; i++) {
      expect((await fetch(`${t.baseUrl}/api/files/Zzzzzzzz`)).status).toBe(404);
    }
  });

  it('with TRUST_CF_HEADER=true counts two CF-Connecting-IP values separately', async () => {
    t = await createFilesTestApp({
      config: { rateLimit: 30, trustCfHeader: true },
    });
    const a = { 'CF-Connecting-IP': '203.0.113.7' };
    const b = { 'CF-Connecting-IP': '198.51.100.9' };

    for (let i = 0; i < 30; i++) {
      expect((await upload(a)).status).toBe(201);
    }
    expect((await upload(a)).status).toBe(429);
    expect((await upload(b)).status).toBe(201);
  });

  it('with TRUST_CF_HEADER=false ignores CF-Connecting-IP', async () => {
    t = await createFilesTestApp({
      config: { rateLimit: 1, trustCfHeader: false },
    });

    expect((await upload({ 'CF-Connecting-IP': '203.0.113.7' })).status).toBe(
      201,
    );
    expect((await upload({ 'CF-Connecting-IP': '198.51.100.9' })).status).toBe(
      429,
    );
  });
});

describe('clientIp', () => {
  const req = (headers: Record<string, string>, ip = '10.1.2.3') =>
    ({ headers, ip, socket: { remoteAddress: ip } }) as unknown as Request;

  it('uses req.ip unless the CF header is trusted', () => {
    expect(clientIp(req({ 'cf-connecting-ip': '1.2.3.4' }), false)).toBe(
      '10.1.2.3',
    );
    expect(clientIp(req({ 'cf-connecting-ip': '1.2.3.4' }), true)).toBe(
      '1.2.3.4',
    );
  });

  it('falls back to req.ip when the trusted header is missing or not an IP', () => {
    expect(clientIp(req({}), true)).toBe('10.1.2.3');
    expect(clientIp(req({ 'cf-connecting-ip': 'evil' }), true)).toBe(
      '10.1.2.3',
    );
  });

  it('normalises IPv4-mapped IPv6 so both spellings share a bucket', () => {
    expect(clientIp(req({ 'cf-connecting-ip': '::ffff:1.2.3.4' }), true)).toBe(
      '1.2.3.4',
    );
  });
});
