import type { Request } from 'express';
import {
  createFilesTestApp,
  type FilesTestApp,
  uploadForm,
} from './testing/files-test-app';
import { botTracker, clientIp, uploadTracker } from './upload-throttler.guard';

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

describe('upload rate limit for the Telegram bot', () => {
  const KEY = 'k'.repeat(64);
  let t: FilesTestApp;
  let savedKey: string | undefined;

  const upload = (headers: Record<string, string> = {}) =>
    fetch(`${t.baseUrl}/api/files`, {
      method: 'POST',
      headers,
      body: uploadForm(Buffer.from('hello'), 'hello.txt'),
    });

  const bot = (user: string, key = KEY) => ({
    'X-Bot-Key': key,
    'X-Bot-User': user,
  });

  beforeEach(() => {
    savedKey = process.env.BOT_API_KEY;
  });

  afterEach(async () => {
    if (savedKey === undefined) delete process.env.BOT_API_KEY;
    else process.env.BOT_API_KEY = savedKey;
    await t?.close();
  });

  const start = async (key: string | undefined, rateLimit: number) => {
    if (key === undefined) delete process.env.BOT_API_KEY;
    else process.env.BOT_API_KEY = key;
    t = await createFilesTestApp({ config: { rateLimit } });
  };

  it('with the right key gives every Telegram user a budget of their own', async () => {
    await start(KEY, 2);

    expect((await upload(bot('111'))).status).toBe(201);
    expect((await upload(bot('111'))).status).toBe(201);
    expect((await upload(bot('111'))).status).toBe(429);
    expect((await upload(bot('222'))).status).toBe(201);
    // The bot's own IP is untouched by its users' uploads.
    expect((await upload()).status).toBe(201);
  });

  it('with a wrong key ignores X-Bot-User and counts the IP', async () => {
    await start(KEY, 1);

    expect((await upload(bot('111', 'wrong'))).status).toBe(201);
    expect((await upload(bot('222', 'wrong'))).status).toBe(429);
    expect((await upload()).status).toBe(429);
  });

  it('without a key ignores X-Bot-User and counts the IP', async () => {
    await start(KEY, 1);

    expect((await upload({ 'X-Bot-User': '111' })).status).toBe(201);
    expect((await upload({ 'X-Bot-User': '222' })).status).toBe(429);
  });

  it('with BOT_API_KEY unset the feature is off, whatever the headers say', async () => {
    await start(undefined, 1);

    expect((await upload(bot('111', ''))).status).toBe(201);
    expect((await upload(bot('222', ''))).status).toBe(429);
  });
});

describe('uploadTracker', () => {
  const KEY = 'secret-key';
  const req = (headers: Record<string, string>, ip = '10.1.2.3') =>
    ({ headers, ip, socket: { remoteAddress: ip } }) as unknown as Request;

  it('is tg:<id> for the right key and a numeric user id', () => {
    expect(
      uploadTracker(
        req({ 'x-bot-key': KEY, 'x-bot-user': '123456789' }),
        false,
        KEY,
      ),
    ).toBe('tg:123456789');
    expect(botTracker(req({ 'x-bot-key': KEY, 'x-bot-user': '42' }), KEY)).toBe(
      'tg:42',
    );
  });

  it('is the IP for a wrong, missing or differently-sized key', () => {
    for (const key of ['secret-kez', 'secret', 'secret-key-longer', '']) {
      expect(
        uploadTracker(
          req({ 'x-bot-key': key, 'x-bot-user': '42' }),
          false,
          KEY,
        ),
      ).toBe('10.1.2.3');
    }
    expect(uploadTracker(req({ 'x-bot-user': '42' }), false, KEY)).toBe(
      '10.1.2.3',
    );
  });

  it('is the IP when BOT_API_KEY is unset', () => {
    expect(
      uploadTracker(
        req({ 'x-bot-key': KEY, 'x-bot-user': '42' }),
        false,
        undefined,
      ),
    ).toBe('10.1.2.3');
  });

  it('is the IP when the user id is missing or not a Telegram id', () => {
    for (const user of ['', 'abc', '-5', '0', '1.5', '12 34', '1'.repeat(21)]) {
      expect(
        uploadTracker(
          req({ 'x-bot-key': KEY, 'x-bot-user': user }),
          false,
          KEY,
        ),
      ).toBe('10.1.2.3');
    }
    expect(uploadTracker(req({ 'x-bot-key': KEY }), false, KEY)).toBe(
      '10.1.2.3',
    );
  });

  it('falls back to the trusted CF header like any other client', () => {
    expect(
      uploadTracker(
        req({
          'cf-connecting-ip': '203.0.113.7',
          'x-bot-key': 'wrong',
          'x-bot-user': '42',
        }),
        true,
        KEY,
      ),
    ).toBe('203.0.113.7');
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
