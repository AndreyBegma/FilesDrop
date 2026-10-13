import type { FileLookup, UnlockResult, UploadResult } from '@filesdrop/shared';
import {
  createFilesTestApp,
  type FilesTestApp,
  pngBytes,
  uploadForm,
} from './testing/files-test-app';

const PASSWORD = 'whiskers-42';

/** Only Date is faked: the HTTP stack keeps its real timers. */
const fakeDateOnly = () =>
  jest.useFakeTimers({
    doNotFake: [
      'hrtime',
      'nextTick',
      'performance',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
    ],
  });

describe('Password-locked files', () => {
  let t: FilesTestApp;

  const uploadLocked = async (password = PASSWORD, name = 'secret.png') => {
    const res = await fetch(`${t.baseUrl}/api/files`, {
      method: 'POST',
      body: uploadForm(pngBytes(), name, '72h', password),
    });
    expect(res.status).toBe(201);
    return (await res.json()) as UploadResult;
  };

  const unlock = (slug: string, password: string, ip?: string) =>
    fetch(`${t.baseUrl}/api/files/${slug}/unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ip ? { 'CF-Connecting-IP': ip } : {}),
      },
      body: JSON.stringify({ password }),
    });

  const unlockOk = async (slug: string, password = PASSWORD) => {
    const res = await unlock(slug, password);
    expect(res.status).toBe(200);
    return (await res.json()) as UnlockResult;
  };

  beforeEach(async () => {
    t = await createFilesTestApp({ config: { trustCfHeader: true } });
  });

  afterEach(async () => {
    jest.useRealTimers();
    await t?.close();
  });

  it('accepts a 72h ttl', async () => {
    const up = await uploadLocked();
    expect(Date.parse(up.expiresAt) - Date.parse(up.createdAt)).toBe(
      259_200_000,
    );
  });

  it('stores only an scrypt hash and reports the file as locked', async () => {
    const up = await uploadLocked();
    expect(up.locked).toBe(true);
    expect(up.name).toBe('secret.png');
    const row = t.repository.rows.get(up.slug);
    expect(row?.passwordHash).toMatch(/^scrypt\$/);
    expect(row?.passwordHash).not.toContain(PASSWORD);
  });

  it('an upload without a password is not locked', async () => {
    const res = await fetch(`${t.baseUrl}/api/files`, {
      method: 'POST',
      body: uploadForm(pngBytes(), 'open.png'),
    });
    const up = (await res.json()) as UploadResult;
    expect(up.locked).toBe(false);
    expect(t.repository.rows.get(up.slug)?.passwordHash).toBeNull();
  });

  it.each([
    ['too short', 'abc'],
    ['too long', 'x'.repeat(129)],
  ])('rejects a password that is %s with 400 and leaves no tmp file', async (_label, password) => {
    const res = await fetch(`${t.baseUrl}/api/files`, {
      method: 'POST',
      body: uploadForm(pngBytes(), 'a.png', '1h', password),
    });
    expect(res.status).toBe(400);
    expect(t.repository.rows.size).toBe(0);
    expect(await t.tmpEntries()).toEqual([]);

    // from-url validates the same field before any fetch happens.
    const fromUrl = await fetch(`${t.baseUrl}/api/files/from-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/a.png', password }),
    });
    expect(fromUrl.status).toBe(400);
  });

  it('locked meta hides the name, size and type', async () => {
    const up = await uploadLocked();
    const res = await fetch(`${t.baseUrl}/api/files/${up.slug}`);
    expect(res.status).toBe(200);
    const meta = (await res.json()) as FileLookup;
    expect(meta).toEqual({
      slug: up.slug,
      locked: true,
      expiresAt: up.expiresAt,
    });
  });

  it('wrong password → 403 wrong_password', async () => {
    const up = await uploadLocked();
    const res = await unlock(up.slug, 'not-it');
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      statusCode: 403,
      error: 'Forbidden',
      reason: 'wrong_password',
    });
  });

  it('right password → a token and the full meta', async () => {
    const up = await uploadLocked();
    const body = await unlockOk(up.slug);
    const { deleteToken: _d, ...meta } = up;
    expect(body).toMatchObject(meta);
    expect(body.expiresInSec).toBe(600);
    expect(body.token).toMatch(new RegExp(`^${up.slug}\\.\\d+\\.[\\w-]{43}$`));
  });

  it('unlock on a file without a password → 409 not_locked', async () => {
    const res = await fetch(`${t.baseUrl}/api/files`, {
      method: 'POST',
      body: uploadForm(pngBytes(), 'open.png'),
    });
    const up = (await res.json()) as UploadResult;
    const out = await unlock(up.slug, 'whatever');
    expect(out.status).toBe(409);
    expect(await out.json()).toMatchObject({ reason: 'not_locked' });
  });

  it('raw download: 401 locked without a token, 200 with ?k= or X-File-Access', async () => {
    const up = await uploadLocked();
    const raw = `${t.baseUrl}/f/${up.slug}.png`;

    const bare = await fetch(raw);
    expect(bare.status).toBe(401);
    expect(await bare.json()).toEqual({
      statusCode: 401,
      error: 'Unauthorized',
      reason: 'locked',
    });
    expect((await fetch(`${raw}?k=garbage`)).status).toBe(401);

    const { token } = await unlockOk(up.slug);
    const byQuery = await fetch(`${raw}?k=${encodeURIComponent(token)}`);
    expect(byQuery.status).toBe(200);
    expect(Buffer.from(await byQuery.arrayBuffer()).equals(pngBytes())).toBe(
      true,
    );
    expect(byQuery.headers.get('cache-control')).toBe('private, no-store');
    expect(byQuery.headers.get('referrer-policy')).toBe('no-referrer');

    const byHeader = await fetch(raw, { headers: { 'X-File-Access': token } });
    expect(byHeader.status).toBe(200);
  });

  it('a token for slug A is rejected on slug B', async () => {
    const a = await uploadLocked(PASSWORD, 'a.png');
    const b = await uploadLocked(PASSWORD, 'b.png');
    const { token } = await unlockOk(a.slug);
    const res = await fetch(`${t.baseUrl}/f/${b.slug}?k=${token}`);
    expect(res.status).toBe(401);
  });

  it('the token stops working after 10 minutes', async () => {
    const up = await uploadLocked();
    const { token } = await unlockOk(up.slug);
    const raw = `${t.baseUrl}/f/${up.slug}?k=${token}`;
    expect((await fetch(raw)).status).toBe(200);

    fakeDateOnly();
    jest.setSystemTime(Date.now() + 10 * 60_000 + 1000);
    expect((await fetch(raw)).status).toBe(401);
  });

  it('after 10 wrong attempts from one client → 429 too_many_attempts, even with the right password', async () => {
    const up = await uploadLocked();
    for (let i = 0; i < 10; i++) {
      expect((await unlock(up.slug, `wrong-${i}`, '203.0.113.7')).status).toBe(
        403,
      );
    }
    const blocked = await unlock(up.slug, PASSWORD, '203.0.113.7');
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({
      statusCode: 429,
      reason: 'too_many_attempts',
    });
    // Another client still gets in.
    expect((await unlock(up.slug, PASSWORD, '203.0.113.8')).status).toBe(200);
  }, 30_000);

  it('the per-file limit holds across clients', async () => {
    const up = await uploadLocked();
    for (let i = 0; i < 50; i++) {
      expect((await unlock(up.slug, 'nope', `198.51.100.${i}`)).status).toBe(
        403,
      );
    }
    expect((await unlock(up.slug, PASSWORD, '198.51.100.200')).status).toBe(
      429,
    );
  }, 60_000);

  it('DELETE works with the delete token alone', async () => {
    const up = await uploadLocked();
    const res = await fetch(`${t.baseUrl}/api/files/${up.slug}`, {
      method: 'DELETE',
      headers: { 'X-Delete-Token': up.deleteToken },
    });
    expect(res.status).toBe(204);
    expect(t.repository.rows.size).toBe(0);
  });
});
