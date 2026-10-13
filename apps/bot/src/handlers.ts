import { stat } from 'node:fs/promises';
import type {
  InlineKeyboardMarkup,
  LinkPreviewOptions,
  Message,
  ReplyParameters,
} from 'grammy/types';
import {
  directUrl,
  type FilesApi,
  previewUrl,
  type UploadOutcome,
} from './api-client';
import { errorKeyFor } from './api-errors';
import { decodeCallback } from './callback-data';
import {
  type ErrorKey,
  type IntroParams,
  LANG_PROMPT,
  type Lang,
  pickLang,
  privacyUrl,
  t,
} from './i18n';
import { fileKeyboard, langKeyboard } from './keyboard';
import type { LanguagePrefs } from './languages';
import { type Logger, sizeBucket } from './log';
import type { FileSession, SessionStore } from './sessions';
import {
  discardLocalFile,
  type IncomingFile,
  incomingFile,
  type LocalFile,
  resolveLocalFile,
  uploadName,
} from './telegram-file';

type MessageOptions = {
  reply_markup?: InlineKeyboardMarkup;
  link_preview_options?: LinkPreviewOptions;
  reply_parameters?: ReplyParameters;
};

/**
 * The slice of grammY's Context the handlers use. grammY's Context satisfies
 * it; tests pass a plain object.
 */
export type BotContext = {
  from?: { id: number; language_code?: string };
  chat?: { id: number };
  message?: Message;
  me?: { username: string };
  callbackQuery?: {
    data?: string;
    message?: { message_id: number; chat: { id: number } };
  };
  reply(text: string, other?: MessageOptions): Promise<{ message_id: number }>;
  answerCallbackQuery(other?: {
    text?: string;
    show_alert?: boolean;
  }): Promise<unknown>;
};

/** The slice of grammY's Api the handlers use (`bot.api`). */
export type TelegramApi = {
  getFile(fileId: string): Promise<{ file_path?: string }>;
  editMessageText(
    chatId: number,
    messageId: number,
    text: string,
    other?: MessageOptions,
  ): Promise<unknown>;
  editMessageReplyMarkup(
    chatId: number,
    messageId: number,
    other?: { reply_markup?: InlineKeyboardMarkup },
  ): Promise<unknown>;
};

export type HandlerDeps = {
  telegram: TelegramApi;
  files: FilesApi;
  sessions: SessionStore;
  /** The language each user chose, by Telegram user id. */
  languages: LanguagePrefs;
  log: Logger;
  token: string;
  telegramApiRoot: string;
  tgFilesDir: string;
  publicWebUrl: string;
  ttls: readonly string[];
  defaultTtl: string;
  maxFileBytes: number;
  /** Used in /help when getMe has not filled ctx.me (tests). */
  fallbackUsername?: string;
};

const NO_PREVIEW: LinkPreviewOptions = { is_disabled: true };
const MB = 1024 * 1024;

