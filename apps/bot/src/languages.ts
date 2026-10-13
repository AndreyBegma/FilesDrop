import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Lang } from './i18n';
import type { Logger } from './log';

/** The language a user picked with /start or /lang, keyed by Telegram user id. */
export type LanguagePrefs = {
  get(userId: number): Lang | undefined;
  set(userId: number, lang: Lang): void;
};

export const LANGUAGES_FILE = 'languages.json';
export const MAX_LANGUAGE_ENTRIES = 100_000;
const SAVE_DEBOUNCE_MS = 2_000;

const isLang = (value: unknown): value is Lang =>
  value === 'en' || value === 'uk';

/**
 * `{ "<userId>": "en" | "uk" }` in one JSON file, and nothing else: no names,
 * no chats, no timestamps.
 *
 * Writes are debounced and atomic (a temp file next to it, then rename), so a
 * crash leaves either the old file or the new one. A missing or unreadable
 * file starts the store empty: users are simply asked again.
 *
 * Capped at MAX_LANGUAGE_ENTRIES. The map keeps insertion order (a change
 * moves a user to the end), and the oldest entry goes first. JSON objects
 * with integer keys come back in numeric order, so after a restart "oldest"
 * means the lowest user id: close enough for a cap that should never bite.
 */
export class LanguageStore implements LanguagePrefs {
  private readonly langs = new Map<string, Lang>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private writing: Promise<void> = Promise.resolve();
  private dirty = false;

  constructor(
    private readonly options: {
      path: string;
      log: Logger;
      debounceMs?: number;
      maxEntries?: number;
    },
  ) {}

  get size(): number {
    return this.langs.size;
  }

  get(userId: number): Lang | undefined {
    return this.langs.get(String(userId));
  }

  set(userId: number, lang: Lang): void {
    const key = String(userId);
    if (this.langs.get(key) === lang) return;
    this.langs.delete(key);
    this.langs.set(key, lang);
    const max = this.options.maxEntries ?? MAX_LANGUAGE_ENTRIES;
    while (this.langs.size > max) {
      const oldest = this.langs.keys().next().value;
      if (oldest === undefined) break;
      this.langs.delete(oldest);
    }
    this.dirty = true;
    this.schedule();
  }

  /** Reads the file once at start. Never throws; never logs a user id. */
  async load(): Promise<void> {
    let raw: string;
    try {
      raw = await readFile(this.options.path, 'utf8');
    } catch (error) {
      const missing =
        error instanceof Error && 'code' in error && error.code === 'ENOENT';
      this.options.log('languages_load', {
        result: missing ? 'missing' : 'unreadable',
      });
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = undefined;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      this.options.log('languages_load', { result: 'corrupt' });
      return;
    }
    let skipped = 0;
    for (const [key, value] of Object.entries(parsed)) {
      if (/^\d{1,20}$/.test(key) && isLang(value)) this.langs.set(key, value);
      else skipped++;
    }
    this.options.log('languages_load', {
      result: 'ok',
      entries: this.langs.size,
      skipped,
    });
  }

  /** Writes any pending change now (shutdown, tests). */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (this.dirty) {
      this.dirty = false;
      this.writing = this.writing.then(() => this.write());
    }
    await this.writing;
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, this.options.debounceMs ?? SAVE_DEBOUNCE_MS);
    this.timer.unref?.();
  }

  private async write(): Promise<void> {
    const { path } = this.options;
    const tmp = `${path}.${process.pid}.tmp`;
    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(tmp, JSON.stringify(Object.fromEntries(this.langs)), {
        mode: 0o600,
      });
      await rename(tmp, path);
    } catch {
      this.options.log('languages_save_failed');
      await rm(tmp, { force: true }).catch(() => {});
      // Try again with the next change.
      this.dirty = true;
    }
  }
}
