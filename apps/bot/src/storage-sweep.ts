import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * The per-type folders the local Bot API server downloads files into, under
 * `<TG_FILES_DIR>/<bot token>/`. Only these are swept: the same directory
 * also holds the server's own database, which must never be touched.
 */
export const MEDIA_DIRS = [
  'animations',
  'documents',
  'music',
  'photos',
  'videos',
  'video_notes',
  'voice',
] as const;

/**
 * Deletes downloaded files older than `maxAgeMs`. A session deletes its own
 * copy when its buttons expire; this catches what a restart left behind.
 * Returns how many files it removed.
 */
export const sweepDownloads = async (
  tgFilesDir: string,
  maxAgeMs: number,
  now: number = Date.now(),
): Promise<number> => {
  let removed = 0;
  let bots: string[];
  try {
    bots = await readdir(tgFilesDir);
  } catch {
    return 0;
  }
  for (const bot of bots) {
    for (const media of MEDIA_DIRS) {
      const dir = join(tgFilesDir, bot, media);
      let names: string[];
      try {
        names = await readdir(dir);
      } catch {
        continue;
      }
      for (const name of names) {
        const path = join(dir, name);
        try {
          const info = await stat(path);
          if (info.isFile() && now - info.mtimeMs > maxAgeMs) {
            await rm(path, { force: true });
            removed++;
          }
        } catch {
          // Gone in the meantime, or not ours to delete.
        }
      }
    }
  }
  return removed;
};
