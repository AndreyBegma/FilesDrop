import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Message } from 'grammy/types';
import type { FilesApi } from '../api-client';
import type { BotContext, HandlerDeps, TelegramApi } from '../handlers';
import type { Lang } from '../i18n';
import type { LanguagePrefs } from '../languages';
import { silentLogger } from '../log';
import { SessionStore } from '../sessions';

type Sent = { text: string; other?: unknown };

/** A grammY-shaped context that records what the handler did with it. */
export const fakeContext = (init: {
  userId?: number;
  chatId?: number;
  lang?: string;
  message?: Partial<Message>;
  callback?: { data: string; messageId: number; chatId?: number };
}) => {
  const replies: Sent[] = [];
  const answers: { text?: string; show_alert?: boolean }[] = [];
  let nextId = 1000;
  const chatId = init.chatId ?? 500;
  const ctx: BotContext = {
    from: { id: init.userId ?? 42, language_code: init.lang },
    chat: { id: chatId },
    me: { username: 'catfilesdrop_bot' },
    message: init.message
      ? ({
          message_id: 7,
          date: 0,
          chat: { id: chatId, type: 'private', first_name: 'x' },
          ...init.message,
        } as Message)
      : undefined,
    callbackQuery: init.callback
      ? {
          data: init.callback.data,
          message: {
            message_id: init.callback.messageId,
            chat: { id: init.callback.chatId ?? chatId },
          },
        }
      : undefined,
    reply: async (text, other) => {
      replies.push({ text, other });
      return { message_id: nextId++ };
    },
    answerCallbackQuery: async (other) => {
      answers.push(other ?? {});
      return true;
    },
  };
  return { ctx, replies, answers };
};

/** bot.api stand-in: getFile answers with a path in the fake volume. */
export const fakeTelegram = (paths: Record<string, string>) => {
  const edits: {
    chatId: number;
    messageId: number;
    text: string;
    other?: unknown;
  }[] = [];
  const markupEdits: { chatId: number; messageId: number }[] = [];
  const getFileCalls: string[] = [];
  const api: TelegramApi = {
    getFile: async (fileId) => {
      getFileCalls.push(fileId);
      const path = paths[fileId];
      if (!path) throw new Error('Bad Request: invalid file_id');
      return { file_path: path };
    },
    editMessageText: async (chatId, messageId, text, other) => {
      edits.push({ chatId, messageId, text, other });
      return true;
    },
    editMessageReplyMarkup: async (chatId, messageId) => {
      markupEdits.push({ chatId, messageId });
      return true;
    },
  };
  return { api, edits, markupEdits, getFileCalls };
};

/** In-memory FilesApi: hands out slugs, remembers what it was asked. */
export const fakeFiles = (
  respond?: (call: number) => { status: number; reason?: string } | undefined,
) => {
  const uploads: {
    path: string;
    name: string;
    ttl: string;
    telegramUserId: number;
  }[] = [];
  const removals: { slug: string; deleteToken: string }[] = [];
  const api: FilesApi = {
    upload: async (input) => {
      uploads.push(input);
      const failure = respond?.(uploads.length);
      if (failure) return { ok: false, ...failure };
      const n = uploads.length;
      return {
        ok: true,
        file: {
          slug: `slug000${n}`,
          name: input.name,
          ext: 'png',
          mime: 'image/png',
          size: 5,
          createdAt: '2026-10-13T00:00:00.000Z',
          expiresAt: '2026-10-14T00:00:00.000Z',
          inline: true,
          locked: false,
          deleteToken: `token-${n}`,
        },
      };
    },
    remove: async (slug, deleteToken) => {
      removals.push({ slug, deleteToken });
      return { ok: true };
    },
  };
  return { api, uploads, removals };
};

/** A TG_FILES_DIR laid out like the local server's working directory. */
export const fakeVolume = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'filesdrop-bot-spec-'));
  const docs = join(dir, '123:ABC', 'documents');
  await mkdir(docs, { recursive: true });
  const put = async (name: string, bytes: Uint8Array | string = 'hello') => {
    const path = join(docs, name);
    await writeFile(path, bytes);
    return path;
  };
  return { dir, put };
};

/** LanguagePrefs in a plain Map, optionally pre-filled. */
export const memoryLanguages = (
  init: Record<number, Lang> = {},
): LanguagePrefs & { saved: Map<number, Lang> } => {
  const saved = new Map<number, Lang>(
    Object.entries(init).map(([id, lang]) => [Number(id), lang]),
  );
  return {
    saved,
    get: (userId) => saved.get(userId),
    set: (userId, lang) => {
      saved.set(userId, lang);
    },
  };
};

export const baseDeps = (
  over: Partial<HandlerDeps> &
    Pick<HandlerDeps, 'telegram' | 'files' | 'tgFilesDir'>,
): HandlerDeps => ({
  sessions: new SessionStore(),
  languages: memoryLanguages(),
  log: silentLogger,
  token: '123:ABC',
  telegramApiRoot: 'http://127.0.0.1:1',
  publicWebUrl: 'https://filesdrop.luna-realm.com',
  ttls: ['1h', '12h', '24h', '72h'],
  defaultTtl: '24h',
  maxFileBytes: 95 * 1024 * 1024,
  ...over,
});
