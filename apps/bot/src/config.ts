import { resolve } from 'node:path';

export type BotConfig = {
  /** From @BotFather. Never logged. */
  telegramBotToken: string;
  /** The local Bot API server (`--local` mode), not api.telegram.org. */
  telegramApiRoot: string;
  /** The cloud Bot API, only used once for `logOut` (see cloud-logout.ts). */
  telegramCloudRoot: string;
  /** Shared with the API (BOT_API_KEY there): per-Telegram-user rate limit. */
  botApiKey: string;
  /** The API over the internal network. */
  apiInternalUrl: string;
  /** Origin the links in replies point at. */
  publicWebUrl: string;
  /** Where the local Bot API server stores downloads (a shared volume). */
  tgFilesDir: string;
  /** The bot's own data (languages.json): a volume of its own, writable. */
  botDataDir: string;
};

type Env = Record<string, string | undefined>;

/** A missing variable. Its message names the key, never a value. */
export class ConfigError extends Error {
  override name = 'ConfigError';
}

const required = (env: Env, key: string): string => {
  const value = env[key]?.trim();
  if (!value) throw new ConfigError(`${key} is required`);
  return value;
};

const optional = (env: Env, key: string, fallback: string): string =>
  env[key]?.trim() || fallback;

const origin = (value: string): string => value.replace(/\/+$/, '');

export const configFromEnv = (env: Env): BotConfig => ({
  telegramBotToken: required(env, 'TELEGRAM_BOT_TOKEN'),
  telegramApiRoot: origin(
    optional(env, 'TELEGRAM_API_ROOT', 'http://filesdrop-tg-api:8081'),
  ),
  telegramCloudRoot: origin(
    optional(env, 'TELEGRAM_CLOUD_API_ROOT', 'https://api.telegram.org'),
  ),
  botApiKey: required(env, 'BOT_API_KEY'),
  apiInternalUrl: origin(
    optional(env, 'API_INTERNAL_URL', 'http://filesdrop-api:7347'),
  ),
  publicWebUrl: origin(
    optional(env, 'PUBLIC_WEB_URL', 'https://filesdrop.luna-realm.com'),
  ),
  tgFilesDir: resolve(
    optional(env, 'TG_FILES_DIR', '/var/lib/telegram-bot-api'),
  ),
  botDataDir: resolve(optional(env, 'BOT_DATA_DIR', '/var/lib/filesdrop-bot')),
});
