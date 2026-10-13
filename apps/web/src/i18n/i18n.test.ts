/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import { negotiateLocale } from './negotiate';
import { retiredLocaleRedirect } from './retired';
import { isLocale, LOCALES } from './routing';

describe('locales', () => {
  test('serves English and Ukrainian only', () => {
    expect([...LOCALES]).toEqual(['en', 'uk']);
    expect(isLocale('ru')).toBe(false);
  });
});

describe('negotiateLocale', () => {
  test('keeps Ukrainian', () => {
    expect(negotiateLocale('uk-UA,uk;q=0.9,en;q=0.8')).toBe('uk');
  });

  test('falls back to English for Russian and anything else', () => {
    expect(negotiateLocale('ru-RU,ru;q=0.9')).toBe('en');
    expect(negotiateLocale('de-DE')).toBe('en');
    expect(negotiateLocale(null)).toBe('en');
  });
});

describe('retiredLocaleRedirect', () => {
  test('sends /ru and everything under it to the same path in English', () => {
    expect(retiredLocaleRedirect('/ru')).toBe('/en');
    expect(retiredLocaleRedirect('/ru/')).toBe('/en/');
    expect(retiredLocaleRedirect('/ru/privacy')).toBe('/en/privacy');
  });

  test('leaves every other path alone', () => {
    expect(retiredLocaleRedirect('/en/privacy')).toBeNull();
    expect(retiredLocaleRedirect('/uk')).toBeNull();
    expect(retiredLocaleRedirect('/rules')).toBeNull();
    expect(retiredLocaleRedirect('/v/abc')).toBeNull();
  });
});