export const createHandlers = (deps: HandlerDeps) => {
  const maxMb = Math.floor(deps.maxFileBytes / MB);
  /** Users with an upload in flight: one at a time per person. */
  const inFlight = new Set<number>();

  const savedLang = (ctx: BotContext): Lang | undefined =>
    ctx.from ? deps.languages.get(ctx.from.id) : undefined;

  /** The saved choice, else what Telegram's language_code suggests. */
  const langOf = (ctx: BotContext): Lang =>
    savedLang(ctx) ?? pickLang(ctx.from?.language_code);

  const showPicker = async (ctx: BotContext): Promise<void> => {
    const saved = savedLang(ctx);
    await ctx.reply(LANG_PROMPT, {
      reply_markup: langKeyboard(
        saved ?? pickLang(ctx.from?.language_code),
        saved,
      ),
    });
  };

  const intro = (ctx: BotContext, lang: Lang): IntroParams => ({
    ttls: deps.ttls,
    defaultTtl: deps.defaultTtl,
    maxMb,
    privacyUrl: privacyUrl(deps.publicWebUrl, lang),
    webUrl: deps.publicWebUrl,
    botUsername:
      ctx.me?.username ?? deps.fallbackUsername ?? 'catfilesdrop_bot',
  });

  const errorText = (lang: Lang, key: ErrorKey, sizeBytes?: number): string =>
    t(lang).error(key, {
      maxMb,
      sizeMb: sizeBytes === undefined ? undefined : Math.ceil(sizeBytes / MB),
    });

  const discard = async (local: LocalFile | undefined): Promise<void> => {
    if (!local) return;
    try {
      await discardLocalFile(local, deps.tgFilesDir);
    } catch {
      deps.log('local_discard_failed');
    }
  };

  /** getFile through the local server, then the bytes on this machine. */
  const fetchLocal = async (incoming: IncomingFile): Promise<LocalFile> => {
    const info = await deps.telegram.getFile(incoming.fileId);
    if (!info.file_path) throw new Error('getFile returned no file_path');
    return resolveLocalFile({
      filePath: info.file_path,
      tgFilesDir: deps.tgFilesDir,
      apiRoot: deps.telegramApiRoot,
      token: deps.token,
    });
  };

  /** The local copy if it is still there, otherwise a fresh getFile. */
  const ensureLocal = async (session: FileSession): Promise<LocalFile> => {
    if (session.local) {
      try {
        await stat(session.local.path);
        return session.local;
      } catch {
        session.local = undefined;
      }
    }
    session.local = await fetchLocal(session.incoming);
    return session.local;
  };

  const uploadedText = (
    lang: Lang,
    file: { slug: string; ext: string; expiresAt: string },
    ttl: string,
  ): string =>
    t(lang).uploaded({
      directUrl: directUrl(deps.publicWebUrl, file),
      previewUrl: previewUrl(deps.publicWebUrl, file),
      ttl,
      expiresAt: file.expiresAt,
    });

  const upload = (
    local: LocalFile,
    name: string,
    ttl: string,
    userId: number,
  ): Promise<UploadOutcome> =>
    deps.files.upload({ path: local.path, name, ttl, telegramUserId: userId });

  return {
    /** The welcome in the saved language, or the picker on a first visit. */
    async start(ctx: BotContext): Promise<void> {
      const lang = savedLang(ctx);
      if (!lang) {
        await showPicker(ctx);
        deps.log('command', { name: 'start', picker: true });
        return;
      }
      await ctx.reply(t(lang).start(intro(ctx, lang)), {
        link_preview_options: NO_PREVIEW,
      });
      deps.log('command', { name: 'start', lang });
    },

    async lang(ctx: BotContext): Promise<void> {
      await showPicker(ctx);
      deps.log('command', { name: 'lang' });
    },

    async help(ctx: BotContext): Promise<void> {
      const lang = langOf(ctx);
      await ctx.reply(t(lang).help(intro(ctx, lang)), {
        link_preview_options: NO_PREVIEW,
      });
      deps.log('command', { name: 'help', lang });
    },

    /** Any message that is neither a command nor a file we handle. */
    async other(ctx: BotContext): Promise<void> {
      await ctx.reply(t(langOf(ctx)).notAFile);
    },

    async file(ctx: BotContext): Promise<void> {
      const incoming = incomingFile(ctx.message);
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      if (!incoming || userId === undefined || chatId === undefined) {
        await ctx.reply(t(langOf(ctx)).notAFile);
        return;
      }
      const lang = langOf(ctx);
      // Uploads are never held back by the picker; until a language is
      // chosen, the reply says how to change it.
      const hint = deps.languages.get(userId) === undefined;
      const withHint = (text: string) =>
        hint ? `${text}\n\n${t(lang).langHint}` : text;
      const replyTo: MessageOptions = ctx.message
        ? { reply_parameters: { message_id: ctx.message.message_id } }
        : {};

      if (incoming.size !== undefined && incoming.size > deps.maxFileBytes) {
        await ctx.reply(
          withHint(errorText(lang, 'too_large', incoming.size)),
          replyTo,
        );
        deps.log('upload', { kind: incoming.kind, result: 'too_large_tg' });
        return;
      }
      if (inFlight.has(userId)) {
        await ctx.reply(withHint(t(lang).oneAtATime), replyTo);
        deps.log('upload', { kind: incoming.kind, result: 'cooldown' });
        return;
      }

      inFlight.add(userId);
      let local: LocalFile | undefined;
      let keepLocal = false;
      try {
        const status = await ctx.reply(t(lang).working, replyTo);
        const edit = (text: string, other: MessageOptions = {}) =>
          deps.telegram.editMessageText(
            chatId,
            status.message_id,
            withHint(text),
            {
              link_preview_options: NO_PREVIEW,
              ...other,
            },
          );

        let filePath: string | undefined;
        try {
          const info = await deps.telegram.getFile(incoming.fileId);
          filePath = info.file_path;
          if (!filePath) throw new Error('no file_path');
          local = await resolveLocalFile({
            filePath,
            tgFilesDir: deps.tgFilesDir,
            apiRoot: deps.telegramApiRoot,
            token: deps.token,
          });
        } catch {
          await edit(errorText(lang, 'fetch_failed'));
          deps.log('upload', { kind: incoming.kind, result: 'fetch_failed' });
          return;
        }

        const size = (await stat(local.path)).size;
        if (size > deps.maxFileBytes) {
          await edit(errorText(lang, 'too_large', size));
          deps.log('upload', { kind: incoming.kind, result: 'too_large' });
          return;
        }

        const name = uploadName(incoming, filePath);
        const result = await upload(local, name, deps.defaultTtl, userId);
        if (!result.ok) {
          const key = errorKeyFor(result.status, result.reason);
          await edit(
            errorText(lang, key, key === 'too_large' ? size : undefined),
          );
          deps.log('upload', {
            kind: incoming.kind,
            result: 'api_error',
            status: result.status,
          });
          return;
        }

        await edit(uploadedText(lang, result.file, deps.defaultTtl), {
          reply_markup: fileKeyboard(deps.ttls, deps.defaultTtl, lang),
        });
        deps.sessions.put({
          chatId,
          messageId: status.message_id,
          userId,
          lang,
          slug: result.file.slug,
          ext: result.file.ext,
          deleteToken: result.file.deleteToken,
          ttl: deps.defaultTtl,
          expiresAt: result.file.expiresAt,
          incoming,
          name,
          local,
        });
        keepLocal = true;
        deps.log('upload', {
          kind: incoming.kind,
          result: 'ok',
          size: sizeBucket(size),
          sessions: deps.sessions.size,
        });
      } finally {
        inFlight.delete(userId);
        if (!keepLocal) await discard(local);
      }
    },

    async callback(ctx: BotContext): Promise<void> {
      const action = decodeCallback(ctx.callbackQuery?.data, deps.ttls);
      const message = ctx.callbackQuery?.message;

      if (action?.kind === 'lang') {
        // Saved for whoever tapped, then the picker becomes the welcome.
        const lang = action.lang;
        if (ctx.from) deps.languages.set(ctx.from.id, lang);
        const welcome = t(lang).start(intro(ctx, lang));
        let edited = false;
        if (message) {
          try {
            await deps.telegram.editMessageText(
              message.chat.id,
              message.message_id,
              welcome,
              { link_preview_options: NO_PREVIEW },
            );
            edited = true;
          } catch {
            // Too old or gone: send the welcome as a new message instead.
          }
        }
        await ctx.answerCallbackQuery({ text: t(lang).langChosen });
        if (!edited) {
          await ctx.reply(welcome, { link_preview_options: NO_PREVIEW });
        }
        deps.log('language', { lang, edited });
        return;
      }

      const presserLang = langOf(ctx);
      const session =
        action && message
          ? deps.sessions.get(message.chat.id, message.message_id)
          : undefined;

      if (!action || !message || !session) {
        await ctx.answerCallbackQuery({
          text: t(presserLang).napped,
          show_alert: true,
        });
        deps.log('button', { result: 'napped' });
        return;
      }
      if (session.busy) {
        await ctx.answerCallbackQuery({ text: t(presserLang).busy });
        deps.log('button', { result: 'busy' });
        return;
      }

      session.busy = true;
      try {
        if (action.kind === 'delete') {
          const res = await deps.files.remove(
            session.slug,
            session.deleteToken,
          );
          if (!res.ok && res.status !== 404 && res.status !== 410) {
            await ctx.answerCallbackQuery({
              text: errorText(presserLang, errorKeyFor(res.status)),
              show_alert: true,
            });
            deps.log('button', {
              action: 'delete',
              result: 'api_error',
              status: res.status,
            });
            return;
          }
          deps.sessions.delete(session);
          await discard(session.local);
          await deps.telegram.editMessageText(
            session.chatId,
            session.messageId,
            t(session.lang).deleted,
          );
          await ctx.answerCallbackQuery({ text: t(presserLang).deleted });
          deps.log('button', {
            action: 'delete',
            result: res.ok ? 'ok' : 'gone',
          });
          return;
        }

        if (action.ttl === session.ttl) {
          await ctx.answerCallbackQuery({
            text: t(presserLang).ttlChanged(action.ttl),
          });
          return;
        }

        // There is no "change lifetime" endpoint: upload the same bytes again
        // with the new lifetime, then delete the old file.
        let local: LocalFile;
        try {
          local = await ensureLocal(session);
        } catch {
          await ctx.answerCallbackQuery({
            text: errorText(presserLang, 'fetch_failed'),
            show_alert: true,
          });
          deps.log('button', { action: 'ttl', result: 'fetch_failed' });
          return;
        }
        const result = await upload(
          local,
          session.name,
          action.ttl,
          session.userId,
        );
        if (!result.ok) {
          await ctx.answerCallbackQuery({
            text: errorText(
              presserLang,
              errorKeyFor(result.status, result.reason),
            ),
            show_alert: true,
          });
          deps.log('button', {
            action: 'ttl',
            result: 'api_error',
            status: result.status,
          });
          return;
        }
        const old = { slug: session.slug, deleteToken: session.deleteToken };
        session.slug = result.file.slug;
        session.ext = result.file.ext;
        session.deleteToken = result.file.deleteToken;
        session.expiresAt = result.file.expiresAt;
        session.ttl = action.ttl;
        deps.sessions.touch(session);

        const removed = await deps.files.remove(old.slug, old.deleteToken);
        await deps.telegram.editMessageText(
          session.chatId,
          session.messageId,
          uploadedText(session.lang, result.file, action.ttl),
          {
            link_preview_options: NO_PREVIEW,
            reply_markup: fileKeyboard(deps.ttls, action.ttl, session.lang),
          },
        );
        await ctx.answerCallbackQuery({
          text: t(presserLang).ttlChanged(action.ttl),
        });
        deps.log('button', {
          action: 'ttl',
          result: 'ok',
          ttl: action.ttl,
          oldRemoved: removed.ok,
        });
      } finally {
        session.busy = false;
      }
    },

    /**
     * Ends sessions whose buttons have expired: deletes their local copies and,
     * best effort, takes the buttons off the message.
     */
    async expireSessions(): Promise<number> {
      const expired = deps.sessions.takeExpired();
      for (const session of expired) {
        await discard(session.local);
        try {
          await deps.telegram.editMessageReplyMarkup(
            session.chatId,
            session.messageId,
            { reply_markup: { inline_keyboard: [] } },
          );
        } catch {
          // The message may be gone or too old to edit; the buttons nap anyway.
        }
      }
      if (expired.length > 0) {
        deps.log('sessions_expired', {
          count: expired.length,
          left: deps.sessions.size,
        });
      }
      return expired.length;
    },
  };
};

export type Handlers = ReturnType<typeof createHandlers>;
