import { describe, expect, it } from 'bun:test';
import { fileKeyboard, langKeyboard } from './keyboard';

describe('fileKeyboard', () => {
  it('has a lifetime row with the current one marked, and a Delete row', () => {
    const kb = fileKeyboard(['1h', '12h', '24h', '72h'], '24h', 'en');
    expect(kb.inline_keyboard).toHaveLength(2);
    expect(kb.inline_keyboard[0]?.map((b) => b.text)).toEqual([
      '1h',
      '12h',
      '• 24h •',
      '3d',
    ]);
    expect(
      kb.inline_keyboard[0]?.map((b) =>
        'callback_data' in b ? b.callback_data : undefined,
      ),
    ).toEqual(['fd1:t:1h', 'fd1:t:12h', 'fd1:t:24h', 'fd1:t:72h']);
    expect(kb.inline_keyboard[1]).toEqual([
      { text: '🗑 Delete', callback_data: 'fd1:d' },
    ]);
  });

  it('shows only the lifetimes the shared package offers', () => {
    const kb = fileKeyboard(['1h', '12h', '24h'], '1h', 'uk');
    expect(kb.inline_keyboard[0]?.map((b) => b.text)).toEqual([
      '• 1h •',
      '12h',
      '24h',
    ]);
    expect(kb.inline_keyboard[1]?.[0]?.text).toBe('🗑 Видалити');
  });
});

describe('langKeyboard', () => {
  it('puts the suggested language first, one row of two', () => {
    expect(langKeyboard('uk').inline_keyboard).toEqual([
      [
        { text: '🇺🇦 Українська', callback_data: 'fd1:l:uk' },
        { text: '🇬🇧 English', callback_data: 'fd1:l:en' },
      ],
    ]);
    expect(langKeyboard('en').inline_keyboard[0]?.[0]?.text).toBe('🇬🇧 English');
  });

  it('ticks the saved language', () => {
    expect(
      langKeyboard('en', 'en').inline_keyboard[0]?.map((b) => b.text),
    ).toEqual(['🇬🇧 English ✓', '🇺🇦 Українська']);
  });
});
