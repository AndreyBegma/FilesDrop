import { createWriteStream } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, isAbsolute, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import type { Message } from 'grammy/types';

export type FileKind =
  | 'photo'
  | 'document'
  | 'video'
  | 'audio'
  | 'voice'
  | 'animation'
  | 'video_note';

export type IncomingFile = {
  kind: FileKind;
  fileId: string;
  /** What Telegram says the size is; absent for some old uploads. */
  size?: number;
  /** The sender's file name, when Telegram has one. */
  name?: string;
};

/** Fallback names give the API an extension to go on. */
const DEFAULT_NAMES: Record<FileKind, string> = {
  photo: 'photo.jpg',
  document: 'file',
  video: 'video.mp4',
  audio: 'audio.mp3',
  voice: 'voice.ogg',
  animation: 'animation.mp4',
  video_note: 'video_note.mp4',
};

/** The file in a message, or undefined when there is none we handle. */
export const incomingFile = (
  message: Message | undefined,
): IncomingFile | undefined => {
  if (!message) return undefined;
  if (message.photo && message.photo.length > 0) {
    // Sizes are listed small to large; pick by area in case that ever changes.
    const largest = message.photo.reduce((a, b) =>
      b.width * b.height > a.width * a.height ? b : a,
    );
    return { kind: 'photo', fileId: largest.file_id, size: largest.file_size };
  }
  // An animation also carries `document`; check it first.
  if (message.animation) {
    const a = message.animation;
    return {
      kind: 'animation',
      fileId: a.file_id,
      size: a.file_size,
      name: a.file_name,
    };
  }
  if (message.document) {
    const d = message.document;
    return {
      kind: 'document',
      fileId: d.file_id,
      size: d.file_size,
      name: d.file_name,
    };
  }
  if (message.video) {
    const v = message.video;
    return {
      kind: 'video',
      fileId: v.file_id,
      size: v.file_size,
      name: v.file_name,
    };
  }
  if (message.audio) {
    const a = message.audio;
    return {
      kind: 'audio',
      fileId: a.file_id,
      size: a.file_size,
      name: a.file_name,
    };
  }
  if (message.voice) {
    return {
      kind: 'voice',
      fileId: message.voice.file_id,
      size: message.voice.file_size,
    };
  }
  if (message.video_note) {
    return {
      kind: 'video_note',
      fileId: message.video_note.file_id,
      size: message.video_note.file_size,
    };
  }
  return undefined;
};

/**
 * The name sent to the API. The sender's name when there is one; otherwise a
 * generic one with the extension the Bot API server stored the file under.
 */
export const uploadName = (file: IncomingFile, filePath?: string): string => {
  const name = file.name?.trim();
  if (name) return name;
  const fallback = DEFAULT_NAMES[file.kind];
  const ext = filePath ? extname(filePath).toLowerCase() : '';
  if (!ext || !/^\.[a-z0-9]{1,10}$/.test(ext)) return fallback;
  const dot = fallback.lastIndexOf('.');
  return `${dot > 0 ? fallback.slice(0, dot) : fallback}${ext}`;
};

export const isInside = (dir: string, path: string): boolean => {
  const root = resolve(dir);
  const target = resolve(path);
  return target.startsWith(root.endsWith(sep) ? root : root + sep);
};

export type LocalFile = {
  path: string;
  /** Whether the bot may delete it (it is ours, or in the shared volume). */
  owned: boolean;
};

/**
 * Where the bytes are on this machine.
 *
 * In `--local` mode getFile has already downloaded the file and returns an
 * absolute path in the server's working directory, which this container sees
 * through the shared volume (TG_FILES_DIR). A path outside that directory is
 * refused rather than read. A relative path means a non-local server (a dev
 * setup): the file is downloaded over HTTP into a private temp directory.
 */
export const resolveLocalFile = async (opts: {
  filePath: string;
  tgFilesDir: string;
  apiRoot: string;
  token: string;
  fetch?: (input: string) => Promise<Response>;
}): Promise<LocalFile> => {
  if (isAbsolute(opts.filePath)) {
    if (!isInside(opts.tgFilesDir, opts.filePath)) {
      throw new Error('file_path outside TG_FILES_DIR');
    }
    await stat(opts.filePath);
    return { path: opts.filePath, owned: true };
  }
  const doFetch = opts.fetch ?? ((input: string) => fetch(input));
  const res = await doFetch(
    `${opts.apiRoot}/file/bot${opts.token}/${opts.filePath}`,
  );
  if (!res.ok || !res.body) throw new Error(`file download: ${res.status}`);
  const dir = await mkdtemp(join(tmpdir(), 'filesdrop-bot-'));
  const path = join(dir, `download${extname(opts.filePath)}`);
  try {
    await pipeline(
      Readable.fromWeb(res.body as unknown as WebReadableStream),
      createWriteStream(path),
    );
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
  return { path, owned: true };
};

/** Deletes a local copy; a temp download takes its private directory along. */
export const discardLocalFile = async (
  file: LocalFile,
  tgFilesDir: string,
): Promise<void> => {
  if (!file.owned) return;
  if (isInside(tgFilesDir, file.path)) {
    await rm(file.path, { force: true });
    return;
  }
  const dir = resolve(file.path, '..');
  if (isInside(tmpdir(), dir) && dir.includes('filesdrop-bot-')) {
    await rm(dir, { recursive: true, force: true });
  }
};
