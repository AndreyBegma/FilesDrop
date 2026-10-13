import { Bot, GrammyError, HttpError } from 'grammy';
import { createFilesApi } from './api-client';
import { ensureCloudLogout } from './cloud-logout';
import { ConfigError, configFromEnv } from './config';
import { createHandlers } from './handlers';
import { jsonLogger as log } from './log';
import { SessionStore } from './sessions';
import { sweepDownloads } from './storage-sweep';
import { DEFAULT_TTL, MAX_FILE_BYTES, TTLS } from './ttls';

const SESSION_CHECK_MS = 60 * 1000;
const SWEEP_EVERY_MS = 15 * 60 * 1000;
/** Well past a session's 30 minutes, also after the buttons were extended. */
const SWEEP_AGE_MS = 2 * 60 * 60 * 1000;
const FILE_MESSAGES = [
  'message:photo',
  'message:document',
  'message:video',
  'message:audio',
  'message:voice',
  'message:animation',
  'message:video_note',
] as const;

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

const errorStatus = (error: unknown): string => {
  if (error instanceof GrammyError) return `telegram_${error.error_code}`;
  if (error instanceof HttpError) return 'network';
  if (error instanceof ConfigError) return error.message;
  return error instanceof Error ? error.name : 'unknown';
};

const main = async (): Promise<void> => {
  const config = configFromEnv(process.env);

  // Once per data volume, before the local server is asked anything.
  try {
    await ensureCloudLogout({
      token: config.telegramBotToken,
      cloudRoot: config.telegramCloudRoot,
      markerDir: config.tgFilesDir,
      log,
    });
  } catch (error) {
    log('cloud_logout', { result: 'error', error: errorStatus(error) });
  }

  const bot = new Bot(config.telegramBotToken, {
    client: { apiRoot: config.telegramApiRoot },
  });

  // The local server can take a moment to start (or be restarting): wait for
  // getMe instead of crash-looping. Never calls the cloud from here.
  for (let attempt = 1; ; attempt++) {
    try {
      await bot.init();
      break;
    } catch (error) {
      const wait = Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5));
      log('local_api_unreachable', {
        attempt,
        error: errorStatus(error),
        retryInMs: wait,
      });
      await sleep(wait);
    }
  }

  const sessions = new SessionStore();
  const handlers = createHandlers({
    telegram: bot.api,
    files: createFilesApi({
      baseUrl: config.apiInternalUrl,
      botApiKey: config.botApiKey,
    }),
    sessions,
    log,
    token: config.telegramBotToken,
    telegramApiRoot: config.telegramApiRoot,
    tgFilesDir: config.tgFilesDir,
    publicWebUrl: config.publicWebUrl,
    ttls: TTLS,
    defaultTtl: DEFAULT_TTL,
    maxFileBytes: MAX_FILE_BYTES,
  });

  bot.command('start', (ctx) => handlers.start(ctx));
  bot.command('help', (ctx) => handlers.help(ctx));
  bot.on([...FILE_MESSAGES], (ctx) => handlers.file(ctx));
  bot.on('callback_query:data', (ctx) => handlers.callback(ctx));
  // In groups the bot only reacts to files and commands, never to chatter.
  bot.chatType('private').on('message', (ctx) => handlers.other(ctx));

  bot.catch((err) => {
    log('handler_error', { error: errorStatus(err.error) });
  });

  const sessionTimer = setInterval(() => {
    handlers.expireSessions().catch(() => log('session_expiry_failed'));
  }, SESSION_CHECK_MS);
  const sweep = () =>
    sweepDownloads(config.tgFilesDir, SWEEP_AGE_MS)
      .then((removed) => {
        if (removed > 0) log('downloads_swept', { removed });
      })
      .catch(() => log('downloads_sweep_failed'));
  void sweep();
  const sweepTimer = setInterval(sweep, SWEEP_EVERY_MS);

  const stop = () => {
    clearInterval(sessionTimer);
    clearInterval(sweepTimer);
    void bot.stop();
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);

  log('started', { ttls: TTLS.join(','), defaultTtl: DEFAULT_TTL });
  await bot.start({
    allowed_updates: ['message', 'callback_query'],
    onStart: () => log('polling'),
  });
  log('stopped');
};

main().catch((error) => {
  log('fatal', { error: errorStatus(error) });
  process.exit(1);
});
