import { describe, expect, it } from 'bun:test';
import { PROFILE_LIMITS, PROFILES, profileProblems } from './profile';

describe('bot profile', () => {
  it('fits the Bot API limits in both languages', () => {
    expect(profileProblems(PROFILES)).toEqual([]);
    for (const p of Object.values(PROFILES)) {
      expect(p.shortDescription.length).toBeLessThanOrEqual(
        PROFILE_LIMITS.shortDescription,
      );
      expect(p.description.length).toBeLessThanOrEqual(
        PROFILE_LIMITS.description,
      );
    }
  });

  it('offers /start, /help and /lang in en and uk, linking the right privacy page', () => {
    for (const lang of ['en', 'uk'] as const) {
      expect(PROFILES[lang].commands.map((c) => c.command)).toEqual([
        'start',
        'help',
        'lang',
      ]);
      expect(PROFILES[lang].description).toContain(`/${lang}/privacy`);
      expect(PROFILES[lang].shortDescription).toContain('95');
    }
  });

  it('catches a text that grew too long', () => {
    const long = {
      en: { ...PROFILES.en, shortDescription: 'x'.repeat(121) },
    };
    expect(profileProblems(long)).toEqual(['en: short description 121']);
  });
});
