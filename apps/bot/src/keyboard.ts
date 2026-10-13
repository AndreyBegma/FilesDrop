import type { InlineKeyboardMarkup } from 'grammy/types';
import { encodeCallback } from './callback-data';
import { type Lang, t } from './i18n';
import { ttlLabel } from './ttls';

/**
 * One row of lifetimes (the current one marked with a dot) and one row with
 * Delete. Pressing the current lifetime again is a no-op, not an error.
 */
export const fileKeyboard = (
  ttls: readonly string[],
  current: string,
  lang: Lang,
): InlineKeyboardMarkup => ({
  inline_keyboard: [
    ttls.map((ttl) => ({
      text: ttl === current ? `• ${ttlLabel(ttl)} •` : ttlLabel(ttl),
      callback_data: encodeCallback({ kind: 'ttl', ttl }),
    })),
    [
      {
        text: t(lang).deleteButton,
        callback_data: encodeCallback({ kind: 'delete' }),
      },
    ],
  ],
});
