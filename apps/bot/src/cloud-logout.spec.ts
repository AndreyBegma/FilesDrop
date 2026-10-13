import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CLOUD_LOGOUT_MARKER, ensureCloudLogout } from './cloud-logout';
import { silentLogger } from './log';

const dirs: string[] = [];
const tempDir = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'filesdrop-logout-'));
  dirs.push(dir);
  return dir;
};

afterEach(async () => {
  for (const dir of dirs.splice(0))
    await rm(dir, { recursive: true, force: true });
});

const answering = (status: number, body: unknown) => {
  const calls: string[] = [];
  const fetch = async (url: string) => {
    calls.push(url);
    return new Response(JSON.stringify(body), { status });
  };
  return { calls, fetch };
};

const run = (markerDir: string, fetch: (url: string) => Promise<Response>) =>
  ensureCloudLogout({
    token: '123:ABC',
    cloudRoot: 'https://api.telegram.org',
    markerDir,
    log: silentLogger,
    fetch,
  });

describe('ensureCloudLogout', () => {
  it('logs out once and never again', async () => {
    const dir = await tempDir();
    const tg = answering(200, { ok: true, result: true });

    expect(await run(dir, tg.fetch)).toBe('logged_out');
    expect(await run(dir, tg.fetch)).toBe('already_done');
    expect(await run(dir, tg.fetch)).toBe('already_done');

    expect(tg.calls).toEqual(['https://api.telegram.org/bot123:ABC/logOut']);
    const marker = await readFile(join(dir, CLOUD_LOGOUT_MARKER), 'utf8');
    expect(marker).toContain('"result":"logged_out"');
    expect(marker).not.toContain('123:ABC');
  });

  it('records a refusal too, so a crash loop does not call it again', async () => {
    const dir = await tempDir();
    const tg = answering(400, {
      ok: false,
      description: 'Bad Request: logged out',
    });
    expect(await run(dir, tg.fetch)).toBe('telegram_refused');
    expect(await run(dir, tg.fetch)).toBe('already_done');
    expect(tg.calls).toHaveLength(1);
  });

  it('leaves no marker when Telegram did not answer at all', async () => {
    const dir = await tempDir();
    let calls = 0;
    const down = async () => {
      calls++;
      throw new TypeError('fetch failed');
    };
    expect(await run(dir, down)).toBe('no_answer');
    expect(await run(dir, down)).toBe('no_answer');
    expect(calls).toBe(2);
  });
});
