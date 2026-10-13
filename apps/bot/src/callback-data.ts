import type { Lang } from './i18n';

/**
 * Inline-button payloads. Telegram caps callback_data at 64 bytes, so they
 * carry only the action: which file a press is about comes from the message
 * it was pressed under (chat id + message id), looked up in the session map.
 * The delete token never leaves the bot.
 */
export type CallbackAction =
  | { kind: 'ttl'; ttl: string }
  | { kind: 'delete' }
  | { kind: 'lang'; lang: Lang };

const PREFIX = 'fd1';
export const CALLBACK_DATA_MAX_BYTES = 64;

export const encodeCallback = (action: CallbackAction): string => {
  const data =
    action.kind === 'ttl'
      ? `${PREFIX}:t:${action.ttl}`
      : action.kind === 'lang'
        ? `${PREFIX}:l:${action.lang}`
        : `${PREFIX}:d`;
  if (new TextEncoder().encode(data).length > CALLBACK_DATA_MAX_BYTES) {
    throw new Error('callback_data over 64 bytes');
  }
  return data;
};

/** Undefined for anything this bot did not produce, or a TTL it does not offer. */
export const decodeCallback = (
  data: string | undefined,
  ttls: readonly string[],
): CallbackAction | undefined => {
  if (!data) return undefined;
  const [prefix, kind, value, ...rest] = data.split(':');
  if (prefix !== PREFIX || rest.length > 0) return undefined;
  if (kind === 'd' && value === undefined) return { kind: 'delete' };
  if (kind === 't' && value !== undefined && ttls.includes(value)) {
    return { kind: 'ttl', ttl: value };
  }
  if (kind === 'l' && (value === 'en' || value === 'uk')) {
    return { kind: 'lang', lang: value };
  }
  return undefined;
};
