import { afterEach, describe, expect, it } from 'bun:test';
import { access, rm } from 'node:fs/promises';
import { createHandlers } from './handlers';
import { SessionStore } from './sessions';
import {
  baseDeps,
  fakeContext,
  fakeFiles,
  fakeTelegram,
  fakeVolume,
} from './testing/fakes';

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

const volumes: string[] = [];
const volume = async () => {
  const v = await fakeVolume();
  volumes.push(v.dir);
  return v;
};

afterEach(async () => {
  for (const dir of volumes.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

const document = (fileId: string, size = 5, file_name = 'cat.png') => ({
  document: {
    file_id: fileId,
    file_unique_id: 'u',
    file_size: size,
    file_name,
  },
});

describe('file handler', () => {
  it('uploads with the bot headers and replies with both links and the buttons', async () => {
    const v = await volume();
    const path = await v.put('file_0.png');
    const tg = fakeTelegram({ F1: path });
    const files = fakeFiles();
    const h = createHandlers(
      baseDeps({ telegram: tg.api, files: files.api, tgFilesDir: v.dir }),
    );
    const { ctx, replies } = fakeContext({
      userId: 42,
      message: document('F1'),
    });

    await h.file(ctx);

    expect(files.uploads).toEqual([
      { path, name: 'cat.png', ttl: '24h', telegramUserId: 42 },
    ]);
    expect(replies[0]?.text).toContain('Carrying');
    const edit = tg.edits.at(-1);
    expect(edit?.text).toContain(
      'https://filesdrop.luna-realm.com/f/slug0001.png',
    );
    expect(edit?.text).toContain('https://filesdrop.luna-realm.com/v/slug0001');
    expect(JSON.stringify(edit?.other)).toContain('fd1:t:72h');
    expect(JSON.stringify(edit?.other)).not.toContain('token-1');
    // Kept for the lifetime buttons.
    expect(await exists(path)).toBe(true);
  });

  it('answers in Ukrainian when language_code starts with uk', async () => {
    const v = await volume();
    const tg = fakeTelegram({ F1: await v.put('a.png') });
    const h = createHandlers(
      baseDeps({ telegram: tg.api, files: fakeFiles().api, tgFilesDir: v.dir }),
    );
    const { ctx } = fakeContext({ lang: 'uk-UA', message: document('F1') });
    await h.file(ctx);
    expect(tg.edits.at(-1)?.text).toContain('Пряме:');
  });

  it('refuses a file over 95 MB before downloading it', async () => {
    const v = await volume();
    const tg = fakeTelegram({});
    const files = fakeFiles();
    const h = createHandlers(
      baseDeps({ telegram: tg.api, files: files.api, tgFilesDir: v.dir }),
    );
    const { ctx, replies } = fakeContext({
      message: document('BIG', 96 * 1024 * 1024),
    });
    await h.file(ctx);
    expect(tg.getFileCalls).toEqual([]);
    expect(files.uploads).toEqual([]);
    expect(replies[0]?.text).toContain('too chonky');
    expect(replies[0]?.text).toContain('96 MB');
  });

  it('maps an API error to a friendly text and deletes the local copy', async () => {
    const v = await volume();
    const path = await v.put('x.exe');
    const tg = fakeTelegram({ F1: path });
    const files = fakeFiles(() => ({
      status: 415,
      reason: 'denied_extension',
    }));
    const h = createHandlers(
      baseDeps({ telegram: tg.api, files: files.api, tgFilesDir: v.dir }),
    );
    const { ctx } = fakeContext({ message: document('F1', 5, 'x.exe') });
    await h.file(ctx);
    expect(tg.edits.at(-1)?.text).toContain('Hiss!');
    expect(await exists(path)).toBe(false);
  });

  it('refuses a file_path outside TG_FILES_DIR', async () => {
    const v = await volume();
    const tg = fakeTelegram({ F1: '/etc/passwd' });
    const files = fakeFiles();
    const h = createHandlers(
      baseDeps({ telegram: tg.api, files: files.api, tgFilesDir: v.dir }),
    );
    const { ctx } = fakeContext({ message: document('F1') });
    await h.file(ctx);
    expect(files.uploads).toEqual([]);
    expect(tg.edits.at(-1)?.text).toContain('could not fetch');
  });

  it('picks the largest photo size', async () => {
    const v = await volume();
    const path = await v.put('file_9.jpg');
    const tg = fakeTelegram({ BIG: path });
    const files = fakeFiles();
    const h = createHandlers(
      baseDeps({ telegram: tg.api, files: files.api, tgFilesDir: v.dir }),
    );
    const { ctx } = fakeContext({
      message: {
        photo: [
          { file_id: 'SMALL', file_unique_id: 's', width: 90, height: 90 },
          { file_id: 'BIG', file_unique_id: 'b', width: 1280, height: 960 },
          { file_id: 'MID', file_unique_id: 'm', width: 320, height: 240 },
        ],
      },
    });
    await h.file(ctx);
    expect(tg.getFileCalls).toEqual(['BIG']);
    expect(files.uploads[0]?.name).toBe('photo.jpg');
  });
});

describe('button handler', () => {
  const setup = async () => {
    const v = await volume();
    const path = await v.put('file_0.png');
    const tg = fakeTelegram({ F1: path });
    const files = fakeFiles();
    const sessions = new SessionStore();
    const h = createHandlers(
      baseDeps({
        telegram: tg.api,
        files: files.api,
        tgFilesDir: v.dir,
        sessions,
      }),
    );
    const upload = fakeContext({ chatId: 500, message: document('F1') });
    await h.file(upload.ctx);
    const messageId = tg.edits.at(-1)?.messageId as number;
    return { v, path, tg, files, sessions, h, messageId };
  };

  it('changes the lifetime by re-uploading and deleting the old file', async () => {
    const { tg, files, h, messageId } = await setup();
    const press = fakeContext({
      chatId: 500,
      callback: { data: 'fd1:t:72h', messageId },
    });

    await h.callback(press.ctx);

    expect(files.uploads.map((u) => u.ttl)).toEqual(['24h', '72h']);
    expect(files.removals).toEqual([
      { slug: 'slug0001', deleteToken: 'token-1' },
    ]);
    expect(tg.edits.at(-1)?.text).toContain('/f/slug0002.png');
    expect(tg.edits.at(-1)?.text).toContain('Lives 3d');
    expect(JSON.stringify(tg.edits.at(-1)?.other)).toContain('• 3d •');
    expect(press.answers[0]?.text).toContain('3d');
  });

  it('re-fetches through getFile when the local copy is gone', async () => {
    const { path, tg, files, h, messageId } = await setup();
    await rm(path);
    // The local server downloads it again to the same place.
    tg.api.getFile = async (id) => {
      tg.getFileCalls.push(id);
      await Bun.write(path, 'hello');
      return { file_path: path };
    };
    const press = fakeContext({
      chatId: 500,
      callback: { data: 'fd1:t:1h', messageId },
    });
    await h.callback(press.ctx);
    expect(tg.getFileCalls).toEqual(['F1', 'F1']);
    expect(files.uploads.map((u) => u.ttl)).toEqual(['24h', '1h']);
  });

  it('deletes the file from the chat that uploaded it', async () => {
    const { path, tg, files, h, messageId, sessions } = await setup();
    const press = fakeContext({
      chatId: 500,
      callback: { data: 'fd1:d', messageId },
    });
    await h.callback(press.ctx);
    expect(files.removals).toEqual([
      { slug: 'slug0001', deleteToken: 'token-1' },
    ]);
    expect(tg.edits.at(-1)?.text).toContain('Deleted');
    expect(sessions.size).toBe(0);
    expect(await exists(path)).toBe(false);
  });

  it('does nothing for a press from another chat', async () => {
    const { files, h, messageId } = await setup();
    const press = fakeContext({
      chatId: 999,
      callback: { data: 'fd1:d', messageId },
    });
    await h.callback(press.ctx);
    expect(files.removals).toEqual([]);
    expect(press.answers[0]?.text).toContain('napped');
  });

  it('says the buttons napped after a restart (no session)', async () => {
    const h = createHandlers(
      baseDeps({
        telegram: fakeTelegram({}).api,
        files: fakeFiles().api,
        tgFilesDir: '/nonexistent',
      }),
    );
    const press = fakeContext({
      lang: 'uk',
      callback: { data: 'fd1:t:1h', messageId: 1 },
    });
    await h.callback(press.ctx);
    expect(press.answers[0]).toEqual({
      text: 'Ці кнопки задрімали 😴. Надішли файл ще раз, щоб отримати свіжі.',
      show_alert: true,
    });
  });

  it('expires sessions: deletes the copy and takes the buttons off', async () => {
    const v = await volume();
    const path = await v.put('file_0.png');
    const tg = fakeTelegram({ F1: path });
    let now = 0;
    const sessions = new SessionStore(30 * 60 * 1000, () => now);
    const h = createHandlers(
      baseDeps({
        telegram: tg.api,
        files: fakeFiles().api,
        tgFilesDir: v.dir,
        sessions,
      }),
    );
    await h.file(fakeContext({ message: document('F1') }).ctx);
    now = 29 * 60 * 1000;
    expect(await h.expireSessions()).toBe(0);
    now = 31 * 60 * 1000;
    expect(await h.expireSessions()).toBe(1);
    expect(await exists(path)).toBe(false);
    expect(tg.markupEdits).toHaveLength(1);
  });
});

describe('commands', () => {
  it('/start and /help in en and uk', async () => {
    const h = createHandlers(
      baseDeps({
        telegram: fakeTelegram({}).api,
        files: fakeFiles().api,
        tgFilesDir: '/nonexistent',
      }),
    );
    const en = fakeContext({ lang: 'en' });
    await h.start(en.ctx);
    expect(en.replies[0]?.text).toContain('/en/privacy');
    const uk = fakeContext({ lang: 'uk' });
    await h.help(uk.ctx);
    expect(uk.replies[0]?.text).toContain('/uk/privacy');
    expect(uk.replies[0]?.text).toContain('t.me/catfilesdrop_bot');
  });
});
