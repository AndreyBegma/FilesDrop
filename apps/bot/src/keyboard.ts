import type { InlineKeyboardMarkup } from 'grammy/types';
import { encodeCallback } from './callback-data';
import { LANG_BUTTONS, type Lang, t } from './i18n';
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

/**
 * English and Ukrainian, the likelier one first: the saved choice (marked ✓)
 * for /lang, otherwise the one Telegram's language_code points at.
 */
export const langKeyboard = (
  first: Lang,
  saved?: Lang,
): InlineKeyboardMarkup => {
  const order: Lang[] = first === 'uk' ? ['uk', 'en'] : ['en', 'uk'];
  return {
    inline_keyboard: [
      order.map((lang) => ({
        text: lang === saved ? `${LANG_BUTTONS[lang]} ✓` : LANG_BUTTONS[lang],
        callback_data: encodeCallback({ kind: 'lang', lang }),
      })),
    ],
  };
};
