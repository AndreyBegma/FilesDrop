import { describe, expect, it } from 'bun:test';
import {
  type ErrorKey,
  formatExpiry,
  type IntroParams,
  MESSAGES,
  pickLang,
  privacyUrl,
} from './i18n';

const intro = (lang: 'en' | 'uk', ttls = ['1h', '12h', '24h', '72h']) =>
  ({
    ttls,
    defaultTtl: '24h',
    maxMb: 95,
    privacyUrl: privacyUrl('https://filesdrop.luna-realm.com', lang),
    webUrl: 'https://filesdrop.luna-realm.com',
    botUsername: 'catfilesdrop_bot',
  }) satisfies IntroParams;

describe('pickLang', () => {
  it('is uk for any language_code starting with uk', () => {
    expect(pickLang('uk')).toBe('uk');
    expect(pickLang('uk-UA')).toBe('uk');
    expect(pickLang('UK')).toBe('uk');
  });

  it('is en for everything else, including nothing', () => {
    for (const code of ['en', 'ru', 'de', 'ru-UA', '', undefined, null]) {
      expect(pickLang(code)).toBe('en');
    }
  });
});

describe('messages', () => {
  it('link the privacy page in the reader’s language', () => {
    expect(MESSAGES.en.start(intro('en'))).toContain(
      'https://filesdrop.luna-realm.com/en/privacy',
    );
    expect(MESSAGES.uk.start(intro('uk'))).toContain(
      'https://filesdrop.luna-realm.com/uk/privacy',
    );
    expect(MESSAGES.uk.help(intro('uk'))).toContain('/uk/privacy');
  });

  it('state the limits: 95 MB, 1h to 3d, public links', () => {
    const en = MESSAGES.en.start(intro('en'));
    expect(en).toContain('95 MB');
    expect(en).toContain('from 1h to 3d');
    expect(en).toContain('Anyone who has a link');
    expect(MESSAGES.uk.start(intro('uk'))).toContain('95 МБ');
  });

  it('follow the TTL list when 72h is not there yet', () => {
    expect(MESSAGES.en.start(intro('en', ['1h', '12h', '24h']))).toContain(
      'from 1h to 24h',
    );
  });

  it('link the bot itself in /help', () => {
    expect(MESSAGES.en.help(intro('en'))).toContain(
      'https://t.me/catfilesdrop_bot',
    );
    expect(MESSAGES.en.help(intro('en'))).toContain('1h · 12h · 24h · 3d');
  });

  it('have a text for every error in both languages', () => {
    const keys: ErrorKey[] = [
      'too_large',
      'unsupported',
      'rate_limited',
      'quota',
      'gone',
      'fetch_failed',
      'generic',
    ];
    for (const lang of ['en', 'uk'] as const) {
      for (const key of keys) {
        expect(MESSAGES[lang].error(key, { maxMb: 95 }).length).toBeGreaterThan(
          10,
        );
      }
    }
    expect(
      MESSAGES.en.error('too_large', { maxMb: 95, sizeMb: 120 }),
    ).toContain('120 MB');
  });

  it('show both links and the expiry after an upload', () => {
    const text = MESSAGES.en.uploaded({
      directUrl: 'https://x/f/abc.png',
      previewUrl: 'https://x/v/abc',
      ttl: '72h',
      expiresAt: '2026-10-16T21:05:00.000Z',
    });
    expect(text).toContain('https://x/f/abc.png');
    expect(text).toContain('https://x/v/abc');
    expect(text).toContain('Lives 3d, until 2026-10-16 21:05 UTC');
  });
});

describe('formatExpiry', () => {
  it('prints minutes in UTC and passes garbage through', () => {
    expect(formatExpiry('2026-10-14T09:30:59.999Z')).toBe(
      '2026-10-14 09:30 UTC',
    );
    expect(formatExpiry('soon')).toBe('soon');
  });
});
