import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LanguageStore } from './languages';
import type { LogFields } from './log';

const dirs: string[] = [];
const tempDir = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'filesdrop-bot-langs-'));
  dirs.push(dir);
  return dir;
};

afterEach(async () => {
  for (const dir of dirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

const recorder = () => {
  const events: { event: string; fields?: LogFields }[] = [];
  return {
    events,
    log: (event: string, fields?: LogFields) => {
      events.push({ event, fields });
    },
  };
};

describe('LanguageStore', () => {
  it('starts empty when the file is missing', async () => {
    const dir = await tempDir();
    const r = recorder();
    const store = new LanguageStore({ path: join(dir, 'l.json'), log: r.log });
    await store.load();
    expect(store.size).toBe(0);
    expect(r.events).toEqual([
      { event: 'languages_load', fields: { result: 'missing' } },
    ]);
  });

  it('starts empty when the file is corrupt', async () => {
    const dir = await tempDir();
    const path = join(dir, 'l.json');
    for (const content of ['{not json', '[1,2]', 'null', '"en"']) {
      await writeFile(path, content);
      const r = recorder();
      const store = new LanguageStore({ path, log: r.log });
      await store.load();
      expect(store.size).toBe(0);
      expect(r.events[0]?.fields?.result).toBe('corrupt');
    }
  });

  it('loads valid entries and skips the rest', async () => {
    const dir = await tempDir();
    const path = join(dir, 'l.json');
    await writeFile(
      path,
      JSON.stringify({ '42': 'uk', '7': 'en', '8': 'ru', abc: 'en' }),
    );
    const r = recorder();
    const store = new LanguageStore({ path, log: r.log });
    await store.load();
    expect(store.get(42)).toBe('uk');
    expect(store.get(7)).toBe('en');
    expect(store.get(8)).toBeUndefined();
    expect(r.events[0]?.fields).toEqual({
      result: 'ok',
      entries: 2,
      skipped: 2,
    });
  });

  it('saves on flush and reads it back after a restart', async () => {
    const dir = await tempDir();
    const path = join(dir, 'nested', 'languages.json');
    const log = recorder().log;
    const store = new LanguageStore({ path, log, debounceMs: 60_000 });
    store.set(42, 'uk');
    store.set(7, 'en');
    store.set(42, 'en');
    await store.flush();

    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({
      '7': 'en',
      '42': 'en',
    });
    // Atomic: no temp file left behind.
    expect(await readdir(join(dir, 'nested'))).toEqual(['languages.json']);

    const again = new LanguageStore({ path, log });
    await again.load();
    expect(again.get(42)).toBe('en');
    expect(again.get(7)).toBe('en');
  });

  it('writes by itself after the debounce', async () => {
    const dir = await tempDir();
    const path = join(dir, 'l.json');
    const store = new LanguageStore({
      path,
      log: recorder().log,
      debounceMs: 5,
    });
    store.set(1, 'uk');
    for (let i = 0; i < 100; i++) {
      await Bun.sleep(10);
      const raw = await readFile(path, 'utf8').catch(() => undefined);
      if (raw) {
        expect(JSON.parse(raw)).toEqual({ '1': 'uk' });
        return;
      }
    }
    throw new Error('never written');
  });

  it('evicts the oldest entry past the cap', async () => {
    const dir = await tempDir();
    const path = join(dir, 'l.json');
    const store = new LanguageStore({
      path,
      log: recorder().log,
      maxEntries: 2,
      debounceMs: 60_000,
    });
    store.set(1, 'en');
    store.set(2, 'uk');
    // A change moves user 1 to the end, so user 2 is now the oldest.
    store.set(1, 'uk');
    store.set(3, 'en');
    expect(store.size).toBe(2);
    expect(store.get(2)).toBeUndefined();
    expect(store.get(1)).toBe('uk');
    expect(store.get(3)).toBe('en');
    await store.flush();
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({
      '1': 'uk',
      '3': 'en',
    });
  });
});
