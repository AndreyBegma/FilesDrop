import { afterEach, describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Message } from 'grammy/types';
import { sweepDownloads } from './storage-sweep';
import { incomingFile, isInside, uploadName } from './telegram-file';

const msg = (fields: Partial<Message>) => fields as Message;

describe('incomingFile', () => {
  it('recognises every kind the bot handles', () => {
    const f = { file_id: 'X', file_unique_id: 'u', file_size: 10 };
    expect(
      incomingFile(msg({ document: { ...f, file_name: 'a.pdf' } }))?.kind,
    ).toBe('document');
    expect(
      incomingFile(
        msg({
          video: { ...f, width: 1, height: 1, duration: 1 },
        }),
      )?.kind,
    ).toBe('video');
    expect(incomingFile(msg({ audio: { ...f, duration: 1 } }))?.kind).toBe(
      'audio',
    );
    expect(incomingFile(msg({ voice: { ...f, duration: 1 } }))?.kind).toBe(
      'voice',
    );
    expect(
      incomingFile(msg({ video_note: { ...f, length: 1, duration: 1 } }))?.kind,
    ).toBe('video_note');
    // An animation message also carries `document`.
    expect(
      incomingFile(
        msg({
          animation: { ...f, width: 1, height: 1, duration: 1 },
          document: { ...f },
        }),
      )?.kind,
    ).toBe('animation');
    expect(incomingFile(msg({ text: 'hi' }))).toBeUndefined();
    expect(incomingFile(undefined)).toBeUndefined();
  });
});

describe('uploadName', () => {
  it('prefers the sender’s name, else a generic one with the stored extension', () => {
    expect(uploadName({ kind: 'document', fileId: 'x', name: 'cat.pdf' })).toBe(
      'cat.pdf',
    );
    expect(
      uploadName({ kind: 'voice', fileId: 'x' }, '/v/voice/file_1.oga'),
    ).toBe('voice.oga');
    expect(uploadName({ kind: 'photo', fileId: 'x' })).toBe('photo.jpg');
    expect(uploadName({ kind: 'document', fileId: 'x' }, '/d/file_3')).toBe(
      'file',
    );
  });
});

describe('isInside', () => {
  it('rejects traversal and sibling prefixes', () => {
    expect(isInside('/var/lib/tg', '/var/lib/tg/a/b')).toBe(true);
    expect(isInside('/var/lib/tg', '/var/lib/tg/../x')).toBe(false);
    expect(isInside('/var/lib/tg', '/var/lib/tg2/x')).toBe(false);
    expect(isInside('/var/lib/tg', '/var/lib/tg')).toBe(false);
  });
});

describe('sweepDownloads', () => {
  let dir: string;
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('removes old downloads only, and never the server’s own files', async () => {
    dir = await mkdtemp(join(tmpdir(), 'filesdrop-sweep-'));
    const bot = join(dir, '123:ABC');
    await mkdir(join(bot, 'documents'), { recursive: true });
    await mkdir(join(bot, 'photos'), { recursive: true });
    const old = new Date(Date.now() - 3 * 3600_000);
    const files = {
      oldDoc: join(bot, 'documents', 'file_0.pdf'),
      newPhoto: join(bot, 'photos', 'file_1.jpg'),
      db: join(bot, 'td.binlog'),
    };
    for (const path of Object.values(files)) await writeFile(path, 'x');
    await utimes(files.oldDoc, old, old);
    await utimes(files.db, old, old);

    expect(await sweepDownloads(dir, 2 * 3600_000)).toBe(1);
    expect(await Bun.file(files.oldDoc).exists()).toBe(false);
    expect(await Bun.file(files.newPhoto).exists()).toBe(true);
    expect(await Bun.file(files.db).exists()).toBe(true);
  });
});
